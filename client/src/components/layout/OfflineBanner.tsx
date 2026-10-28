import { useOnlineStatus } from '../../lib/hooks/useOnlineStatus';

export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div role="status" className="bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-900">
      You are offline. Changes are <strong>not</strong> being saved, and what you see may be out of date.
    </div>
  );
}
