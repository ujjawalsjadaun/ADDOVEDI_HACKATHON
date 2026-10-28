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
