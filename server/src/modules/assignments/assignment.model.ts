import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { ASSIGNMENT_STATUSES } from '@golden-hour/shared';
import { etaSnapshotSchema } from '../alerts/alert.model';

// docs/data-model.md — assignments. One donor = one unit = one slot (decision D-10).
//  - `isActive`  : accepted / en_route / arrived — the donor is committed; one per donor overall.
//  - `holdsSlot` : isActive or donated — the slot is used; one per (request, slot).

const assignmentSchema = new Schema(
  {
    requestId: { type: Schema.Types.ObjectId, ref: 'BloodRequest', required: true },
    facilityId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true },
    donorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    alertId: { type: Schema.Types.ObjectId, ref: 'RequestAlert', required: true },
    slot: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ASSIGNMENT_STATUSES, default: 'accepted' },
    isActive: { type: Boolean, default: true },
    holdsSlot: { type: Boolean, default: true },
    eta: { type: etaSnapshotSchema, default: null },
    acceptedAt: { type: Date, required: true },
    enRouteAt: { type: Date, default: null },
    arrivedAt: { type: Date, default: null },
    arrivedBy: { type: String, enum: ['donor_reported', 'hospital_confirmed', null], default: null },
    donatedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
    endReason: { type: String, default: null },
    version: { type: Number, default: 0 },
  },
  { timestamps: true },
);

assignmentSchema.index(
  { requestId: 1, slot: 1 },
  { unique: true, partialFilterExpression: { holdsSlot: true }, name: 'one_donor_per_slot' },
);
assignmentSchema.index(
  { donorUserId: 1 },
  { unique: true, partialFilterExpression: { isActive: true }, name: 'one_active_assignment_per_donor' },
);
assignmentSchema.index({ requestId: 1, donorUserId: 1 }, { unique: true });
assignmentSchema.index({ facilityId: 1, isActive: 1 });

export type Assignment = InferSchemaType<typeof assignmentSchema>;
export type AssignmentDocument = HydratedDocument<Assignment>;
export const AssignmentModel = model('Assignment', assignmentSchema, 'assignments');
