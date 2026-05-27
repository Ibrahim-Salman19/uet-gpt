"use client";

import {
  BarChart3,
  FileText,
  Globe,
  LayoutDashboard,
  MessageSquare,
  Settings,
  Shield,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/crawls", label: "Crawls", icon: Globe },
  { href: "/admin/documents", label: "Documents", icon: FileText },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/feedback", label: "Feedback", icon: MessageSquare },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export const dynamic = "force-dynamic";

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
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading admin panel...</p>
      </div>
    );
  }
  return <>{children}</>;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full">
      {/* Admin Sidebar */}
      <aside className="flex w-56 flex-col border-r border-border bg-card">
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <Shield className="h-5 w-5 text-primary" />
          <span className="font-semibold text-sm">Admin Panel</span>
        </div>
        <ScrollArea className="flex-1">
          <nav className="flex flex-col gap-1 p-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </ScrollArea>
        <div className="border-t border-border p-3">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to app
          </Link>
        </div>
      </aside>

      {/* Main Content — wrapped in ClientOnly to prevent Convex SSR errors */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center border-b border-border px-6">
          <h1 className="text-lg font-semibold">
            {navItems.find((i) => i.href === pathname)?.label ?? "Admin"}
          </h1>
        </header>
        <div className="flex-1 overflow-auto p-6">
          <ClientOnly>{children}</ClientOnly>
        </div>
      </div>
    </div>
  );
}
