import type { ReactNode } from 'react';

interface PageHeaderProps {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Buttons on the right (use btn-light / btn-outline-light). */
  actions?: ReactNode;
  /** Small extras under the title (freshness pill, badges). */
  meta?: ReactNode;
}

/** Red page banner shared by the main workspace screens, so every role's home feels like one product. */
export function PageHeader({ eyebrow, title, subtitle, actions, meta }: PageHeaderProps) {
  return (
    <header className="banner">
      <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          {eyebrow && <p className="eyebrow text-brand-200">{eyebrow}</p>}
          <h1 className="text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">{title}</h1>
          {subtitle && <p className="max-w-2xl text-sm leading-relaxed text-brand-100">{subtitle}</p>}
          {meta && <div className="flex flex-wrap items-center gap-2 pt-1.5">{meta}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2.5">{actions}</div>}
      </div>
    </header>
  );
}
