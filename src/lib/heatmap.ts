import { SLOT_MIN, SLOT_MS } from "./time";

export type Window = { start: number; minCount: number; avgCount: number };

/**
 * Rank candidate meeting starts. A window spans ceil(duration / 30min) consecutive slots;
 * its score is the number of people free for the *whole* window (the minimum), then the average.
 */
export function bestWindows(counts: Map<number, number>, durationMin: number, limit = 5): Window[] {
  const n = Math.max(1, Math.ceil(durationMin / SLOT_MIN));
  const out: Window[] = [];
  for (const start of counts.keys()) {
    let min = Infinity;
    let sum = 0;
    for (let k = 0; k < n; k++) {
      const c = counts.get(start + k * SLOT_MS) ?? 0;
      min = Math.min(min, c);
      sum += c;
    }
    if (min > 0) out.push({ start, minCount: min, avgCount: sum / n });
  }
  return out
    .sort((a, b) => b.minCount - a.minCount || b.avgCount - a.avgCount || a.start - b.start)
    .slice(0, limit);
}
