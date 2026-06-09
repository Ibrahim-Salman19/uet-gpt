"use client";

import { cn } from "@/lib/utils";

interface LoadingStateProps {
  type?: "messages" | "sidebar" | "page" | "admin-overview" | "admin-list" | "admin-settings";
  className?: string;
}

function MessageSkeleton({ isUser }: { isUser: boolean }) {
  return (
    <div
      className={cn(
        "flex items-start gap-4 px-4 py-4 border-b border-[var(--ks-rule)]",
        isUser ? "flex-row-reverse" : "flex-row",
      )}
    >
      {/* Small mono-spaced avatar frame */}
      <div className="h-7 w-7 shrink-0 border border-[var(--ks-rule-strong)] bg-[var(--surface-1)] flex items-center justify-center rounded-[2px] select-none">
        <span className="font-mono text-[9px] text-[var(--ks-text-muted)]">
          {isUser ? "USR" : "AI"}
        </span>
      </div>

      {/* Content box */}
      <div
        className={cn("flex flex-col gap-2 max-w-xl w-full", isUser ? "items-end" : "items-start")}
      >
        <div className="w-full border border-[var(--ks-rule)] bg-[var(--surface-0)] p-3 rounded-[2px] relative overflow-hidden">
          {/* Subtle running loading trace */}
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-[var(--ks-rule)] overflow-hidden">
            <div className="h-full w-24 bg-[var(--ks-kinpaku-gold)] animate-progress" />
          </div>
          <div className="font-mono text-[10px] text-[var(--ks-text-muted)] mt-1.5 flex items-center gap-2 select-none">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--ks-verdigris-patina)] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[var(--ks-verdigris-patina)]"></span>
            </span>
            {isUser ? "TRANSMITTING DATA..." : "PROCESSING RAG CONTEXT..."}
          </div>
        </div>

        {/* Timestamp placeholder */}
        <div className="font-mono text-[8px] text-[var(--ks-text-faint)] tracking-widest select-none">
          {"SYS // SYNC_PENDING"}
        </div>
      </div>
    </div>
  );
}

function SidebarSkeleton() {
  return (
    <div className="flex flex-col h-full bg-[var(--surface-1)] border-r border-[var(--ks-rule)] min-h-[400px]">
      {/* Header element */}
      <div className="p-4 border-b border-[var(--ks-rule)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 border border-[var(--ks-rule-strong)] flex items-center justify-center rounded-[2px]">
            <span className="font-mono text-[8px] text-[var(--ks-kinpaku-gold)] select-none">
              UET
            </span>
          </div>
          <span className="font-mono text-[10px] tracking-wider text-[var(--ks-champagne)] select-none font-bold">
            {"UETGPT // NAV"}
          </span>
        </div>
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--ks-verdigris-patina)] opacity-75"></span>
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[var(--ks-verdigris-patina)]"></span>
        </span>
      </div>

      {/* Main navigation list */}
      <div className="flex flex-col p-3 gap-1.5 mt-2">
        {Array.from({ length: 6 }, (_, i) => `sidebar-skeleton-${i}`).map((key, index) => (
          <div
            key={key}
            className="flex items-center justify-between p-2.5 border border-[var(--ks-rule)] bg-[var(--surface-0)] rounded-[2px] transition-all"
          >
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-[9px] text-[var(--ks-kinpaku-gold)] opacity-70">
                0{index + 1}
              </span>
              <span className="font-mono text-[9px] text-[var(--ks-text-muted)] tracking-wider select-none uppercase">
                {
                  [
                    "chat_workspace",
                    "explore_rag",
                    "syllabi_db",
                    "campus_map",
                    "settings_config",
                    "system_status",
                  ][index]
                }
              </span>
            </div>
            {/* Subtle pulse block indicator */}
            <div className="w-1.5 h-1.5 bg-[var(--ks-rule-strong)] animate-pulse rounded-[1px]" />
          </div>
        ))}
      </div>

      {/* Footer diagnostic block */}
      <div className="mt-auto p-4 border-t border-[var(--ks-rule)] bg-[var(--ks-lacquer-deep)]">
        <div className="font-mono text-[8px] text-[var(--ks-text-faint)] leading-relaxed select-none">
          {"SECURE CONNECTION // SSL_READY"}
          <br />
          {"NODE // V24_ACTIVE"}
          <br />
          {"CONVEX // HANDSHAKE_OK"}
        </div>
      </div>
    </div>
  );
}

function AdminOverviewSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between pb-2 border-b border-white/[0.04]">
        <div className="h-4 w-28 bg-white/5 rounded" />
      </div>

      {/* Primary Bento Row: 2 + 1 + 1 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2 rounded-xl border border-white/5 bg-[#101012]/40 p-5 space-y-4 relative overflow-hidden">
          <div className="flex justify-between items-center">
            <div className="h-3 w-24 bg-white/5 rounded" />
            <div className="h-4 w-4 bg-white/5 rounded" />
          </div>
          <div className="h-8 w-32 bg-white/10 rounded" />
          <div className="h-2 w-full bg-white/5 rounded-full" />
        </div>
        <div className="rounded-xl border border-white/5 bg-[#101012]/40 p-5 space-y-4">
          <div className="flex justify-between items-center">
            <div className="h-3 w-24 bg-white/5 rounded" />
            <div className="h-4 w-4 bg-white/5 rounded" />
          </div>
          <div className="h-8 w-16 bg-white/10 rounded" />
        </div>
        <div className="rounded-xl border border-white/5 bg-[#101012]/40 p-5 space-y-4">
          <div className="flex justify-between items-center">
            <div className="h-3 w-20 bg-white/5 rounded" />
            <div className="h-4 w-4 bg-white/5 rounded" />
          </div>
          <div className="h-8 w-16 bg-white/10 rounded" />
        </div>
      </div>

      {/* Secondary Bento Row: 1 + 1 + 2 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-white/5 bg-[#101012]/40 p-5 space-y-4">
          <div className="flex justify-between items-center">
            <div className="h-3 w-20 bg-white/5 rounded" />
            <div className="h-4 w-4 bg-white/5 rounded" />
          </div>
          <div className="h-8 w-16 bg-white/10 rounded" />
        </div>
        <div className="rounded-xl border border-white/5 bg-[#101012]/40 p-5 space-y-4">
          <div className="flex justify-between items-center">
            <div className="h-3 w-24 bg-white/5 rounded" />
            <div className="h-4 w-4 bg-white/5 rounded" />
          </div>
          <div className="h-8 w-20 bg-white/10 rounded" />
        </div>
        <div className="lg:col-span-2 rounded-xl border border-white/5 bg-[#101012]/40 p-5 space-y-4 relative overflow-hidden">
          <div className="flex justify-between items-center">
            <div className="h-3 w-28 bg-white/5 rounded" />
            <div className="h-4 w-4 bg-white/5 rounded" />
          </div>
          <div className="h-8 w-24 bg-white/10 rounded" />
          <div className="h-3 w-40 bg-white/5 rounded" />
        </div>
      </div>

      {/* Breakdown and Jobs Row */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="border border-white/5 rounded-2xl bg-[#101012]/40 p-6 space-y-4">
          <div className="pb-3 border-b border-white/5">
            <div className="h-3.5 w-32 bg-white/10 rounded" />
          </div>
          <div className="space-y-4">
            {["bd-1", "bd-2", "bd-3"].map((id) => (
              <div key={id} className="flex items-center justify-between">
                <div className="h-3 w-16 bg-white/5 rounded" />
                <div className="flex items-center gap-3">
                  <div className="h-1.5 w-32 bg-white/5 rounded-full" />
                  <div className="h-3 w-8 bg-white/5 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border border-white/5 rounded-2xl bg-[#101012]/40 p-6 space-y-4">
          <div className="pb-3 border-b border-white/5">
            <div className="h-3.5 w-36 bg-white/10 rounded" />
          </div>
          <div className="space-y-4">
            {["job-1", "job-2", "job-3"].map((id) => (
              <div key={id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-12 bg-white/10 rounded" />
                  <div className="h-3 w-20 bg-white/5 rounded" />
                </div>
                <div className="h-3 w-16 bg-white/5 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Feedback */}
      <div className="border border-white/5 rounded-2xl bg-[#101012]/40 p-6 space-y-4">
        <div className="pb-3 border-b border-white/5">
          <div className="h-3.5 w-28 bg-white/10 rounded" />
        </div>
        <div className="space-y-2">
          {["fb-1", "fb-2"].map((id) => (
            <div
              key={id}
              className="flex items-center justify-between p-3 border border-white/5 rounded-xl bg-zinc-950/20"
            >
              <div className="flex items-center gap-3">
                <div className="h-4.5 w-4.5 bg-white/10 rounded-full" />
                <div className="h-4 w-16 bg-white/5 rounded" />
              </div>
              <div className="h-3 w-24 bg-white/5 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AdminListSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-5 w-32 bg-white/10 rounded" />
          <div className="h-3.5 w-56 bg-white/5 rounded" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-20 bg-white/10 rounded" />
          <div className="h-8 w-24 bg-white/10 rounded" />
        </div>
      </div>

      {/* Filter controls */}
      <div className="flex items-center gap-4">
        <div className="h-9 w-64 bg-white/5 border border-white/5 rounded" />
        <div className="h-9 w-32 bg-white/5 border border-white/5 rounded" />
        <div className="h-9 w-36 bg-white/5 border border-white/5 rounded" />
      </div>

      <div className="h-[1px] bg-white/5" />

      {/* High-density rows */}
      <div className="space-y-px bg-white/5 border border-white/5 rounded-xl overflow-hidden">
        {["row-1", "row-2", "row-3", "row-4", "row-5"].map((id) => (
          <div
            key={id}
            className="flex items-center justify-between p-4 bg-[#101012]/40 relative overflow-hidden"
          >
            {/* Shimmer overlay line */}
            <div className="absolute top-0 bottom-0 left-0 w-[2px] bg-[var(--accent)]/30 animate-pulse" />
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-4 w-16 bg-white/10 rounded" />
                <div className="h-4 w-20 bg-white/5 rounded" />
              </div>
              <div className="h-4 w-[60%] bg-white/5 rounded" />
              <div className="flex items-center gap-2">
                <div className="h-3.5 w-[30%] bg-white/5 rounded" />
                <div className="h-3.5 w-3 bg-white/5 rounded-full" />
                <div className="h-3.5 w-16 bg-white/5 rounded" />
              </div>
            </div>
            <div className="flex items-center gap-2 ml-4">
              <div className="h-8 w-8 bg-white/5 rounded" />
              <div className="h-8 w-8 bg-white/5 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminSettingsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-5 w-36 bg-white/10 rounded" />
          <div className="h-3.5 w-60 bg-white/5 rounded" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-20 bg-white/10 rounded" />
          <div className="h-8 w-24 bg-white/10 rounded" />
        </div>
      </div>

      <div className="h-[1px] bg-white/5" />

      {/* Split panes settings skeletons */}
      <div className="space-y-8">
        {["sec-1", "sec-2", "sec-3"].map((sectionId) => (
          <div
            key={sectionId}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8 py-6 border-b border-white/5"
          >
            {/* Left Column: Info */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 bg-white/10 rounded" />
                <div className="h-4.5 w-24 bg-white/10 rounded" />
              </div>
              <div className="h-3.5 w-48 bg-white/5 rounded" />
            </div>

            {/* Right Column: Fields (spans 2) */}
            <div className="lg:col-span-2 space-y-4">
              {["field-1", "field-2", "field-3"].map((fieldId) => (
                <div
                  key={`${sectionId}-${fieldId}`}
                  className="flex items-center justify-between py-2 border-b border-white/[0.02] last:border-0"
                >
                  <div className="h-4 w-32 bg-white/5 rounded" />
                  <div className="h-8 w-[180px] bg-white/10 rounded" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LoadingState({ type = "messages", className }: LoadingStateProps) {
  if (type === "sidebar") {
    return <SidebarSkeleton />;
  }

  if (type === "admin-overview") {
    return <AdminOverviewSkeleton />;
  }

  if (type === "admin-list") {
    return <AdminListSkeleton />;
  }

  if (type === "admin-settings") {
    return <AdminSettingsSkeleton />;
  }

  if (type === "page") {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center w-full min-h-[80vh] p-8",
          className,
        )}
      >
        {/* Anti-Slop Skeletal Layout: Matches final layout shape, uses hairline frames instead of thick lazy pills */}
        <div className="w-full max-w-6xl flex flex-col gap-8">
          {/* Header Skeleton */}
          <div className="flex justify-between items-end border-b border-[var(--ks-rule)] pb-4">
            <div className="flex flex-col gap-2">
              <div className="w-24 h-[1px] bg-[var(--ks-kinpaku-gold)] opacity-70" />
              <h2 className="font-mono text-[11px] tracking-widest text-[var(--ks-champagne)] uppercase select-none">
                {"UETGPT // ASSEMBLING WORKSPACE"}
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-[9px] text-[var(--ks-text-muted)] tracking-wider">
                SYNCING DATA
              </span>
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--ks-verdigris-patina)] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[var(--ks-verdigris-patina)]"></span>
              </span>
            </div>
          </div>

          {/* Bento Grid Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Main Primary View Skeleton */}
            <div className="col-span-1 md:col-span-8 border border-[var(--ks-rule)] bg-[var(--surface-0)] min-h-[500px] p-6 flex flex-col justify-between relative overflow-hidden">
              {/* Subtle architectural grid background */}
              <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--ks-rule)_1px,transparent_1px),linear-gradient(to_bottom,var(--ks-rule)_1px,transparent_1px)] bg-[size:40px_40px] opacity-30" />

              {/* Technical corner accents */}
              <div className="absolute top-0 left-0 w-4 h-4 border-t border-l border-[var(--ks-kinpaku-gold)] opacity-50" />
              <div className="absolute top-0 right-0 w-4 h-4 border-t border-r border-[var(--ks-kinpaku-gold)] opacity-50" />
              <div className="absolute bottom-0 left-0 w-4 h-4 border-b border-l border-[var(--ks-kinpaku-gold)] opacity-50" />
              <div className="absolute bottom-0 right-0 w-4 h-4 border-b border-r border-[var(--ks-kinpaku-gold)] opacity-50" />

              <div className="relative z-10 space-y-6 max-w-2xl mt-4">
                {/* Hairline structural boxes instead of pills */}
                <div className="h-12 border border-[var(--ks-rule-strong)] bg-[var(--surface-1)] w-[85%] relative overflow-hidden">
                  <div className="absolute top-0 bottom-0 left-0 w-1/4 bg-[var(--ks-kinpaku-gold)] opacity-10 animate-progress" />
                </div>
                <div className="h-12 border border-[var(--ks-rule-strong)] bg-[var(--surface-1)] w-[60%] relative overflow-hidden">
                  <div
                    className="absolute top-0 bottom-0 left-0 w-1/4 bg-[var(--ks-kinpaku-gold)] opacity-10 animate-progress"
                    style={{ animationDelay: "200ms" }}
                  />
                </div>

                <div className="pt-8 space-y-4">
                  <div className="h-[1px] bg-[var(--ks-rule)] w-full relative overflow-hidden">
                    <div
                      className="absolute top-0 left-0 h-full w-24 bg-[var(--ks-verdigris-patina)] animate-progress"
                      style={{ animationDelay: "400ms" }}
                    />
                  </div>
                  <div className="h-[1px] bg-[var(--ks-rule)] w-3/4" />
                  <div className="h-[1px] bg-[var(--ks-rule)] w-1/2" />
                </div>
              </div>

              <div className="relative z-10 font-mono text-[9px] text-[var(--ks-text-muted)] flex items-center justify-between mt-8">
                <span>[ MODULE_A: LOADING ]</span>
                <span className="text-[var(--ks-kinpaku-gold)]">78%</span>
              </div>
            </div>

            {/* Secondary Column Skeletons */}
            <div className="col-span-1 md:col-span-4 flex flex-col gap-6">
              {/* Top Secondary Card (with integrated Aperture Rings) */}
              <div className="border border-[var(--ks-rule)] bg-[var(--surface-0)] min-h-[238px] p-6 flex flex-col items-center justify-center relative">
                <span className="absolute top-4 left-4 font-mono text-[8px] text-[var(--ks-text-faint)]">
                  STATUS_NODE
                </span>

                {/* Embedded Aperture Ring representing a loading submodule */}
                <div className="relative w-20 h-20 flex items-center justify-center opacity-60">
                  <svg
                    className="absolute w-full h-full animate-[spin_10s_linear_infinite]"
                    viewBox="0 0 100 100"
                  >
                    <title>Outer loading tracker ring</title>
                    <circle
                      cx="50"
                      cy="50"
                      r="48"
                      fill="none"
                      stroke="var(--ks-rule-strong)"
                      strokeWidth="1"
                      strokeDasharray="8 8"
                    />
                  </svg>
                  <svg
                    className="absolute w-[70%] h-[70%] animate-[spin_6s_linear_infinite_reverse]"
                    viewBox="0 0 100 100"
                  >
                    <title>Inner loading progress ring</title>
                    <circle
                      cx="50"
                      cy="50"
                      r="48"
                      fill="none"
                      stroke="var(--ks-kinpaku-gold)"
                      strokeWidth="1"
                      strokeDasharray="30 15"
                      className="opacity-50"
                    />
                  </svg>
                  <div className="w-1.5 h-1.5 bg-[var(--ks-verdigris-patina)] animate-ping rounded-full" />
                </div>
              </div>

              {/* Bottom Secondary Card */}
              <div className="border border-[var(--ks-rule)] bg-[var(--surface-0)] min-h-[238px] p-6 flex flex-col justify-between">
                <div>
                  <div className="w-12 h-[1px] bg-[var(--ks-rule-strong)] mb-6" />
                  <div className="space-y-4">
                    {/* Hairline rows */}
                    <div className="flex justify-between items-center border-b border-[var(--ks-rule)] pb-2">
                      <div className="w-1/2 h-2 border border-[var(--ks-rule-strong)]" />
                      <div className="w-4 h-2 border border-[var(--ks-rule)]" />
                    </div>
                    <div className="flex justify-between items-center border-b border-[var(--ks-rule)] pb-2">
                      <div className="w-2/3 h-2 border border-[var(--ks-rule-strong)]" />
                      <div className="w-4 h-2 border border-[var(--ks-rule)]" />
                    </div>
                    <div className="flex justify-between items-center border-b border-[var(--ks-rule)] pb-2">
                      <div className="w-1/3 h-2 border border-[var(--ks-rule-strong)]" />
                      <div className="w-4 h-2 border border-[var(--ks-rule)]" />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-4">
                  <div className="w-2 h-2 bg-[var(--ks-rule-strong)] animate-pulse" />
                  <span className="font-mono text-[8px] text-[var(--ks-text-muted)]">
                    AWAITING_STREAM
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <MessageSkeleton isUser />
      <MessageSkeleton isUser={false} />
      <MessageSkeleton isUser={false} />
      <MessageSkeleton isUser />
      <MessageSkeleton isUser={false} />
    </div>
  );
}
