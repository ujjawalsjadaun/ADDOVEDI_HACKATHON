import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { TRANSPORT_KINDS, TRANSPORT_STATUSES } from '@golden-hour/shared';
import { geoPointSchema } from '../../lib/geo';

// docs/data-model.md — transportTasks. Transport state never changes request or assignment state.

const placeSchema = new Schema(
  {
    label: { type: String, required: true },
    location: { type: geoPointSchema, default: null },
  },
  { _id: false },
);

const historySchema = new Schema(
  {
    status: { type: String, enum: TRANSPORT_STATUSES, required: true },
    by: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    at: { type: Date, required: true },
    note: { type: String, default: null },
  },
  { _id: false },
);

const transportTaskSchema = new Schema(
  {
    requestId: { type: Schema.Types.ObjectId, ref: 'BloodRequest', required: true },
    facilityId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true },
    assignmentId: { type: Schema.Types.ObjectId, ref: 'Assignment', default: null },
    kind: { type: String, enum: TRANSPORT_KINDS, required: true },
    pickup: { type: placeSchema, required: true },
    dropoff: { type: placeSchema, required: true },
    /** Relay: 1 = donor to the handover point, 2 = handover point to the hospital. `relayGroupId` is leg 1's id. */
    relayLeg: { type: Number, min: 1, max: 2, default: null },
    relayGroupId: { type: Schema.Types.ObjectId, default: null },
    /** Leg 2 carries the donor's assignment for display only (the unique-open-pickup index stays on leg 1). */
    relayAssignmentId: { type: Schema.Types.ObjectId, default: null },
    assigneeUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    status: { type: String, enum: TRANSPORT_STATUSES, default: 'requested' },
    /** true until completed/failed/cancelled; one open pickup per donor assignment. */
    open: { type: Boolean, default: true },
    note: { type: String, default: null },
    history: { type: [historySchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    version: { type: Number, default: 0 },
  },
  { timestamps: true },
);

transportTaskSchema.index(
  { assignmentId: 1 },
  { unique: true, partialFilterExpression: { open: true, assignmentId: { $type: 'objectId' } }, name: 'one_open_pickup_per_assignment' },
);
transportTaskSchema.index({ status: 1, createdAt: 1 });
transportTaskSchema.index({ relayGroupId: 1 }, { sparse: true });
transportTaskSchema.index({ assigneeUserId: 1, open: 1 });
transportTaskSchema.index({ facilityId: 1, open: 1 });
transportTaskSchema.index({ requestId: 1 });

export type TransportTask = InferSchemaType<typeof transportTaskSchema>;
export type TransportTaskDocument = HydratedDocument<TransportTask>;
export const TransportTaskModel = model('TransportTask', transportTaskSchema, 'transportTasks');
