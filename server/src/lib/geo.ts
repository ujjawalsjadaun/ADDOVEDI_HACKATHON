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
