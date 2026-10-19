"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarCheck,
  Check,
  Copy,
  MessageCircle,
  Repeat,
  Send,
  Sparkles,
  UserMinus,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/components/user-context";
import { WeekGrid, type HeatCell } from "@/components/week-grid";
import { Badge, StatusBadge } from "@/components/badge";
import { bestWindows } from "@/lib/heatmap";
import { freeSlotsFromCalendar } from "@/lib/availability";
import { loadCalendarItems } from "@/lib/sync";
import { fmtDuration, fmtRange } from "@/lib/format";
import { parseDateOnly } from "@/lib/time";
import type { EventMember, HeatRow, MeetEvent } from "@/lib/types";

type Tab = "availability" | "group" | "people";

export default function EventView({ id }: { id: string }) {
  const supabase = useMemo(() => createClient(), []);
  const { userId } = useUser();
  const router = useRouter();

  const [event, setEvent] = useState<MeetEvent | null>(null);
  const [members, setMembers] = useState<EventMember[]>([]);
  const [heat, setHeat] = useState<Map<number, HeatCell>>(new Map());
  const [loaded, setLoaded] = useState(false);
  const [missing, setMissing] = useState(false);
  const [tab, setTab] = useState<Tab | null>(null);

  // availability editor state
  const [draft, setDraft] = useState<Set<number>>(new Set());
  const [dirty, setDirty] = useState(false);
  const [sync, setSync] = useState(true);
  const [prefilled, setPrefilled] = useState(false);
  const [saving, setSaving] = useState(false);

  const [candidate, setCandidate] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const flash = (text: string, error = false) => setNotice({ text, error });

  const dirtyRef = useRef(false);
  const markDirty = (v: boolean) => {
    dirtyRef.current = v;
    setDirty(v);
  };

  // Pure fetch (no state updates) so it can be used from effects and callbacks alike.
  const fetchAll = useCallback(async () => {
    const [ev, mem, hm, mine] = await Promise.all([
      supabase.from("events").select("*").eq("id", id).maybeSingle(),
      supabase.from("event_members").select("*, profiles(display_name)").eq("event_id", id),
      supabase.rpc("event_heatmap", { eid: id }),
      supabase.from("availability_slots").select("slot_start").eq("event_id", id),
    ]);
    const event = (ev.data as MeetEvent | null) ?? null;
    const members = (mem.data ?? []) as EventMember[];
    const me = members.find((m) => m.user_id === userId);
    let prefill: number[] | null = null;
    if (event && me && !me.has_shared) {
      const items = await loadCalendarItems(supabase);
      prefill = freeSlotsFromCalendar(items, parseDateOnly(event.week_start), id);
    }
    return {
      event,
      members,
      me,
      heat: (hm.data ?? []) as HeatRow[],
      mine: (mine.data ?? []).map((r: { slot_start: string }) => new Date(r.slot_start).getTime()),
      prefill,
    };
  }, [supabase, id, userId]);

  const apply = useCallback((d: Awaited<ReturnType<typeof fetchAll>>) => {
    setLoaded(true);
    if (!d.event) return setMissing(true);
    setEvent(d.event);
    setMembers(d.members);
    setHeat(
      new Map(
        d.heat.map((r) => [new Date(r.slot_start).getTime(), { count: Number(r.free_count), names: r.free_names }]),
      ),
    );
    if (dirtyRef.current) return; // never clobber unsaved edits
    setSync(d.me?.auto_sync ?? true);
    if (d.me?.has_shared) {
      setDraft(new Set(d.mine));
      setPrefilled(false);
    } else if (d.prefill) {
      setDraft(new Set(d.prefill));
      setPrefilled(true);
    }
  }, []);

  const load = useCallback(() => fetchAll().then(apply), [fetchAll, apply]);

  useEffect(() => {
    let active = true;
    fetchAll()
      .then((d) => active && apply(d))
      .catch(() => active && (setLoaded(true), setMissing(true)));
    const refresh = () => active && load();
    const channel = supabase
      .channel(`event:${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_members", filter: `event_id=eq.${id}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "events", filter: `id=eq.${id}` }, refresh)
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [supabase, id, fetchAll, apply, load]);

  const me = members.find((m) => m.user_id === userId);
  const isHost = event?.owner_id === userId;
  const weekStart = event ? parseDateOnly(event.week_start) : new Date();
  const closed = event?.status === "confirmed" || event?.status === "cancelled";
  const activeTab: Tab = tab ?? (me && !me.has_shared && !closed ? "availability" : "group");

  const counts = useMemo(() => {
    const m = new Map<number, number>();
    heat.forEach((v, k) => m.set(k, v.count));
    return m;
  }, [heat]);
  const suggestions = useMemo(
    () => (event ? bestWindows(counts, event.duration_min, 5) : []),
    [counts, event],
  );

  async function saveAvailability() {
    if (!event) return;
    setSaving(true);
    const { error } = await supabase.rpc("submit_availability", {
      eid: id,
      slots: [...draft].map((ms) => new Date(ms).toISOString()),
      sync,
    });
    setSaving(false);
    if (error) return flash(error.message, true);
    markDirty(false);
    setPrefilled(false);
    flash("Availability saved. Your team sees it live.");
    load();
  }

  async function fillFromCalendar() {
    if (!event) return;
    const items = await loadCalendarItems(supabase);
    setDraft(new Set(freeSlotsFromCalendar(items, weekStart, id)));
    markDirty(true);
  }

  async function toggleSync(on: boolean) {
    setSync(on);
    if (on) await fillFromCalendar();
  }

  async function rpc(name: string, args: Record<string, unknown>, okMsg: string) {
    setBusy(true);
    const { error } = await supabase.rpc(name, args);
    setBusy(false);
    if (error) flash(error.message, true);
    else flash(okMsg);
    await load();
  }

  if (!loaded) return <div className="h-40 animate-pulse rounded-2xl bg-surface-muted" />;
  if (missing || !event) {
    return (
      <div className="card p-10 text-center">
        <h1 className="text-lg font-semibold">Event not found</h1>
        <p className="mt-1 text-sm text-muted">It may have been removed, or you are not a member.</p>
        <Link href="/home" className="btn-secondary mt-5">
          Back home
        </Link>
      </div>
    );
  }

  const sharedCount = members.filter((m) => m.has_shared).length;
  const proposed = event.final_start && event.final_end;
  const highlight = candidate
    ? { start: candidate, durationMin: event.duration_min }
    : proposed
      ? { start: new Date(event.final_start!).getTime(), durationMin: event.duration_min }
      : null;

  return (
    <>
      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={event.status} />
          {event.kind === "weekly" && (
            <Badge>
              <Repeat className="mr-1 size-3" /> Every week
            </Badge>
          )}
          <Badge>{fmtDuration(event.duration_min)}</Badge>
          <Badge>Week of {weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</Badge>
        </div>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">{event.title}</h1>
        {event.description && <p className="mt-1 max-w-2xl text-sm text-muted">{event.description}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/chat/${id}`} className="btn-secondary">
            <MessageCircle className="size-4" /> Chat
          </Link>
          {isHost && event.status !== "cancelled" && (
            <button
              className="btn text-danger hover:bg-danger/10"
              disabled={busy}
              onClick={() => confirm("Cancel this event for everyone?") && rpc("cancel_event", { eid: id }, "Event cancelled.")}
            >
              Cancel event
            </button>
          )}
          {!isHost && (
            <button
              className="btn text-muted hover:bg-surface-muted"
              onClick={async () => {
                if (!confirm("Leave this event?")) return;
                await supabase.from("event_members").delete().eq("event_id", id).eq("user_id", userId);
                router.push("/home");
              }}
            >
              Leave
            </button>
          )}
        </div>
      </header>

      {notice && (
        <p
          role="status"
          className={`mb-4 rounded-xl px-3.5 py-2.5 text-sm ${
            notice.error ? "bg-danger/10 text-danger" : "bg-accent-soft text-accent"
          }`}
        >
          {notice.text}
        </p>
      )}

      {proposed && event.status !== "cancelled" && (
        <ProposalCard
          event={event}
          me={me}
          isHost={isHost}
          members={members}
          busy={busy}
          onRespond={(accept) => rpc("respond_to_proposal", { eid: id, accept }, accept ? "Added to your calendar." : "Declined.")}
          onFinalize={() => rpc("finalize_event", { eid: id }, "Meeting confirmed.")}
        />
      )}

      <div role="tablist" className="mb-4 flex gap-1 rounded-xl bg-surface-muted p-1 text-sm font-medium">
        {(
          [
            ["availability", "Your availability"],
            ["group", "Group schedule"],
            ["people", `People (${members.length})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={activeTab === key}
            onClick={() => setTab(key)}
            className={`flex-1 rounded-lg px-3 py-2 transition ${
              activeTab === key ? "bg-surface shadow-sm" : "text-muted hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "availability" && (
        <section>
          {closed ? (
            <p className="card p-5 text-sm text-muted">
              This event is {event.status}, so availability can no longer be changed.
            </p>
          ) : (
            <>
              <p className="mb-3 text-sm text-muted">
                {prefilled
                  ? "We pre-filled this from your calendar. "
                  : ""}
                Drag to paint the times you are free (green). Only these time slots are shared, never event names.
              </p>
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <button className="btn-secondary" onClick={fillFromCalendar}>
                  Fill from my calendar
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setDraft(new Set());
                    markDirty(true);
                    setSync(false);
                  }}
                >
                  Clear
                </button>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--accent)]"
                    checked={sync}
                    onChange={(e) => toggleSync(e.target.checked)}
                  />
                  Keep in sync with my calendar
                </label>
              </div>
              <WeekGrid
                weekStart={weekStart}
                mode="paint"
                selected={draft}
                onChange={(next) => {
                  setDraft(next);
                  markDirty(true);
                  setSync(false);
                }}
              />
              <div className="mt-4 flex items-center gap-3">
                <button className="btn-primary" onClick={saveAvailability} disabled={saving}>
                  {saving ? "Saving…" : me?.has_shared ? "Update availability" : "Share availability"}
                </button>
                {dirty && <span className="text-sm text-muted">Unsaved changes</span>}
              </div>
            </>
          )}
        </section>
      )}

      {activeTab === "group" && (
        <section>
          <p className="mb-3 text-sm text-muted">
            {sharedCount} of {members.length} people have shared their availability. Darker means more people are free.
            {isHost ? " Click a slot, or pick a suggestion, to choose the meeting start." : ""}
          </p>

          {suggestions.length > 0 && !closed && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <Sparkles className="size-4 text-accent" /> Best times
              </span>
              {suggestions.map((s) => (
                <button
                  key={s.start}
                  onClick={() => isHost && setCandidate(s.start)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    candidate === s.start ? "border-accent bg-accent-soft text-accent" : "border-border hover:bg-surface-muted"
                  } ${isHost ? "" : "cursor-default"}`}
                >
                  {fmtRange(s.start, s.start + event.duration_min * 60_000)} · {s.minCount}/{members.length}
                </button>
              ))}
            </div>
          )}

          <WeekGrid
            weekStart={weekStart}
            mode="heat"
            heat={heat}
            total={members.length}
            highlight={highlight}
            onPick={isHost && !closed ? setCandidate : undefined}
          />

          {isHost && candidate && !closed && (
            <div className="card mt-4 flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="text-sm text-muted">Selected time</p>
                <p className="font-medium">{fmtRange(candidate, candidate + event.duration_min * 60_000)}</p>
                <p className="text-xs text-muted">
                  {heat.get(candidate)?.count ?? 0} of {members.length} free at the start
                  {event.kind === "weekly" ? " · repeats every week" : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <button className="btn-secondary" onClick={() => setCandidate(null)}>
                  Clear
                </button>
                <button
                  className="btn-primary"
                  disabled={busy}
                  onClick={async () => {
                    await rpc("propose_time", { eid: id, start_ts: new Date(candidate).toISOString() }, "Proposal sent. Waiting for approvals.");
                    setCandidate(null);
                  }}
                >
                  <Send className="size-4" /> Propose this time
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {activeTab === "people" && (
        <PeopleSection
          event={event}
          members={members}
          isHost={isHost}
          userId={userId}
          onChanged={load}
          flash={flash}
        />
      )}
    </>
  );
}

function ProposalCard({
  event,
  me,
  isHost,
  members,
  busy,
  onRespond,
  onFinalize,
}: {
  event: MeetEvent;
  me?: EventMember;
  isHost: boolean;
  members: EventMember[];
  busy: boolean;
  onRespond: (accept: boolean) => void;
  onFinalize: () => void;
}) {
  const accepted = members.filter((m) => m.approval === "accepted").length;
  const confirmed = event.status === "confirmed";
  return (
    <div className={`card mb-6 border-2 p-5 ${confirmed ? "border-emerald-500/50" : "border-accent/50"}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm text-muted">
            <CalendarCheck className="size-4" />
            {confirmed ? "Confirmed time" : "Proposed time"}
          </p>
          <p className="mt-1 text-lg font-semibold">{fmtRange(event.final_start!, event.final_end!)}</p>
          <p className="mt-1 text-sm text-muted">
            {accepted} of {members.length} accepted{event.kind === "weekly" ? " · repeats every week" : ""}
          </p>
        </div>

        {!confirmed && !isHost && me && (
          <div className="flex gap-2">
            <button
              className="btn-secondary"
              disabled={busy || me.approval === "declined"}
              onClick={() => onRespond(false)}
            >
              <X className="size-4" /> {me.approval === "declined" ? "Declined" : "Decline"}
            </button>
            <button className="btn-primary" disabled={busy || me.approval === "accepted"} onClick={() => onRespond(true)}>
              <Check className="size-4" /> {me.approval === "accepted" ? "Accepted" : "Accept"}
            </button>
          </div>
        )}
        {!confirmed && isHost && (
          <button className="btn-secondary" disabled={busy} onClick={onFinalize}>
            Confirm without waiting
          </button>
        )}
        {confirmed && (
          <Link href="/calendar" className="btn-secondary">
            View in calendar
          </Link>
        )}
      </div>
    </div>
  );
}

function PeopleSection({
  event,
  members,
  isHost,
  userId,
  onChanged,
  flash,
}: {
  event: MeetEvent;
  members: EventMember[];
  isHost: boolean;
  userId: string;
  onChanged: () => void;
  flash: (text: string, error?: boolean) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState(false);
  const link = typeof window === "undefined" ? "" : `${window.location.origin}/join/${event.invite_code}`;
  const showApproval = event.status === "proposed" || event.status === "confirmed";

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    const { data, error } = await supabase.rpc("invite_user", { eid: event.id, invitee_email: email });
    if (error) return flash(error.message, true);
    if (data === "invited") flash(`Invited ${email}.`);
    else if (data === "already_member") flash("That person is already in this event.", true);
    else flash("No Meetly account uses that email yet. Share the invite link instead.", true);
    setEmail("");
    onChanged();
  }

  return (
    <section className="space-y-5">
      {isHost && event.status !== "cancelled" && (
        <div className="card space-y-4 p-5">
          <form onSubmit={invite} className="flex gap-2">
            <input
              type="email"
              required
              className="input"
              placeholder="Invite by email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button className="btn-primary shrink-0">Invite</button>
          </form>
          <div className="flex items-center gap-2">
            <input readOnly className="input text-muted" value={link} onFocus={(e) => e.target.select()} />
            <button
              className="btn-secondary shrink-0"
              onClick={async () => {
                await navigator.clipboard.writeText(link);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              <Copy className="size-4" /> {copied ? "Copied" : "Copy link"}
            </button>
          </div>
          <p className="text-xs text-muted">Anyone with the link can join and share their availability.</p>
        </div>
      )}

      <ul className="card divide-y divide-border">
        {members.map((m) => {
          const name = m.profiles?.display_name ?? "Someone";
          const host = m.user_id === event.owner_id;
          return (
            <li key={m.user_id} className="flex items-center gap-3 p-4">
              <span className="grid size-9 place-items-center rounded-full bg-accent-soft text-sm font-semibold text-accent">
                {name.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {name} {m.user_id === userId && <span className="text-muted">(you)</span>}
                </p>
              </div>
              {host && <Badge tone="action">Host</Badge>}
              <Badge tone={m.has_shared ? "confirmed" : "collecting"}>{m.has_shared ? "Shared" : "Not shared yet"}</Badge>
              {showApproval && !host && (
                <Badge tone={m.approval === "accepted" ? "confirmed" : m.approval === "declined" ? "cancelled" : "proposed"}>
                  {m.approval === "pending" ? "Awaiting reply" : m.approval}
                </Badge>
              )}
              {isHost && !host && (
                <button
                  aria-label={`Remove ${name}`}
                  className="rounded-lg p-1.5 text-muted hover:bg-danger/10 hover:text-danger"
                  onClick={async () => {
                    if (!confirm(`Remove ${name}?`)) return;
                    await supabase.from("event_members").delete().eq("event_id", event.id).eq("user_id", m.user_id);
                    onChanged();
                  }}
                >
                  <UserMinus className="size-4" />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

