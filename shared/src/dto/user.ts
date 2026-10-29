import type { SafeUser } from './auth';

export interface UserAdmin extends SafeUser {
  phoneMasked: string | null;
  villageLabel: string | null;
  /** Strikes recorded by administrators (coordinators). */
  strikes: number;
  facilityName: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}
