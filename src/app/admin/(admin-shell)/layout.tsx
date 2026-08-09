"use client";

import { useAuth } from "@clerk/nextjs";
import {
  BarChart3,
  FileText,
  Globe,
  LayoutDashboard,
  MessageSquare,
  Settings,
  Shield,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getRoleFromClaims, isAdminRole } from "@/lib/clerk-claims";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/crawls", label: "Crawls", icon: Globe },
  { href: "/admin/documents", label: "Documents", icon: FileText },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/feedback", label: "Feedback", icon: MessageSquare },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

/**
 * Wrapper component that only renders children after client-side hydration.
 * This prevents Convex hooks (useQuery, useMutation) from executing during
 * Next.js SSR/build prerendering when no ConvexProvider is available.
 */
function ClientOnly({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 select-none pointer-events-none">
        <span className="font-mono text-[10px] tracking-[0.2em] text-[var(--accent)] animate-pulse uppercase">
          {"ADMIN // INITIALIZING…"}
        </span>
        <div className="h-px w-24 bg-gradient-to-r from-transparent via-[var(--accent)]/30 to-transparent animate-pulse" />
      </div>
    );
  }
  return <>{children}</>;
}

export default function AdminShellLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isLoaded, sessionClaims } = useAuth();

  const role = getRoleFromClaims(sessionClaims as Record<string, unknown> | null | undefined);
  const isAdmin = isAdminRole(role);

  return (
    <AuthGuard requireAdmin isAdmin={isAdmin} isAdminLoading={!isLoaded}>
      <div className="flex h-full w-full bg-[var(--surface-base)] text-zinc-100 overflow-hidden">
        {/* Admin Sidebar */}
        <aside className="flex w-56 flex-col border-r border-[var(--surface-5)] bg-[var(--surface-1)]/90 backdrop-blur-md shrink-0">
          <div className="flex h-14 items-center gap-2 border-b border-[var(--surface-5)] px-4 shrink-0">
            <Shield className="h-4 w-4 text-[var(--accent)]" />
            <span className="font-semibold text-xs tracking-wider uppercase text-zinc-300 font-sans">
              Admin Panel
            </span>
          </div>
          <ScrollArea className="flex-1 px-2 py-2">
            <nav className="flex flex-col gap-0.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2 text-xs font-semibold font-sans transition-all duration-300 ease-[var(--ease-spring)] active:scale-[0.97]",
                      isActive
                        ? "bg-[var(--accent)]/10 text-[var(--accent)] border-l-2 border-[var(--accent)] rounded-l-none"
                        : "text-zinc-400 hover:bg-white/5 hover:text-white",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0 text-zinc-500" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </ScrollArea>
          <div className="border-t border-[var(--surface-5)] p-3 shrink-0">
            <Link
              href="/"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-300 transition-colors font-sans"
            >
              ← Back to app
            </Link>
          </div>
        </aside>

        {/* Main Content - wrapped in ClientOnly to prevent Convex SSR errors */}
        <div className="flex flex-1 flex-col overflow-hidden min-w-0 bg-[var(--surface-base)]">
          <header className="flex h-14 items-center border-b border-[var(--surface-5)] px-6 shrink-0 bg-[var(--surface-1)]/60 backdrop-blur-md">
            <h1 className="text-sm font-semibold text-zinc-100 font-sans tracking-tight">
              {(navItems.find((i) => pathname === i.href) ??
                navItems.find((i) => pathname.startsWith(i.href + "/")))?.label ?? "Admin"}
            </h1>
          </header>
          <main className="flex-1 overflow-auto p-6 bg-transparent">
            <ClientOnly>{children}</ClientOnly>
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
