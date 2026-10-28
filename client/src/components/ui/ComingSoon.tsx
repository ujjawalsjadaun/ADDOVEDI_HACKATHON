import { EmptyState } from './states';

/** Placeholder for an area whose feature module lands in a later phase. */
export function ComingSoon({ title, phase, description }: { title: string; phase: number; description: string }) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <EmptyState title={`Arrives in Phase ${phase}`}>{description}</EmptyState>
    </div>
  );
}
