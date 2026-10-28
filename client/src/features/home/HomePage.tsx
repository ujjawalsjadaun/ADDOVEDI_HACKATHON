import { Link } from 'react-router';

export function HomePage() {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Verified blood requests, reachable donors.</h1>
        <p className="max-w-2xl text-slate-600">
          Golden Hour lets registered hospitals raise verified blood requests and reach compatible donors ranked by road
          travel time — not straight-line distance — with fallbacks for weak connectivity.
        </p>
      </section>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link to="/check" className="card block hover:border-brand-600">
          <h2 className="font-semibold">Got a forwarded request?</h2>
          <p className="mt-1 text-sm text-slate-600">Check whether a request code is genuine and still active.</p>
        </Link>
        <Link to="/register" className="card block hover:border-brand-600">
          <h2 className="font-semibold">Become a donor</h2>
          <p className="mt-1 text-sm text-slate-600">Get alerted when a hospital near you needs your blood group.</p>
        </Link>
        <Link to="/hospital" className="card block hover:border-brand-600">
          <h2 className="font-semibold">Hospital staff</h2>
          <p className="mt-1 text-sm text-slate-600">Raise, verify and track requests for your facility.</p>
        </Link>
      </div>
    </div>
  );
}
