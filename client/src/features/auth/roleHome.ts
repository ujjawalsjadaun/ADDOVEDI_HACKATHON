import type { UserRole } from '@golden-hour/shared';

export const ROLE_HOME: Record<UserRole, string> = {
  admin: '/admin',
  hospital_staff: '/hospital',
  donor: '/donor',
  coordinator: '/coordinator',
};

export const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Admin',
  hospital_staff: 'Hospital staff',
  donor: 'Donor',
  coordinator: 'Coordinator',
};
