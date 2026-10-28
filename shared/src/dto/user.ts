import type { SafeUser } from './auth';

export interface UserAdmin extends SafeUser {
  phoneMasked: string | null;
  facilityName: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}
