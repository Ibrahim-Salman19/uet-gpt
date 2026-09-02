"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

interface NavLink {
  href: string;
  label: string;
  badge?: string;
}

const PRIMARY_LINKS: NavLink[] = [
  { href: "/calculator", label: "Merit Calc", badge: "Live" },
  { href: "/gpa-calculator", label: "GPA Calc", badge: "New" },
  { href: "/scholarship-finder", label: "Aid Finder" },
  { href: "/merit-archive", label: "Archive" },
  { href: "/uet-taxila/programs", label: "Programs" },
  { href: "/resources", label: "Resources" },
  { href: "/calendar", label: "Calendar" },
  { href: "/directory", label: "Directory" },
  { href: "/bus-routes", label: "Bus Routes" },
  { href: "/societies", label: "Societies" },
  { href: "/compare", label: "Compare" },
  { href: "/ecat-guide", label: "ECAT" },
  { href: "/scholarships", label: "Scholarships" },
  { href: "/campus-life", label: "Campus" },
  { href: "/learn", label: "Glossary" },
];

export function PublicNav() {
  const pathname = usePathname() || "";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      {/* Skip to Content Accessible Link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:bg-[#d9b451] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-[#07080a] focus:shadow-lg focus:outline-none"
      >
        Skip to main content
      </a>

      <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-[#07080a]/90 backdrop-blur-md transition-all">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link
            href="/"
            className="group flex items-center gap-2.5 font-mono text-sm tracking-wide transition-opacity hover:opacity-90"
            aria-label="UET GPT Home"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#d9b451] text-[#07080a] font-bold text-sm shadow-md shadow-[#d9b451]/20">
              U
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-white text-base leading-none">
                UET <span className="text-[#d9b451]">GPT</span>
              </span>
              <span className="text-[9px] text-[#a1a1aa] uppercase tracking-widest mt-0.5">
                AI Guide to Taxila
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav
            aria-label="Main Navigation"
            className="hidden xl:flex items-center gap-1 text-xs font-mono tracking-wider uppercase"
          >
            {PRIMARY_LINKS.map((link) => {
              const isActive =
                pathname === link.href ||
                (link.href !== "/" && pathname.startsWith(`${link.href}/`));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative rounded-md px-3 py-2 transition-colors ${
                    isActive
                      ? "text-[#d9b451] font-semibold bg-white/5"
                      : "text-[#a1a1aa] hover:text-white hover:bg-white/[0.03]"
                  }`}
                >
                  {link.label}
                  {link.badge && (
                    <span className="ml-1.5 rounded-full bg-[#d9b451]/20 px-1.5 py-0.2 text-[9px] font-bold text-[#d9b451] normal-case">
                      {link.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right Action: Start Chat & Mobile Toggle */}
          <div className="flex items-center gap-3">
            <Link
              href="/chat"
              className="inline-flex items-center gap-2 rounded-lg bg-[#d9b451] px-4 py-2 text-xs font-mono font-semibold uppercase tracking-wider text-[#07080a] hover:bg-[#f0d178] transition-all shadow-md shadow-[#d9b451]/10 min-h-[40px]"
            >
              <span>Ask AI</span>
              <span className="hidden sm:inline">&rarr;</span>
            </Link>

            {/* Mobile Hamburger Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="xl:hidden flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-[#a1a1aa] hover:text-white hover:bg-white/5 transition-colors focus:outline-none focus:ring-2 focus:ring-[#d9b451]"
              aria-expanded={mobileMenuOpen}
              aria-label="Toggle mobile menu"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.75}
                stroke="currentColor"
                aria-hidden="true"
              >
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="xl:hidden border-t border-white/10 bg-[#0c0d10] px-4 py-6 sm:px-6 animate-in slide-in-from-top-2 duration-200">
            <nav
              aria-label="Mobile Navigation"
              className="flex flex-col space-y-2 text-sm font-mono uppercase tracking-wider"
            >
              <Link
                href="/"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center justify-between rounded-lg px-3 py-2.5 min-h-[44px] ${
                  pathname === "/"
                    ? "bg-[#d9b451]/10 text-[#d9b451] font-bold"
                    : "text-[#a1a1aa] hover:text-white hover:bg-white/5"
                }`}
              >
                <span>Home</span>
              </Link>
              <Link
                href="/uet-taxila"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center justify-between rounded-lg px-3 py-2.5 min-h-[44px] ${
                  pathname === "/uet-taxila"
                    ? "bg-[#d9b451]/10 text-[#d9b451] font-bold"
                    : "text-[#a1a1aa] hover:text-white hover:bg-white/5"
                }`}
              >
                <span>UET Taxila Hub</span>
              </Link>
              {PRIMARY_LINKS.map((link) => {
                const isActive =
                  pathname === link.href ||
                  (link.href !== "/" && pathname.startsWith(`${link.href}/`));
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center justify-between rounded-lg px-3 py-2.5 min-h-[44px] ${
                      isActive
                        ? "bg-[#d9b451]/10 text-[#d9b451] font-bold"
                        : "text-[#a1a1aa] hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <span>{link.label}</span>
                    {link.badge && (
                      <span className="rounded-full bg-[#d9b451]/20 px-2 py-0.5 text-[10px] font-bold text-[#d9b451] normal-case">
                        {link.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
              <div className="pt-4 mt-2 border-t border-white/10 flex flex-col gap-2">
                <Link
                  href="/chat"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center rounded-lg bg-[#d9b451] px-4 py-3 text-sm font-bold text-[#07080a] min-h-[44px]"
                >
                  Start Chat with UET GPT &rarr;
                </Link>
              </div>
            </nav>
          </div>
        )}
      </header>
    </>
  );
}
