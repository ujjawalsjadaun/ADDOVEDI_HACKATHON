import { Link } from 'react-router';

const STEPS = [
  { n: '1', title: 'Hospital raises the request', body: 'Only staff of an admin-verified facility can raise one. The patient reference is stored as a one-way hash.' },
  { n: '2', title: 'A second person verifies', body: 'A different verifier confirms the need and urgency. No donor is contacted before this point.' },
  { n: '3', title: 'Donors are ranked by road time', body: 'Consenting, rested donors are alerted nearest-first by travel time to the hospital — not straight-line distance.' },
  { n: '4', title: 'The hospital closes the loop', body: 'Accepting, arriving and donating are tracked, but only the hospital can mark the need fulfilled.' },
];

const GUARANTEES = [
  ['No alert before verification', 'A request stays pending until a verifier confirms it.'],
  ['One donor per slot', 'Two people can never claim the same unit — enforced by the database.'],
  ['Hospital decides fulfilment', 'Acceptance, arrival or donation never close a request by themselves.'],
  ['Public check shows no private data', 'Status, facility and blood group only — no patient, donor or phone details.'],
  ['Every decision is audited', 'Who did what, when and why — visible to administrators.'],
  ['Honest about uncertainty', 'Travel times show their source; unknown stays unknown instead of being guessed.'],
] as const;

const PORTALS = [
  { to: '/check', title: 'Got a forwarded request?', cta: 'Check the code', body: 'See whether a request is genuine, still open or already closed.' },
  { to: '/help', title: 'Family needs blood?', cta: 'Ask the hospital', body: 'Send a callback request. Only the hospital can raise an official one.' },
  { to: '/register', title: 'Want to donate?', cta: 'Join the donor list', body: 'Get alerted only when your blood group is needed within reach.' },
  { to: '/hospital', title: 'Hospital or blood bank?', cta: 'Open the console', body: 'Raise, verify and follow requests, donors, transport and stock.' },
] as const;

export function HomePage() {
  return (
    <div className="space-y-12">
      {/* ── HERO ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-800 to-slate-950 text-white shadow-lg">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand-500/30 blur-3xl" aria-hidden="true" />
        <div className="absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-brand-400/10 blur-3xl" aria-hidden="true" />

        <div className="relative z-10 grid gap-10 p-7 sm:p-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:p-14">
          <div className="space-y-6">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3.5 py-1 text-xs font-semibold backdrop-blur-sm">
              <span className="signal-dot h-2 w-2 rounded-full bg-brand-300" aria-hidden="true" />
              Built for hill districts · Siang Hills demo
            </p>
            <h1 className="text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              <span className="text-brand-200">Verified</span> blood requests.
              <br />
              Donors who can <span className="text-brand-200">reach</span> the hospital.
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-brand-100 sm:text-lg">
              In the hills, the nearest donor on the map is not the nearest on the road, and a forwarded message can’t be trusted. Golden Hour
              lets hospitals raise <strong className="text-white">verified</strong> requests and alerts donors ranked by{' '}
              <strong className="text-white">road travel time</strong>.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link to="/check" className="btn-light h-12 px-6 text-base">
                Check a request code
              </Link>
              <Link to="/register" className="btn-outline-light h-12 px-6 text-base">
                Become a donor
              </Link>
              <Link to="/help" className="px-2 text-sm font-semibold text-brand-100 underline-offset-4 hover:text-white hover:underline">
                Family needs blood? &rarr;
              </Link>
            </div>
          </div>

          <ExampleRequestCard />
        </div>
      </section>

      {/* ── PROBLEM STRIP ────────────────────────────────────────── */}
      <section className="grid gap-4 sm:grid-cols-3" aria-label="The problem">
        {[
          ['Distance is not reachability', 'A donor 5 km away across a ridge can be hours from the hospital by road.'],
          ['Forwards lose trust', 'Old or fake requests circulate. People need a way to check one in seconds.'],
          ['Signal is unreliable', 'Alerts also go out by SMS, and pages show how fresh their data is.'],
        ].map(([title, body]) => (
          <div key={title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <p className="eyebrow text-brand-700">The problem</p>
            <h3 className="mt-1 text-base font-extrabold text-slate-900">{title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{body}</p>
          </div>
        ))}
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────── */}
      <section className="space-y-6">
        <div className="max-w-2xl">
          <p className="eyebrow text-brand-700">How it works</p>
          <h2 className="mt-1 text-3xl font-black tracking-tight text-slate-900">From request to confirmed donation</h2>
        </div>
        <ol className="grid gap-4 md:grid-cols-4">
          {STEPS.map((s) => (
            <li key={s.n} className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-lg font-black text-white shadow-sm">{s.n}</span>
              <h3 className="mt-3 text-base font-extrabold leading-snug text-slate-900">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{s.body}</p>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-slate-950 px-5 py-4 text-sm text-slate-200">
          <span className="eyebrow text-brand-300">If nobody accepts</span>
          {['0 min · first donors alerted', '5 min · search widens', '10 min · hospital told to check its blood bank', '15 min · administrators step in'].map((t) => (
            <span key={t} className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold">
              {t}
            </span>
          ))}
        </div>
      </section>

      {/* ── GUARANTEES ───────────────────────────────────────────── */}
      <section className="space-y-6">
        <div className="max-w-2xl">
          <p className="eyebrow text-brand-700">Safety rules built in</p>
          <h2 className="mt-1 text-3xl font-black tracking-tight text-slate-900">What the system will not do</h2>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {GUARANTEES.map(([title, body]) => (
            <li key={title} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white" aria-hidden="true">
                <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                  <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-6.5 6.5a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 1 1 1.06-1.06l2.47 2.47 5.97-5.97a.75.75 0 0 1 1.06 0Z" />
                </svg>
              </span>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">{title}</h3>
                <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* ── PORTALS ──────────────────────────────────────────────── */}
      <section className="space-y-6">
        <div className="max-w-2xl">
          <p className="eyebrow text-brand-700">Start here</p>
          <h2 className="mt-1 text-3xl font-black tracking-tight text-slate-900">Who are you?</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PORTALS.map((p) => (
            <Link
              key={p.to}
              to={p.to}
              className="group flex flex-col justify-between rounded-2xl border border-slate-200 border-t-4 border-t-brand-600 bg-white p-5 shadow-xs transition-all duration-150 hover:-translate-y-1 hover:shadow-lg"
            >
              <div>
                <h3 className="text-lg font-extrabold leading-snug text-slate-900">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{p.body}</p>
              </div>
              <span className="mt-5 text-sm font-bold text-brand-700">
                {p.cta} <span className="inline-block transition-transform group-hover:translate-x-1">&rarr;</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-center text-xs font-medium text-amber-900">
        Demonstration build: all people, facilities and phone numbers are fictional, and SMS messages are simulated — none reach a phone.
      </p>
    </div>
  );
}

/** Illustrative only — static sample data, labelled as such. Shows what a hospital sees. */
function ExampleRequestCard() {
  return (
    <aside className="rounded-2xl bg-white p-5 text-slate-900 shadow-2xl ring-1 ring-black/10" aria-label="Example request (illustrative)">
      <div className="flex items-center justify-between">
        <p className="eyebrow text-slate-500">Example request</p>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">Illustrative</span>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-brand-600 text-2xl font-black text-white shadow-md">O+</div>
        <div className="min-w-0">
          <p className="font-mono text-lg font-extrabold tracking-tight">GH-7K2M-Q9ZT</p>
          <p className="text-xs text-slate-500">Siang Hills District Hospital</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800 ring-1 ring-inset ring-emerald-600/20">Verified</span>
        <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-700 ring-1 ring-inset ring-brand-600/20">Urgent</span>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">1 of 2 units assigned</span>
      </div>
      <p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Donors ranked by road time</p>
      <ul className="mt-1.5 divide-y divide-slate-100 text-sm">
        {[
          ['Pasighat town', '~22 min'],
          ['Mebo village', '~41 min'],
          ['Ridge Village', '~68 min'],
        ].map(([place, eta], i) => (
          <li key={place} className="flex items-center justify-between py-1.5">
            <span>
              <span className="mr-2 inline-block w-4 text-right text-xs font-bold text-slate-400">{i + 1}</span>
              {place}
            </span>
            <span className="font-bold tabular-nums">{eta}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-slate-500">Every estimate shows its source (live, cached or simulated) and any road or weather warning.</p>
    </aside>
  );
}
