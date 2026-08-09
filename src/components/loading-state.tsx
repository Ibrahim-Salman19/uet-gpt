import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type LoadingStateType =
  | "messages"
  | "sidebar"
  | "page"
  | "admin-overview"
  | "admin-list"
  | "admin-settings";

export interface LoadingStateProps {
  type?: LoadingStateType;
  className?: string;
  /** Accessible status text. Visual skeleton copy remains unchanged. */
  label?: string;
}

interface SkeletonProps {
  className?: string;
  label: string;
}

const SIDEBAR_ITEMS = [
  "chat_workspace",
  "explore_rag",
  "syllabi_db",
  "campus_map",
  "settings_config",
  "system_status",
] as const;

const MESSAGE_SEQUENCE = [true, false, false, true, false] as const;
const ADMIN_BREAKDOWN_ROWS = ["documents", "chunks", "sources"] as const;
const ADMIN_JOB_ROWS = ["crawler", "indexer", "embeddings"] as const;
const ADMIN_LIST_ROWS = ["01", "02", "03", "04", "05"] as const;
const ADMIN_SETTING_GROUPS = ["retrieval", "generation", "operations"] as const;
const ADMIN_SETTING_FIELDS = ["primary", "secondary"] as const;

const DEFAULT_LABELS: Record<LoadingStateType, string> = {
  messages: "Loading conversation",
  sidebar: "Loading navigation",
  page: "Loading page",
  "admin-overview": "Loading admin overview",
  "admin-list": "Loading admin documents",
  "admin-settings": "Loading admin settings",
};

function StatusDot({ ping = true }: { ping?: boolean }) {
  return (
    <span className="relative flex h-1.5 w-1.5 shrink-0" aria-hidden="true">
      {ping ? (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--ks-verdigris-patina)] opacity-70 motion-reduce:animate-none" />
      ) : null}
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--ks-verdigris-patina)]" />
    </span>
  );
}

function ShimmerLine({ className, delay = 0 }: { className?: string; delay?: number }) {
  return (
    <div className={cn("relative h-px overflow-hidden bg-[var(--ks-rule)]", className)}>
      <div
        className="absolute inset-y-0 left-0 w-1/3 animate-progress bg-[var(--ks-kinpaku-gold)] opacity-70 motion-reduce:animate-none"
        style={delay ? { animationDelay: `${delay}ms` } : undefined}
      />
    </div>
  );
}

function LoadingRegion({ label, className, children }: SkeletonProps & { children: ReactNode }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-atomic="true"
      className={className}
      data-loading-state="true"
    >
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="contents">
        {children}
      </div>
    </div>
  );
}

function MessageSkeleton({ isUser }: { isUser: boolean }) {
  const lineWidths = isUser ? ["w-[82%]", "w-[61%]", "w-[38%]"] : ["w-[94%]", "w-[78%]", "w-[56%]"];

  return (
    <div className="mx-auto flex w-full max-w-5xl items-start gap-3 border-b border-[var(--ks-rule)] px-4 py-5 sm:gap-5 sm:px-6 sm:py-6">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[var(--ks-rule-strong)] bg-[var(--surface-0)] font-mono text-[9px] text-[var(--ks-text-muted)] select-none">
        {isUser ? "USR" : "SYS"}
      </div>

      <div className="flex min-w-0 flex-1 flex-col items-start gap-3.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[9px] tracking-widest text-[var(--ks-text-muted)] uppercase select-none">
          <span>{isUser ? "USER" : "UETGPT"}</span>
          <span className="text-[var(--ks-text-faint)]">//</span>
          <span className="animate-pulse font-semibold text-[var(--accent)] motion-reduce:animate-none">
            {isUser ? "LOADING_MESSAGE" : "PROCESSING_CONTEXT"}
          </span>
        </div>

        <div className="w-full space-y-2.5">
          {lineWidths.map((width, index) => (
            <ShimmerLine
              key={`${isUser ? "user" : "assistant"}-${width}`}
              className={width}
              delay={index * 140}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function MessagesSkeleton({ className, label }: SkeletonProps) {
  return (
    <LoadingRegion label={label} className={cn("flex min-w-0 flex-col", className)}>
      {MESSAGE_SEQUENCE.map((isUser, index) => (
        <MessageSkeleton key={`message-${index}`} isUser={isUser} />
      ))}
    </LoadingRegion>
  );
}

function SidebarSkeleton({ className, label }: SkeletonProps) {
  return (
    <LoadingRegion
      label={label}
      className={cn(
        "flex h-full min-h-[400px] min-w-0 flex-col border-r border-[var(--ks-rule)] bg-[var(--surface-1)]",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-[var(--ks-rule)] p-4">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[2px] border border-[var(--ks-rule-strong)]">
            <span className="font-mono text-[8px] text-[var(--ks-kinpaku-gold)] select-none">
              UET
            </span>
          </div>
          <span className="truncate font-mono text-[10px] font-bold tracking-wider text-[var(--ks-champagne)] select-none">
            UETGPT // NAV
          </span>
        </div>
        <StatusDot />
      </div>

      <div className="mt-2 flex flex-col gap-1.5 p-3">
        {SIDEBAR_ITEMS.map((item, index) => (
          <div
            key={item}
            className="flex min-w-0 items-center justify-between gap-3 rounded-[2px] border border-[var(--ks-rule)] bg-[var(--surface-0)] p-2.5"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="shrink-0 font-mono text-[9px] text-[var(--ks-kinpaku-gold)] opacity-70">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="truncate font-mono text-[9px] tracking-wider text-[var(--ks-text-muted)] uppercase select-none">
                {item}
              </span>
            </div>
            <div className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-[1px] bg-[var(--ks-rule-strong)] motion-reduce:animate-none" />
          </div>
        ))}
      </div>

      <div className="mt-auto border-t border-[var(--ks-rule)] bg-[var(--ks-lacquer-deep)] p-4">
        <div className="font-mono text-[8px] leading-relaxed text-[var(--ks-text-faint)] select-none">
          SECURE CONNECTION // READY
          <br />
          APP SHELL // INITIALIZING
          <br />
          CONVEX // CONNECTING
        </div>
      </div>
    </LoadingRegion>
  );
}

function MetricCard({
  title,
  value = "-- // --",
  className,
  status,
  progress = false,
}: {
  title: string;
  value?: string;
  className?: string;
  status?: string;
  progress?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative space-y-4 overflow-hidden rounded-xl border border-[var(--ks-rule)] bg-[var(--surface-0)] p-5",
        className,
      )}
    >
      <div className="flex min-w-0 items-center justify-between gap-3 font-mono text-[9px] text-[var(--ks-text-muted)] uppercase">
        <span className="truncate">{title}</span>
        {status ? (
          <span className="shrink-0 animate-pulse text-[var(--accent)] motion-reduce:animate-none">
            {status}
          </span>
        ) : null}
      </div>
      <div className="font-mono text-xl text-[var(--ks-champagne)]">{value}</div>
      {progress ? <ShimmerLine className="w-full" /> : null}
    </div>
  );
}

function AdminOverviewSkeleton({ className, label }: SkeletonProps) {
  return (
    <LoadingRegion label={label} className={cn("space-y-6", className)}>
      <div className="flex items-center justify-between border-b border-[var(--ks-rule)] pb-2">
        <h2 className="font-mono text-[10px] tracking-widest text-[var(--ks-champagne)] uppercase select-none">
          ADMIN // SYSTEM_OVERVIEW
        </h2>
        <StatusDot />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="CRAWL_ACTIVITY_METRICS"
          value="SYNCING // DATA"
          status="LIVE"
          progress
          className="lg:col-span-2"
        />
        <MetricCard title="DOCUMENT_COUNT" />
        <MetricCard title="ACTIVE_JOBS" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="SYSTEM_CPU" />
        <MetricCard title="MEMORY_POOL" />
        <MetricCard
          title="VECTOR_INDEX_LOAD"
          value="CALCULATING..."
          status="RESOLVING"
          progress
          className="lg:col-span-2"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="space-y-4 rounded-xl border border-[var(--ks-rule)] bg-[var(--surface-0)] p-5 sm:p-6">
          <div className="border-b border-[var(--ks-rule)] pb-3 font-mono text-[9px] text-[var(--ks-champagne)] uppercase">
            DATABASE_BREAKDOWN
          </div>
          <div className="space-y-4">
            {ADMIN_BREAKDOWN_ROWS.map((row, index) => (
              <div key={row} className="flex min-w-0 items-center justify-between gap-4">
                <div className="truncate font-mono text-[9px] text-[var(--ks-text-muted)] uppercase">
                  SEC_{String(index + 1).padStart(2, "0")} // {row}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <ShimmerLine className="w-16 sm:w-24" delay={index * 140} />
                  <div className="font-mono text-[9px] text-[var(--ks-text-muted)]">--</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4 rounded-xl border border-[var(--ks-rule)] bg-[var(--surface-0)] p-5 sm:p-6">
          <div className="border-b border-[var(--ks-rule)] pb-3 font-mono text-[9px] text-[var(--ks-champagne)] uppercase">
            CRAWLER_TELEMETRY
          </div>
          <div className="space-y-4">
            {ADMIN_JOB_ROWS.map((row, index) => (
              <div key={row} className="flex min-w-0 items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="shrink-0 font-mono text-[9px] text-[var(--ks-kinpaku-gold)] uppercase">
                    [PENDING]
                  </span>
                  <span className="truncate font-mono text-[9px] text-[var(--ks-text-muted)] uppercase">
                    NODE_{String(index + 1).padStart(2, "0")} // {row}
                  </span>
                </div>
                <div className="shrink-0 font-mono text-[9px] text-[var(--ks-text-muted)]">--</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </LoadingRegion>
  );
}

function AdminListSkeleton({ className, label }: SkeletonProps) {
  return (
    <LoadingRegion label={label} className={cn("space-y-6", className)}>
      <div className="flex items-center justify-between border-b border-[var(--ks-rule)] pb-4">
        <div className="min-w-0 space-y-2">
          <h2 className="font-mono text-[10px] tracking-widest text-[var(--ks-champagne)] uppercase select-none">
            ADMIN // DOCUMENT_LIST
          </h2>
          <p className="font-mono text-[9px] text-[var(--ks-text-muted)] uppercase">
            RETRIEVING FILES FROM CONVEX
          </p>
        </div>
        <StatusDot />
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,16rem)_8rem] sm:gap-4">
        <div className="h-9 min-w-0 rounded-[2px] border border-[var(--ks-rule)] bg-[var(--surface-0)]" />
        <div className="h-9 min-w-0 rounded-[2px] border border-[var(--ks-rule)] bg-[var(--surface-0)]" />
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--ks-rule)] bg-[var(--surface-0)]">
        {ADMIN_LIST_ROWS.map((row, index) => (
          <div
            key={row}
            className="relative flex min-w-0 items-center justify-between overflow-hidden border-b border-[var(--ks-rule)] bg-[var(--surface-0)] p-4 last:border-b-0"
          >
            <div className="absolute inset-y-0 left-0 w-0.5 animate-pulse bg-[var(--accent)] opacity-30 motion-reduce:animate-none" />
            <div className="min-w-0 flex-1 space-y-2 pl-1">
              <div className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 font-mono text-[9px] text-[var(--accent)] uppercase">
                  DOC_{row}
                </span>
                <span className="truncate font-mono text-[9px] text-[var(--ks-text-muted)] uppercase">
                  // SCANNING_INDEX
                </span>
              </div>
              <ShimmerLine
                className={cn(
                  "max-w-full",
                  index % 3 === 0 ? "w-2/3" : index % 3 === 1 ? "w-4/5" : "w-1/2",
                )}
                delay={index * 90}
              />
            </div>
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}

function AdminSettingsSkeleton({ className, label }: SkeletonProps) {
  return (
    <LoadingRegion label={label} className={cn("space-y-6", className)}>
      <div className="flex items-center justify-between border-b border-[var(--ks-rule)] pb-4">
        <div className="min-w-0 space-y-2">
          <h2 className="font-mono text-[10px] tracking-widest text-[var(--ks-champagne)] uppercase select-none">
            ADMIN // SYSTEM_CONFIG
          </h2>
          <p className="font-mono text-[9px] text-[var(--ks-text-muted)] uppercase">
            RETRIEVING ENVIRONMENT PARAMETERS
          </p>
        </div>
        <StatusDot />
      </div>

      <div className="divide-y divide-[var(--ks-rule)]">
        {ADMIN_SETTING_GROUPS.map((group, groupIndex) => (
          <section
            key={group}
            className="grid grid-cols-1 gap-5 py-6 first:pt-0 last:pb-0 lg:grid-cols-3 lg:gap-8"
          >
            <div className="space-y-2">
              <div className="font-mono text-[9px] text-[var(--accent)] uppercase">
                [PARAM_GROUP_{groupIndex + 1}] // {group}
              </div>
              <div className="font-mono text-[9px] text-[var(--ks-text-muted)] uppercase">
                RESOLVING_DEPENDENCIES
              </div>
            </div>

            <div className="space-y-1 lg:col-span-2">
              {ADMIN_SETTING_FIELDS.map((field, fieldIndex) => (
                <div
                  key={`${group}-${field}`}
                  className="flex flex-col gap-3 border-b border-[var(--ks-rule)] py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
                >
                  <div className="font-mono text-[9px] text-[var(--ks-text-muted)] uppercase">
                    KEY_VAR_{groupIndex + 1}_{String(fieldIndex + 1).padStart(2, "0")}
                  </div>
                  <div className="h-8 w-full rounded-[2px] border border-[var(--ks-rule)] bg-[var(--surface-0)] sm:w-[180px]" />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </LoadingRegion>
  );
}

function PageSkeleton({ className, label }: SkeletonProps) {
  return (
    <LoadingRegion
      label={label}
      className={cn(
        "flex min-h-[80vh] w-full flex-col items-center justify-center p-4 sm:p-6 lg:p-8",
        className,
      )}
    >
      <div className="flex w-full max-w-6xl flex-col gap-6 sm:gap-8">
        <div className="flex flex-col gap-4 border-b border-[var(--ks-rule)] pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="h-px w-24 bg-[var(--ks-kinpaku-gold)] opacity-70" />
            <h2 className="font-mono text-[11px] tracking-widest text-[var(--ks-champagne)] uppercase select-none">
              UETGPT // ASSEMBLING WORKSPACE
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[9px] tracking-wider text-[var(--ks-text-muted)]">
              SYNCING DATA
            </span>
            <StatusDot />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-12">
          <section className="relative col-span-1 flex min-h-[420px] flex-col justify-between overflow-hidden border border-[var(--ks-rule)] bg-[var(--surface-0)] p-5 sm:min-h-[500px] sm:p-6 md:col-span-8">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--ks-rule)_1px,transparent_1px),linear-gradient(to_bottom,var(--ks-rule)_1px,transparent_1px)] bg-[size:40px_40px] opacity-30" />

            <div className="absolute top-0 left-0 h-4 w-4 border-t border-l border-[var(--ks-kinpaku-gold)] opacity-50" />
            <div className="absolute top-0 right-0 h-4 w-4 border-t border-r border-[var(--ks-kinpaku-gold)] opacity-50" />
            <div className="absolute bottom-0 left-0 h-4 w-4 border-b border-l border-[var(--ks-kinpaku-gold)] opacity-50" />
            <div className="absolute right-0 bottom-0 h-4 w-4 border-r border-b border-[var(--ks-kinpaku-gold)] opacity-50" />

            <div className="relative z-10 mt-4 max-w-2xl space-y-6">
              <div className="relative h-12 w-[85%] overflow-hidden border border-[var(--ks-rule-strong)] bg-[var(--surface-1)]">
                <div className="absolute inset-y-0 left-0 w-1/4 animate-progress bg-[var(--ks-kinpaku-gold)] opacity-10 motion-reduce:animate-none" />
              </div>
              <div className="relative h-12 w-[60%] overflow-hidden border border-[var(--ks-rule-strong)] bg-[var(--surface-1)]">
                <div
                  className="absolute inset-y-0 left-0 w-1/4 animate-progress bg-[var(--ks-kinpaku-gold)] opacity-10 motion-reduce:animate-none"
                  style={{ animationDelay: "200ms" }}
                />
              </div>

              <div className="space-y-4 pt-8">
                <ShimmerLine className="w-full" delay={400} />
                <div className="h-px w-3/4 bg-[var(--ks-rule)]" />
                <div className="h-px w-1/2 bg-[var(--ks-rule)]" />
              </div>
            </div>

            <div className="relative z-10 mt-8 flex items-center justify-between gap-4 font-mono text-[9px] text-[var(--ks-text-muted)]">
              <span>[ MODULE_A: LOADING ]</span>
              <span className="text-[var(--ks-kinpaku-gold)]">INITIALIZING</span>
            </div>
          </section>

          <div className="col-span-1 flex flex-col gap-4 sm:gap-6 md:col-span-4">
            <section className="relative flex min-h-[210px] flex-col items-center justify-center border border-[var(--ks-rule)] bg-[var(--surface-0)] p-6 sm:min-h-[238px]">
              <span className="absolute top-4 left-4 font-mono text-[8px] text-[var(--ks-text-faint)]">
                STATUS_NODE
              </span>

              <div className="relative flex h-20 w-20 items-center justify-center opacity-60">
                <svg
                  className="absolute h-full w-full animate-[spin_10s_linear_infinite] motion-reduce:animate-none"
                  viewBox="0 0 100 100"
                  focusable="false"
                >
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
                  className="absolute h-[70%] w-[70%] animate-[spin_6s_linear_infinite_reverse] motion-reduce:animate-none"
                  viewBox="0 0 100 100"
                  focusable="false"
                >
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
                <StatusDot />
              </div>
            </section>

            <section className="flex min-h-[210px] flex-col justify-between border border-[var(--ks-rule)] bg-[var(--surface-0)] p-6 sm:min-h-[238px]">
              <div>
                <div className="mb-6 h-px w-12 bg-[var(--ks-rule-strong)]" />
                <div className="space-y-4">
                  {["w-1/2", "w-2/3", "w-1/3"].map((width) => (
                    <div
                      key={width}
                      className="flex items-center justify-between gap-4 border-b border-[var(--ks-rule)] pb-2"
                    >
                      <div className={cn("h-2 border border-[var(--ks-rule-strong)]", width)} />
                      <div className="h-2 w-4 border border-[var(--ks-rule)]" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <div className="h-2 w-2 animate-pulse bg-[var(--ks-rule-strong)] motion-reduce:animate-none" />
                <span className="font-mono text-[8px] text-[var(--ks-text-muted)]">
                  AWAITING_STREAM
                </span>
              </div>
            </section>
          </div>
        </div>
      </div>
    </LoadingRegion>
  );
}

export function LoadingState({
  type = "messages",
  className,
  label = DEFAULT_LABELS[type],
}: LoadingStateProps) {
  switch (type) {
    case "sidebar":
      return <SidebarSkeleton className={className} label={label} />;
    case "page":
      return <PageSkeleton className={className} label={label} />;
    case "admin-overview":
      return <AdminOverviewSkeleton className={className} label={label} />;
    case "admin-list":
      return <AdminListSkeleton className={className} label={label} />;
    case "admin-settings":
      return <AdminSettingsSkeleton className={className} label={label} />;
    case "messages":
    default:
      return <MessagesSkeleton className={className} label={label} />;
  }
}
