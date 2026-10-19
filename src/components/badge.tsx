import type { EventStatus } from "@/lib/types";

const STYLES: Record<string, string> = {
  collecting:
    "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700/60 dark:bg-amber-500/15 dark:text-amber-200",
  proposed:
    "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-700/60 dark:bg-sky-500/15 dark:text-sky-200",
  confirmed:
    "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700/60 dark:bg-emerald-500/15 dark:text-emerald-200",
  cancelled: "border-border bg-surface-muted text-muted",
  neutral: "border-border bg-surface-muted text-muted",
  action: "border-brand/50 bg-brand/15 text-[#7a4100] dark:text-[#ffc266]",
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
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium ${STYLES[tone] ?? STYLES.neutral}`}
    >
      {children}
    </span>
  );
}
