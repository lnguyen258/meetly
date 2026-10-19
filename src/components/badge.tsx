import type { EventStatus } from "@/lib/types";

const STYLES: Record<string, string> = {
  collecting: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  proposed: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  confirmed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  cancelled: "bg-neutral-500/15 text-neutral-600 dark:text-neutral-300",
  neutral: "bg-surface-muted text-muted",
  action: "bg-accent-soft text-accent",
};

const LABELS: Record<EventStatus, string> = {
  collecting: "Collecting availability",
  proposed: "Time proposed",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
};

export function StatusBadge({ status }: { status: EventStatus }) {
  return <Badge tone={status}>{LABELS[status]}</Badge>;
}

export function Badge({ tone = "neutral", children }: { tone?: string; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[tone] ?? STYLES.neutral}`}
    >
      {children}
    </span>
  );
}
