// All dates are built from local components so DST changes never skew the grid.
export const SLOT_MIN = 30;
export const SLOT_MS = SLOT_MIN * 60_000;
export const DAY_START_HOUR = 7;
export const DAY_END_HOUR = 23;

export function parseDateOnly(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toDateOnly(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

export function mondayOf(d: Date): Date {
  const dow = (d.getDay() + 6) % 7; // Monday = 0
  return addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -dow);
}

/** Start timestamps (ms) of every slot in the visible hours of one local day. */
export function slotsForDay(day: Date): number[] {
  const out: number[] = [];
  for (let h = DAY_START_HOUR; h < DAY_END_HOUR; h++) {
    for (let m = 0; m < 60; m += SLOT_MIN) {
      out.push(new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m).getTime());
    }
  }
  return out;
}

export function weekSlots(weekStart: Date): number[][] {
  return Array.from({ length: 7 }, (_, i) => slotsForDay(addDays(weekStart, i)));
}
