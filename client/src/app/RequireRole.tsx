import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import type { UserRole } from '@golden-hour/shared';
import { ErrorState, LoadingState, UnauthorizedState } from '../components/ui/states';
import { useMe } from '../features/auth/api';

/**
 * Route guard for UX only — the server enforces every permission independently.
 * Signed out → login (then back here); wrong role → explanation.
 */
export function RequireRole({ roles, children }: { roles: UserRole[]; children: ReactNode }) {
  const me = useMe();
  const location = useLocation();

  if (me.isPending) return <LoadingState label="Checking your session…" />;
  if (me.isError) return <ErrorState error={me.error} onRetry={() => void me.refetch()} />;
  if (!me.data) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (!roles.includes(me.data.user.role)) return <UnauthorizedState signedIn />;
  return <>{children}</>;
}
