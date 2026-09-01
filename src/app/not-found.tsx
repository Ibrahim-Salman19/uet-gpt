import Link from "next/link";

export default function NotFound() {
  return (
    <main
      id="main-content"
      className="flex min-h-screen flex-col items-center justify-center bg-[#07080a] px-6 text-center text-[#edf0ec]"
    >
      <div className="max-w-md">
        <span className="font-mono text-xs uppercase tracking-widest text-[#d9b451]">
          404 Error
        </span>
        <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">Page Not Found</h1>
        <p className="mt-4 text-sm text-[#8d968e]">
          The page you are looking for does not exist or has been moved. Explore one of our official
          guides or ask UET GPT.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="rounded bg-[#d9b451] px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-[#07080a] hover:bg-[#f0d178] transition-colors min-h-[44px] inline-flex items-center justify-center"
          >
            Home
          </Link>
          <Link
            href="/uet-taxila"
            className="rounded border border-white/20 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-white hover:border-white/40 transition-colors min-h-[44px] inline-flex items-center justify-center"
          >
            UET Taxila Guide
          </Link>
          <Link
            href="/chat"
            className="rounded border border-white/20 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-white hover:border-white/40 transition-colors min-h-[44px] inline-flex items-center justify-center"
          >
            Start Chat
          </Link>
        </div>
      </div>
    </main>
  );
}
