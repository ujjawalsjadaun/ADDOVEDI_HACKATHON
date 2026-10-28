import { NavLink } from 'react-router';

export interface SubNavItem {
  to: string;
  label: string;
  /** Match only this exact path (for an area's index tab). */
  end?: boolean;
}

/** Tab-style section navigation inside an area; scrolls horizontally on small screens. */
export function SubNav({ label, items }: { label: string; items: SubNavItem[] }) {
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto border-b border-slate-200 px-4">
      <ul className="-mb-px flex gap-4 whitespace-nowrap">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `inline-block border-b-2 px-1 pb-2 text-sm font-medium ${
                  isActive ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-600 hover:text-slate-900'
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
