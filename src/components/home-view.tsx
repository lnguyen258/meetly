"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarPlus, ChevronRight, Plus, Repeat } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/components/user-context";
import { Badge, StatusBadge } from "@/components/badge";
import { EmptyState, PageHeader } from "@/components/page-header";
import { fmtDuration, fmtRange } from "@/lib/format";
import { parseDateOnly } from "@/lib/time";
import type { Approval, MeetEvent } from "@/lib/types";

type Row = { has_shared: boolean; approval: Approval; events: MeetEvent };

const STRIPE: Record<string, string> = {
  collecting: "border-l-amber-400",
  proposed: "border-l-sky-500",
  confirmed: "border-l-success",
  cancelled: "border-l-border",
};

function EventRow({ row, userId }: { row: Row; userId: string }) {
  const e = row.events;
  const host = e.owner_id === userId;
  const needsAvailability = e.status === "collecting" && !row.has_shared;
  const needsApproval = e.status === "proposed" && !host && row.approval === "pending";
  const cta = needsAvailability ? "Share availability" : needsApproval ? "Review time" : null;
  return (
    <li>
      <Link
        href={`/events/${e.id}`}
        className={`flex items-center gap-3 border-l-4 px-4 py-3 transition hover:bg-surface-muted ${STRIPE[e.status]}`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="truncate font-semibold">{e.title}</h3>
            {host && <Badge tone="action">Host</Badge>}
            {e.kind === "weekly" && (
              <Badge>
                <Repeat className="mr-1 size-3" /> Weekly
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-sm text-muted">
            {e.final_start && e.final_end
              ? fmtRange(e.final_start, e.final_end)
              : `Week of ${parseDateOnly(e.week_start).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${fmtDuration(e.duration_min)}`}
          </p>
        </div>
        <StatusBadge status={e.status} />
        {cta ? (
          <span className="btn-primary pointer-events-none hidden !py-1 sm:inline-flex">{cta}</span>
        ) : (
          <ChevronRight className="size-4 text-muted" />
        )}
      </Link>
    </li>
  );
}

function Section({
  title,
  rows,
  userId,
  highlight,
}: {
  title: string;
  rows: Row[];
  userId: string;
  highlight?: boolean;
}) {
  if (!rows.length) return null;
  return (
    <section className={`card mb-4 overflow-hidden ${highlight ? "border-brand/60" : ""}`}>
      <h2
        className={`border-b px-4 py-2 text-sm font-semibold ${
          highlight ? "border-brand/40 bg-brand/15" : "border-border bg-surface-muted"
        }`}
      >
        {title} <span className="font-normal text-muted">({rows.length})</span>
      </h2>
      <ul className="divide-y divide-border">
        {rows.map((r) => (
          <EventRow key={r.events.id} row={r} userId={userId} />
        ))}
      </ul>
    </section>
  );
}

export default function HomeView() {
  const supabase = useMemo(() => createClient(), []);
  const { userId } = useUser();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [now] = useState(() => Date.now());

  const fetchRows = useCallback(async () => {
    const { data } = await supabase
      .from("event_members")
      .select("has_shared, approval, events!inner(*)")
      .eq("user_id", userId);
    return (data ?? []) as unknown as Row[];
  }, [supabase, userId]);

  useEffect(() => {
    let active = true;
    fetchRows().then((r) => active && setRows(r));
    const refresh = () => fetchRows().then((r) => active && setRows(r));
    const channel = supabase
      .channel(`home:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_members", filter: `user_id=eq.${userId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, refresh)
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [supabase, userId, fetchRows]);

  const groups = useMemo(() => {
    const live = (rows ?? []).filter((r) => r.events.status !== "cancelled");
    const action = live.filter(
      (r) =>
        (r.events.status === "collecting" && !r.has_shared) ||
        (r.events.status === "proposed" && r.events.owner_id !== userId && r.approval === "pending"),
    );
    const actionIds = new Set(action.map((r) => r.events.id));
    const rest = live.filter((r) => !actionIds.has(r.events.id));
    return {
      action,
      hosting: rest.filter((r) => r.events.owner_id === userId && r.events.status !== "confirmed"),
      upcoming: rest
        .filter((r) => r.events.status === "confirmed" && (r.events.kind === "weekly" || new Date(r.events.final_end!).getTime() >= now))
        .sort((a, b) => +new Date(a.events.final_start!) - +new Date(b.events.final_start!)),
      waiting: rest.filter((r) => r.events.owner_id !== userId && r.events.status !== "confirmed"),
    };
  }, [rows, userId, now]);

  const empty = rows && !groups.action.length && !groups.hosting.length && !groups.upcoming.length && !groups.waiting.length;

  return (
    <>
      <PageHeader
        title="Home"
        subtitle="Your upcoming meetings and scheduling requests."
      />

      {rows === null && <div className="h-32 animate-pulse rounded-lg bg-border" />}
      {empty && (
        <EmptyState
          icon={CalendarPlus}
          title="No meetings yet"
          body="Create an event, invite your team, and see everyone's availability in one place."
          action={
            <Link href="/events/new" className="btn-primary">
              <Plus className="size-4" /> Create your first event
            </Link>
          }
        />
      )}
      <Section title="Needs your attention" rows={groups.action} userId={userId} highlight />
      <Section title="Upcoming" rows={groups.upcoming} userId={userId} />
      <Section title="You are hosting" rows={groups.hosting} userId={userId} />
      <Section title="Waiting on the host" rows={groups.waiting} userId={userId} />
    </>
  );
}
