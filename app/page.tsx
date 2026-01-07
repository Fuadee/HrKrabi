import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-4xl font-semibold tracking-tight text-white">
        Workforce Replacement Tracker
      </h1>
      <p className="text-lg text-slate-300">Step-by-step rebuild</p>
      <nav className="flex flex-wrap items-center justify-center gap-3 text-sm text-slate-200">
        <Link
          href="/dev/health"
          className="rounded-full border border-slate-700 px-4 py-2 transition hover:border-slate-500"
        >
          Dev health
        </Link>
        <Link
          href="/login"
          className="rounded-full border border-slate-700 px-4 py-2 transition hover:border-slate-500"
        >
          Login
        </Link>
        <Link
          href="/me"
          className="rounded-full border border-slate-700 px-4 py-2 transition hover:border-slate-500"
        >
          My profile
        </Link>
      </nav>
    </main>
  );
}
