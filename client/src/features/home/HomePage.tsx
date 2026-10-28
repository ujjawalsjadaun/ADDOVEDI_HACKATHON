import { Link } from 'react-router';

export function HomePage() {
  return (
    <div className="space-y-16 py-2">
      {/* ── HERO SECTION ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-b from-white via-slate-50/50 to-white p-8 sm:p-12 shadow-sm">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 h-96 w-96 rounded-full bg-brand-500/5 blur-3xl" aria-hidden="true" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 h-80 w-80 rounded-full bg-amber-500/5 blur-3xl" aria-hidden="true" />

        <div className="relative z-10 max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-200/80 bg-brand-50/90 px-3.5 py-1 text-xs font-semibold text-brand-800 shadow-2xs backdrop-blur-xs">
            <span className="flex h-2 w-2 rounded-full bg-brand-600 animate-pulse" aria-hidden="true" />
            Active Emergency Protocol · Siang Hills & District Hospitals
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl leading-[1.12]">
            Verified blood requests,{' '}
            <span className="bg-gradient-to-r from-brand-600 via-rose-600 to-amber-600 bg-clip-text text-transparent">
              reachable donors.
            </span>
          </h1>

          <p className="max-w-2xl text-base sm:text-lg text-slate-600 leading-relaxed font-normal">
            Golden Hour lets registered hospitals raise verified blood requests and reach compatible donors ranked by road
            travel time — not straight-line distance — with fallbacks for weak connectivity and automated escalation ladders.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link to="/check" className="btn-primary h-11 px-5 text-sm shadow-sm">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
              </svg>
              Verify a Request Code
            </Link>
            <Link to="/register" className="btn-secondary h-11 px-5 text-sm shadow-xs">
              Become a Volunteer Donor
            </Link>
            <Link to="/hospital" className="btn-ghost h-11 px-4 text-sm text-slate-700">
              Hospital Staff Portal &rarr;
            </Link>
          </div>
        </div>

        {/* ── QUICK METRICS BAR ────────────────────────────────────── */}
        <div className="mt-12 grid grid-cols-2 gap-4 border-t border-slate-200/80 pt-8 sm:grid-cols-4">
          <div className="space-y-1">
            <div className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">&lt; 15 min</div>
            <div className="text-xs font-medium text-slate-500">Escalation Ladder</div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Road-Aware</div>
            <div className="text-xs font-medium text-slate-500">Terrain & Weather ETAs</div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">100% Verified</div>
            <div className="text-xs font-medium text-slate-500">Zero Unverified Alerts</div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Zero PII</div>
            <div className="text-xs font-medium text-slate-500">HMAC-Protected Privacy</div>
          </div>
        </div>
      </section>

      {/* ── CORE ACCESS PORTALS ──────────────────────────────────── */}
      <section className="space-y-6">
        <div className="space-y-1.5">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Emergency & Community Portals</h2>
          <p className="text-sm text-slate-600">Select an entry point based on your current need or organizational role.</p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {/* Portal 1 */}
          <Link
            to="/check"
            className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
          >
            <div className="space-y-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-700 ring-1 ring-blue-700/10 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 group-hover:text-brand-600 transition-colors">
                Got a forwarded request?
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Social media forwards often circulate expired or counterfeit pleas. Check whether a public request code is genuine, active, and hospital-verified.
              </p>
            </div>
            <div className="mt-5 flex items-center text-xs font-semibold text-brand-700">
              Verify Crockford Code <span className="ml-1 transition-transform group-hover:translate-x-1">&rarr;</span>
            </div>
          </Link>

          {/* Portal 2 */}
          <Link
            to="/help"
            className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
          >
            <div className="space-y-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-700 ring-1 ring-rose-700/10 transition-colors group-hover:bg-rose-600 group-hover:text-white">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                  <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 group-hover:text-brand-600 transition-colors">
                A family member needs blood?
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Submit an urgent lead for your patient. The treating hospital verifies the clinical need and initiates official matching without broadcasting private phone numbers.
              </p>
            </div>
            <div className="mt-5 flex items-center text-xs font-semibold text-brand-700">
              Request Hospital Callback <span className="ml-1 transition-transform group-hover:translate-x-1">&rarr;</span>
            </div>
          </Link>

          {/* Portal 3 */}
          <Link
            to="/register"
            className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
          >
            <div className="space-y-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-700/10 transition-colors group-hover:bg-emerald-600 group-hover:text-white">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v8" />
                  <path d="M8 12h8" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 group-hover:text-brand-600 transition-colors">
                Become a volunteer donor
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Join your district's verified donor network. Receive emergency alerts only when your specific blood group is needed on routes reachable within the patient's critical window.
              </p>
            </div>
            <div className="mt-5 flex items-center text-xs font-semibold text-brand-700">
              Join Donor Registry <span className="ml-1 transition-transform group-hover:translate-x-1">&rarr;</span>
            </div>
          </Link>

          {/* Portal 4 */}
          <Link
            to="/hospital"
            className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
          >
            <div className="space-y-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-700 ring-1 ring-amber-700/10 transition-colors group-hover:bg-amber-600 group-hover:text-white">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                  <rect width="18" height="18" x="3" y="3" rx="2" />
                  <path d="M12 8v8" />
                  <path d="M8 12h8" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 group-hover:text-brand-600 transition-colors">
                Hospital staff & blood banks
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Raise patient requests, review duplicate submissions, verify clinical urgency with strict two-person checks, and coordinate real-time donor arrivals or unit transfers.
              </p>
            </div>
            <div className="mt-5 flex items-center text-xs font-semibold text-brand-700">
              Hospital Operations Console <span className="ml-1 transition-transform group-hover:translate-x-1">&rarr;</span>
            </div>
          </Link>
        </div>
      </section>

      {/* ── HOW PROTOCOL WORKS ────────────────────────────────────── */}
      <section className="rounded-3xl border border-slate-200/80 bg-white p-8 sm:p-10 shadow-xs space-y-8">
        <div className="max-w-2xl space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-brand-700">Verified Dispatch Journey</span>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">How Golden Hour saves lives</h2>
          <p className="text-sm text-slate-600">
            From clinical need to confirmed donation, every step enforces separation of concerns, road reality, and anti-fatigue cooldowns.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <div className="space-y-3 rounded-2xl bg-slate-50/70 p-5 ring-1 ring-slate-200/60">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold text-white">1</div>
            <h3 className="font-semibold text-slate-900">Two-Person Clinical Verification</h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Hospital staff log the patient reference (HMAC-hashed). A designated verifier confirms urgency before any donor alert is triggered.
            </p>
          </div>

          <div className="space-y-3 rounded-2xl bg-slate-50/70 p-5 ring-1 ring-slate-200/60">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-xs font-bold text-white">2</div>
            <h3 className="font-semibold text-slate-900">Road-Aware Isochrone Matching</h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Donors are ranked by road travel time considering topography, live rain bands, and reported road blocks — ensuring donors can arrive before the deadline.
            </p>
          </div>

          <div className="space-y-3 rounded-2xl bg-slate-50/70 p-5 ring-1 ring-slate-200/60">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-xs font-bold text-white">3</div>
            <h3 className="font-semibold text-slate-900">Real-Time Escalation Ladder</h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              If slots remain unfilled at 5, 10, and 15 minutes, the system widens search pools, relaxes cooldowns, and routes alerts directly to the admin escalation queue.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
