import type { SupabaseClient } from "@supabase/supabase-js";
import { freeSlotsFromCalendar } from "./availability";
import { parseDateOnly } from "./time";
import type { CalendarItem } from "./types";

export async function loadCalendarItems(supabase: SupabaseClient): Promise<CalendarItem[]> {
  const { data } = await supabase
    .from("calendar_items")
    .select("id,title,start_at,end_at,rrule,event_id")
    .order("start_at");
  return (data ?? []) as CalendarItem[];
}

/** Recompute the caller's free slots for one event from their calendar and submit them. */
export async function syncAvailability(
  supabase: SupabaseClient,
  event: { id: string; week_start: string },
  items?: CalendarItem[],
) {
  const calendar = items ?? (await loadCalendarItems(supabase));
  const free = freeSlotsFromCalendar(calendar, parseDateOnly(event.week_start), event.id);
  return supabase.rpc("submit_availability", {
    eid: event.id,
    slots: free.map((ms) => new Date(ms).toISOString()),
    sync: true,
  });
}

/** After the calendar changes, refresh every event where the user opted into auto-sync. */
export async function syncAllAutoEvents(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from("event_members")
    .select("events!inner(id,week_start,status)")
    .eq("user_id", userId)
    .eq("auto_sync", true)
    .eq("has_shared", true);
  const events = ((data ?? []) as unknown as { events: { id: string; week_start: string; status: string } }[])
    .map((r) => r.events)
    .filter((e) => e.status === "collecting" || e.status === "proposed");
  if (!events.length) return;
  const items = await loadCalendarItems(supabase);
  await Promise.all(events.map((e) => syncAvailability(supabase, e, items)));
}
