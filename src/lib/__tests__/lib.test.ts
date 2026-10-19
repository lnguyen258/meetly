import { describe, expect, it } from "vitest";
import { expandItem, freeSlotsFromCalendar } from "../availability";
import { bestWindows } from "../heatmap";
import { SLOT_MS, mondayOf, parseDateOnly, toDateOnly, weekSlots } from "../time";

const local = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min);

describe("time", () => {
  it("finds the Monday of a week", () => {
    expect(toDateOnly(mondayOf(local(2026, 10, 25)))).toBe("2026-10-19"); // Sunday
    expect(toDateOnly(mondayOf(local(2026, 10, 19)))).toBe("2026-10-19");
  });
  it("builds 7 days of 32 half-hour slots", () => {
    const w = weekSlots(parseDateOnly("2026-10-19"));
    expect(w).toHaveLength(7);
    expect(w[0]).toHaveLength(32);
  });
});

describe("availability", () => {
  const week = parseDateOnly("2026-10-19");
  it("removes slots covered by a one-off item", () => {
    const item = {
      id: "1",
      title: "x",
      event_id: null,
      rrule: null,
      start_at: local(2026, 10, 19, 9).toISOString(),
      end_at: local(2026, 10, 19, 10).toISOString(),
    };
    const free = freeSlotsFromCalendar([item], week);
    expect(free).not.toContain(local(2026, 10, 19, 9).getTime());
    expect(free).not.toContain(local(2026, 10, 19, 9, 30).getTime());
    expect(free).toContain(local(2026, 10, 19, 10).getTime());
    expect(free).toHaveLength(7 * 32 - 2);
  });
  it("expands a weekly item onto later weeks at the same wall-clock time", () => {
    const item = {
      start_at: local(2026, 10, 5, 9).toISOString(),
      end_at: local(2026, 10, 5, 10).toISOString(),
      rrule: "FREQ=WEEKLY",
    };
    const hits = expandItem(item, local(2026, 10, 19).getTime(), local(2026, 10, 26).getTime());
    expect(hits).toHaveLength(1);
    expect(hits[0].start).toBe(local(2026, 10, 19, 9).getTime());
  });
  it("keeps the wall-clock time across a DST change", () => {
    // A 09:00 weekly item must stay at 09:00 local after the clocks change (late Oct / early Nov)
    const item = {
      start_at: local(2026, 10, 19, 9).toISOString(),
      end_at: local(2026, 10, 19, 10).toISOString(),
      rrule: "FREQ=WEEKLY",
    };
    const hits = expandItem(item, local(2026, 11, 2).getTime(), local(2026, 11, 9).getTime());
    expect(new Date(hits[0].start).getHours()).toBe(9);
  });
  it("ignores items belonging to the event being scheduled", () => {
    const item = {
      id: "1",
      title: "x",
      event_id: "E",
      rrule: null,
      start_at: local(2026, 10, 19, 9).toISOString(),
      end_at: local(2026, 10, 19, 10).toISOString(),
    };
    expect(freeSlotsFromCalendar([item], week, "E")).toHaveLength(7 * 32);
  });
});

describe("heatmap", () => {
  const t = (i: number) => 1_000_000 + i * SLOT_MS;
  it("prefers windows where the most people are free for the whole duration", () => {
    const counts = new Map([
      [t(0), 3],
      [t(1), 1],
      [t(2), 2],
      [t(3), 2],
    ]);
    const best = bestWindows(counts, 60);
    expect(best[0].start).toBe(t(2)); // 2 people free through both slots
    expect(best[0].minCount).toBe(2);
  });
  it("skips windows nobody can attend", () => {
    const counts = new Map([
      [t(0), 2],
      [t(1), 0],
    ]);
    expect(bestWindows(counts, 60)).toHaveLength(0);
  });
});
