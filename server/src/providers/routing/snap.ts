import type { LatLng, NearestRoadResult } from '@golden-hour/shared';
import type { Config } from '../../config/env';
import { AppError } from '../../lib/errors';
import { fetchJson } from '../../lib/fetchJson';
import { haversineKm } from '../../lib/geo';

// Finds the nearest point on a drivable road. First choice: OpenRouteService "snap" (needs the same key as
// routing). Fallback: OpenStreetMap roads via the public Overpass API. If both fail the caller gets a 503 and
// can still place the point by hand, so this never blocks the existing manual flow.

const SEARCH_RADIUS_M = 3000;
const NOTE = 'Estimated from map data, not a survey and not live. Check blocked or washed-out roads before relying on it.';

/** Roads a vehicle can normally use. Tracks and paths are deliberately excluded. */
const DRIVABLE = 'motorway|trunk|primary|secondary|tertiary|unclassified|residential|service|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link';
const OVERPASS_MIRRORS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

interface OrsSnapResponse {
  locations?: ({ location?: [number, number]; name?: string; snapped_distance?: number } | null)[];
}

interface OverpassResponse {
  elements?: { tags?: { name?: string }; geometry?: { lat: number; lon: number }[] }[];
}

async function snapWithOrs(point: LatLng, apiKey: string, timeoutMs: number): Promise<NearestRoadResult | null> {
  const body = await fetchJson<OrsSnapResponse>('https://api.openrouteservice.org/v2/snap/driving-car', {
    method: 'POST',
    headers: { Authorization: apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ locations: [[point.lng, point.lat]], radius: SEARCH_RADIUS_M }), // ORS expects [lng, lat]
    timeoutMs,
  });
  const hit = body.locations?.[0];
  if (!hit?.location) return null;
  const snapped = { lat: hit.location[1], lng: hit.location[0] };
  return { point: snapped, distanceM: Math.round(haversineKm(point, snapped) * 1000), roadName: hit.name || null, source: 'openrouteservice', note: NOTE };
}

/** Nearest point on the segment a-b to p, in a local flat projection (accurate over a few kilometres). */
export function nearestOnSegment(p: LatLng, a: LatLng, b: LatLng): LatLng {
  const k = Math.cos((p.lat * Math.PI) / 180);
  const ax = (a.lng - p.lng) * k;
  const ay = a.lat - p.lat;
  const bx = (b.lng - p.lng) * k;
  const by = b.lat - p.lat;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

async function snapWithOverpass(point: LatLng, timeoutMs: number): Promise<NearestRoadResult | null> {
  const query = `[out:json][timeout:15];way(around:${SEARCH_RADIUS_M},${point.lat},${point.lng})["highway"~"^(${DRIVABLE})$"];out geom tags;`;
  let lastError: unknown;
  for (const url of OVERPASS_MIRRORS) {
    try {
      const body = await fetchJson<OverpassResponse>(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'golden-hour-hackathon/1.0' },
        body: `data=${encodeURIComponent(query)}`,
        timeoutMs,
      });
      let best: { point: LatLng; distanceKm: number; name: string | null } | null = null;
      for (const way of body.elements ?? []) {
        const g = way.geometry ?? [];
        for (let i = 0; i + 1 < g.length; i++) {
          const candidate = nearestOnSegment(point, { lat: g[i]!.lat, lng: g[i]!.lon }, { lat: g[i + 1]!.lat, lng: g[i + 1]!.lon });
          const distanceKm = haversineKm(point, candidate);
          if (!best || distanceKm < best.distanceKm) best = { point: candidate, distanceKm, name: way.tags?.name ?? null };
        }
      }
      return best ? { point: best.point, distanceM: Math.round(best.distanceKm * 1000), roadName: best.name, source: 'openstreetmap', note: NOTE } : null;
    } catch (err) {
      lastError = err; // try the next mirror
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Overpass request failed');
}

export async function findNearestRoad(point: LatLng, config: Config): Promise<NearestRoadResult> {
  try {
    if (config.ROUTING_PROVIDER === 'openrouteservice' && config.ORS_API_KEY) {
      const viaOrs = await snapWithOrs(point, config.ORS_API_KEY, config.PROVIDER_TIMEOUT_MS).catch(() => null);
      if (viaOrs) return viaOrs;
    }
    const viaOsm = await snapWithOverpass(point, Math.max(config.PROVIDER_TIMEOUT_MS, 12_000));
    if (viaOsm) return viaOsm;
  } catch {
    throw new AppError('SERVICE_UNAVAILABLE', 'The road lookup service is not reachable right now. Place the point on the map by hand.');
  }
  throw new AppError('NOT_FOUND', `No drivable road found within ${SEARCH_RADIUS_M / 1000} km of that spot. Place the point by hand.`);
}
