import { RRule } from "rrule";
import { SLOT_MS, weekSlots } from "./time";
import type { CalendarItem } from "./types";

export type Interval = { start: number; end: number };

// rrule works in UTC. To get "same wall-clock time every week" across DST, we expand in a
// fake-UTC space built from local components, then map each occurrence back to local time.
const toFake = (ms: number) => {
  const d = new Date(ms);
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds());
};
const fromFake = (ms: number) => {
  const d = new Date(ms);
  return new Date(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
    d.getUTCHours(),
    d.getUTCMinutes(),
    d.getUTCSeconds(),
  ).getTime();
};

/** Concrete busy intervals of one calendar item that overlap [from, to). */
export function expandItem(
  item: Pick<CalendarItem, "start_at" | "end_at" | "rrule">,
  from: number,
  to: number,
): Interval[] {
  const start = new Date(item.start_at).getTime();
  const duration = new Date(item.end_at).getTime() - start;
  if (!item.rrule) {
    return start < to && start + duration > from ? [{ start, end: start + duration }] : [];
  }
  const rule = new RRule({ ...RRule.parseString(item.rrule), dtstart: new Date(toFake(start)) });
  return rule
    .between(new Date(toFake(from - duration)), new Date(toFake(to)), true)
    .map((o) => {
      const s = fromFake(o.getTime());
      return { start: s, end: s + duration };
    })
    .filter((i) => i.start < to && i.end > from);
}

/** Free slots (ms) in the week: every slot that does not overlap a busy interval of the calendar. */
export function freeSlotsFromCalendar(
  items: CalendarItem[],
  weekStart: Date,
  excludeEventId?: string,
): number[] {
  const days = weekSlots(weekStart);
  const first = days[0][0];
  const last = days[6][days[6].length - 1] + SLOT_MS;
  const busy = items
    .filter((i) => !excludeEventId || i.event_id !== excludeEventId)
    .flatMap((i) => expandItem(i, first, last));
  return days.flat().filter((s) => !busy.some((b) => b.start < s + SLOT_MS && b.end > s));
}
