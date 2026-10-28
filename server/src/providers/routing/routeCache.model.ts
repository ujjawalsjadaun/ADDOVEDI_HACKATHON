import { Schema, model } from 'mongoose';

// docs/data-model.md — routeCache. Keeps the original calculation time so cached ETAs show their real age.

const routeCacheSchema = new Schema(
  {
    key: { type: String, required: true },
    minutes: { type: Number, required: true },
    distanceKm: { type: Number, required: true },
    source: { type: String, required: true },
    calculatedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false },
);

routeCacheSchema.index({ key: 1 }, { unique: true });
routeCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RouteCacheModel = model('RouteCache', routeCacheSchema, 'routeCache');
