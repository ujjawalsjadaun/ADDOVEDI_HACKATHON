import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { USER_ROLES, USER_STATUSES } from '@golden-hour/shared';

const userSchema = new Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    name: { type: String, required: true, trim: true },
    phone: { type: String },
    role: { type: String, enum: USER_ROLES, required: true },
    facilityId: { type: Schema.Types.ObjectId, ref: 'Hospital', default: null },
    canVerifyRequests: { type: Boolean, default: false },
    status: { type: String, enum: USER_STATUSES, default: 'active' },
    /** Incremented on logout, suspension or password change; sessions carrying an older value are rejected. */
    tokenVersion: { type: Number, default: 0 },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true },
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1, status: 1 });
userSchema.index({ facilityId: 1 });

export type User = InferSchemaType<typeof userSchema>;
export type UserDocument = HydratedDocument<User>;
export const UserModel = model('User', userSchema, 'users');
