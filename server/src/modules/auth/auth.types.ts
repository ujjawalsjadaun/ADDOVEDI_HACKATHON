import type { UserRole, UserStatus } from '@golden-hour/shared';

/** The signed-in user as loaded from the database on every request. */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  facilityId: string | null;
  canVerifyRequests: boolean;
  tokenVersion: number;
}

/** Who is acting and the HTTP correlation id, passed from routes to services for auditing. */
export interface ActionContext {
  user: AuthUser;
  requestId: string;
}
