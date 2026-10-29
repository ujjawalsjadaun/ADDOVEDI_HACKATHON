import { NavLink } from 'react-router';

export interface SubNavItem {
  to: string;
  label: string;
  /** Match only this exact path (for an area's index tab). */
  end?: boolean;
}

/** Tab bar inside an area: red underline on the active tab; scrolls sideways on small screens. */
export function SubNav({ label, items }: { label: string; items: SubNavItem[] }) {
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto border-b border-slate-300/70 px-4">
      <ul className="flex w-max min-w-full items-center gap-1 whitespace-nowrap sm:min-w-0">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `-mb-px inline-flex items-center border-b-[3px] px-3.5 py-2.5 text-sm font-semibold transition-colors ${
                  isActive ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:border-slate-400 hover:text-slate-900'
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
