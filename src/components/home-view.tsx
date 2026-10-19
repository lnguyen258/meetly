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

function EventCard({ row, userId }: { row: Row; userId: string }) {
  const e = row.events;
  const host = e.owner_id === userId;
  const needsAvailability = e.status === "collecting" && !row.has_shared;
  const needsApproval = e.status === "proposed" && !host && row.approval === "pending";
  return (
    <Link
      href={`/events/${e.id}`}
      className="card group flex items-center gap-4 p-4 transition hover:border-accent/50 hover:shadow-md"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate font-medium">{e.title}</h3>
          {host && <Badge tone="action">Host</Badge>}
          {e.kind === "weekly" && (
            <Badge>
              <Repeat className="mr-1 size-3" /> Weekly
            </Badge>
          )}
        </div>
        <p className="mt-1 text-sm text-muted">
          {e.final_start && e.final_end
            ? fmtRange(e.final_start, e.final_end)
            : `Week of ${parseDateOnly(e.week_start).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${fmtDuration(e.duration_min)}`}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <StatusBadge status={e.status} />
          {needsAvailability && <Badge tone="action">Share your availability</Badge>}
          {needsApproval && <Badge tone="action">Approve the time</Badge>}
        </div>
      </div>
      <ChevronRight className="size-5 text-muted transition group-hover:translate-x-0.5" />
    </Link>
  );
}

function Section({ title, rows, userId }: { title: string; rows: Row[]; userId: string }) {
  if (!rows.length) return null;
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
      <div className="grid gap-3">
        {rows.map((r) => (
          <EventCard key={r.events.id} row={r} userId={userId} />
        ))}
      </div>
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
        action={
          <Link href="/events/new" className="btn-primary">
            <Plus className="size-4" />
            New event
          </Link>
        }
      />

      {rows === null && <div className="h-32 animate-pulse rounded-2xl bg-surface-muted" />}
      {empty && (
        <EmptyState
          icon={CalendarPlus}
          title="No meetings yet"
          body="Create an event, invite your team, and see everyone's availability in one place."
        />
      )}
      <Section title="Needs your attention" rows={groups.action} userId={userId} />
      <Section title="Upcoming" rows={groups.upcoming} userId={userId} />
      <Section title="You are hosting" rows={groups.hosting} userId={userId} />
      <Section title="Waiting on the host" rows={groups.waiting} userId={userId} />
    </>
  );
}
