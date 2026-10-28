import { Schema } from 'mongoose';
import type { LatLng } from '@golden-hour/shared';

export interface GeoPoint {
  type: 'Point';
  coordinates: [lng: number, lat: number];
}

/** GeoJSON Point sub-schema (`[lng, lat]` order) for 2dsphere-indexed fields. */
export const geoPointSchema = new Schema(
  {
    type: { type: String, enum: ['Point'], required: true, default: 'Point' },
    coordinates: { type: [Number], required: true },
  },
  { _id: false },
);

export function toGeoPoint({ lat, lng }: LatLng): GeoPoint {
  return { type: 'Point', coordinates: [lng, lat] };
}

export function fromGeoPoint(point: { coordinates: number[] }): LatLng {
  return { lat: point.coordinates[1]!, lng: point.coordinates[0]! };
}

/** Straight-line distance in km (haversine). */
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Rounds to 2 decimals (~1 km) so a donor's precise home is never stored. */
export function coarsen({ lat, lng }: LatLng): LatLng {
  return { lat: Math.round(lat * 100) / 100, lng: Math.round(lng * 100) / 100 };
}

/**
 * Shortest distance in km from point `p` to the straight segment a→b (local equirectangular
 * projection; accurate enough for district-scale corridors).
 */
export function distanceToSegmentKm(p: LatLng, a: LatLng, b: LatLng): number {
  const kmPerDegLat = 111.32;
  const kmPerDegLng = 111.32 * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  const toXY = (q: LatLng) => ({ x: q.lng * kmPerDegLng, y: q.lat * kmPerDegLat });
  const P = toXY(p);
  const A = toXY(a);
  const B = toXY(b);
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((P.x - A.x) * dx + (P.y - A.y) * dy) / len2));
  return Math.hypot(P.x - (A.x + t * dx), P.y - (A.y + t * dy));
}
