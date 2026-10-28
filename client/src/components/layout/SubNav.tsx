import { NavLink } from 'react-router';

export interface SubNavItem {
  to: string;
  label: string;
  /** Match only this exact path (for an area's index tab). */
  end?: boolean;
}

/** Segmented tab navigation inside an area; scrolls horizontally on small screens. */
export function SubNav({ label, items }: { label: string; items: SubNavItem[] }) {
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto px-4 pb-2">
      <ul className="flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-slate-100/70 p-1 whitespace-nowrap w-max min-w-full sm:min-w-0">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `inline-flex items-center rounded-lg px-3.5 py-1.5 text-xs sm:text-sm font-semibold transition-all duration-150 ${
                  isActive
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`
              }
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
