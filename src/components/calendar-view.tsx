"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import rrulePlugin from "@fullcalendar/rrule";
import type { DateSelectArg, EventClickArg, EventDropArg, EventInput } from "@fullcalendar/core";
import type { EventResizeDoneArg } from "@fullcalendar/interaction";
import { Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/components/user-context";
import { Modal } from "@/components/modal";
import { loadCalendarItems, syncAllAutoEvents } from "@/lib/sync";
import type { CalendarItem } from "@/lib/types";

type Draft = { id?: string; title: string; date: string; start: string; end: string; weekly: boolean };

const pad = (n: number) => String(n).padStart(2, "0");
const dateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const timeStr = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

function newDraft(start: Date, end: Date): Draft {
  return { title: "", date: dateStr(start), start: timeStr(start), end: timeStr(end), weekly: false };
}

function toEventInput(item: CalendarItem): EventInput {
  const start = new Date(item.start_at);
  const end = new Date(item.end_at);
  const isMeeting = !!item.event_id;
  const base: EventInput = {
    id: item.id,
    title: item.title,
    editable: !isMeeting && !item.rrule,
    classNames: isMeeting ? ["meetly-meeting"] : [],
    extendedProps: { eventId: item.event_id, recurring: !!item.rrule },
  };
  if (item.rrule) {
    // Floating local wall-clock DTSTART keeps the weekly time stable across DST.
    const dt = `${start.getFullYear()}${pad(start.getMonth() + 1)}${pad(start.getDate())}T${pad(start.getHours())}${pad(start.getMinutes())}00`;
    return { ...base, rrule: `DTSTART:${dt}\nRRULE:${item.rrule}`, duration: { milliseconds: end.getTime() - start.getTime() } };
  }
  return { ...base, start, end };
}

export default function CalendarView() {
  const supabase = useMemo(() => createClient(), []);
  const { userId } = useUser();
  const router = useRouter();
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [narrow, setNarrow] = useState(false);

  const reload = useCallback(async () => setItems(await loadCalendarItems(supabase)), [supabase]);

  useEffect(() => {
    let active = true;
    loadCalendarItems(supabase).then((rows) => active && setItems(rows));
    const channel = supabase
      .channel(`calendar:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "calendar_items", filter: `user_id=eq.${userId}` },
        () => reload(),
      )
      .subscribe();
    const mq = window.matchMedia("(max-width: 767px)");
    const onMq = () => setNarrow(mq.matches);
    onMq();
    mq.addEventListener("change", onMq);
    return () => {
      active = false;
      mq.removeEventListener("change", onMq);
      supabase.removeChannel(channel);
    };
  }, [supabase, userId, reload]);

  const afterChange = useCallback(async () => {
    await reload();
    syncAllAutoEvents(supabase, userId); // keep shared availability in sync with the calendar
  }, [reload, supabase, userId]);

  async function save() {
    if (!draft) return;
    setError(null);
    const start = new Date(`${draft.date}T${draft.start}`);
    const end = new Date(`${draft.date}T${draft.end}`);
    if (!draft.title.trim()) return setError("Add a title.");
    if (!(end > start)) return setError("End time must be after the start time.");
    setSaving(true);
    const row = {
      title: draft.title.trim(),
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      rrule: draft.weekly ? "FREQ=WEEKLY" : null,
    };
    const { error } = draft.id
      ? await supabase.from("calendar_items").update(row).eq("id", draft.id)
      : await supabase.from("calendar_items").insert(row);
    setSaving(false);
    if (error) return setError(error.message);
    setDraft(null);
    afterChange();
  }

  async function remove() {
    if (!draft?.id) return;
    setSaving(true);
    const { error } = await supabase.from("calendar_items").delete().eq("id", draft.id);
    setSaving(false);
    if (error) return setError(error.message);
    setDraft(null);
    afterChange();
  }

  function onSelect(arg: DateSelectArg) {
    const end = arg.allDay ? new Date(arg.start.getTime() + 60 * 60_000) : arg.end;
    const start = arg.allDay ? new Date(arg.start.getFullYear(), arg.start.getMonth(), arg.start.getDate(), 9) : arg.start;
    setError(null);
    setDraft(newDraft(start, arg.allDay ? new Date(start.getTime() + 60 * 60_000) : end));
  }

  function onEventClick(arg: EventClickArg) {
    const item = items.find((i) => i.id === arg.event.id);
    if (!item) return;
    if (item.event_id) return router.push(`/events/${item.event_id}`);
    const s = new Date(item.start_at);
    const e = new Date(item.end_at);
    setError(null);
    setDraft({ id: item.id, title: item.title, date: dateStr(s), start: timeStr(s), end: timeStr(e), weekly: !!item.rrule });
  }

  async function onMoveOrResize(arg: EventDropArg | EventResizeDoneArg) {
    const { error } = await supabase
      .from("calendar_items")
      .update({ start_at: arg.event.start!.toISOString(), end_at: arg.event.end!.toISOString() })
      .eq("id", arg.event.id);
    if (error) arg.revert();
    else afterChange();
  }

  const events = useMemo(() => items.map(toEventInput), [items]);

  return (
    <>
      <div className="mb-4 flex justify-end">
        <button
          className="btn-primary"
          onClick={() => {
            const s = new Date();
            s.setMinutes(0, 0, 0);
            s.setHours(s.getHours() + 1);
            setError(null);
            setDraft(newDraft(s, new Date(s.getTime() + 60 * 60_000)));
          }}
        >
          <Plus className="size-4" />
          Add event
        </button>
      </div>

      <div className="card meetly-calendar overflow-hidden p-2 md:p-4">
        <FullCalendar
          key={narrow ? "narrow" : "wide"}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, rrulePlugin]}
          initialView={narrow ? "timeGridDay" : "timeGridWeek"}
          headerToolbar={
            narrow
              ? { left: "prev,next", center: "title", right: "timeGridDay,dayGridMonth" }
              : { left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay" }
          }
          firstDay={1}
          height="auto"
          nowIndicator
          selectable
          selectMirror
          editable
          events={events}
          select={onSelect}
          eventClick={onEventClick}
          eventDrop={onMoveOrResize}
          eventResize={onMoveOrResize}
          scrollTime="08:00:00"
          slotDuration="00:30:00"
          allDaySlot={false}
        />
      </div>

      {draft && (
        <Modal title={draft.id ? "Edit event" : "New event"} onClose={() => setDraft(null)}>
          <div className="flex flex-col gap-3">
            <input
              autoFocus
              className="input"
              placeholder="Title"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
            <input
              type="date"
              className="input"
              value={draft.date}
              onChange={(e) => setDraft({ ...draft, date: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="time"
                className="input"
                value={draft.start}
                onChange={(e) => setDraft({ ...draft, start: e.target.value })}
              />
              <input
                type="time"
                className="input"
                value={draft.end}
                onChange={(e) => setDraft({ ...draft, end: e.target.value })}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-[var(--accent)]"
                checked={draft.weekly}
                onChange={(e) => setDraft({ ...draft, weekly: e.target.checked })}
              />
              Repeats every week
            </label>
            {error && <p className="rounded-xl bg-danger/10 px-3.5 py-2.5 text-sm text-danger">{error}</p>}
            <div className="mt-2 flex items-center justify-between gap-2">
              {draft.id ? (
                <button onClick={remove} disabled={saving} className="btn text-danger hover:bg-danger/10">
                  <Trash2 className="size-4" />
                  Delete
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <button className="btn-secondary" onClick={() => setDraft(null)}>
                  Cancel
                </button>
                <button className="btn-primary" onClick={save} disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
