"use client";

import { useRef } from "react";
import { addDays, SLOT_MIN, slotsForDay } from "@/lib/time";

export type HeatCell = { count: number; names: string[] | null };

type Props = {
  weekStart: Date;
  mode: "paint" | "heat";
  /** paint mode: the set of free slots (ms) */
  selected?: Set<number>;
  onChange?: (next: Set<number>) => void;
  /** heat mode */
  heat?: Map<number, HeatCell>;
  total?: number;
  highlight?: { start: number; durationMin: number } | null;
  onPick?: (ms: number) => void;
  disabled?: boolean;
};

const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric" });
const hourFmt = new Intl.DateTimeFormat(undefined, { hour: "numeric" });
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

export function WeekGrid({
  weekStart,
  mode,
  selected,
  onChange,
  heat,
  total = 0,
  highlight,
  onPick,
  disabled,
}: Props) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const columns = days.map(slotsForDay);
  const drag = useRef<{ value: boolean; working: Set<number> } | null>(null);
  const todayMs = new Date().setHours(0, 0, 0, 0);

  const paintCell = (ms: number) => {
    const d = drag.current;
    if (!d) return;
    if (d.value === d.working.has(ms)) return;
    if (d.value) d.working.add(ms);
    else d.working.delete(ms);
    onChange?.(new Set(d.working));
  };
  const slotFromPoint = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-slot]");
    return el ? Number(el.dataset.slot) : null;
  };

  const paintHandlers =
    mode === "paint" && !disabled
      ? {
          onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
            const ms = slotFromPoint(e.clientX, e.clientY);
            if (ms === null) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            const working = new Set(selected);
            drag.current = { value: !working.has(ms), working };
            paintCell(ms);
          },
          onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
            if (!drag.current) return;
            const ms = slotFromPoint(e.clientX, e.clientY);
            if (ms !== null) paintCell(ms);
          },
          onPointerUp: () => {
            drag.current = null;
          },
          onPointerCancel: () => {
            drag.current = null;
          },
        }
      : {};

  const inHighlight = (ms: number) =>
    !!highlight && ms >= highlight.start && ms < highlight.start + highlight.durationMin * 60_000;

  return (
    <div className="card overflow-hidden">
      <div className="grid grid-cols-[3rem_repeat(7,minmax(0,1fr))] border-b border-border bg-surface-muted text-center text-xs font-medium">
        <div />
        {days.map((d) => (
          <div
            key={d.getTime()}
            className={`py-2 ${d.getTime() === todayMs ? "text-accent" : "text-muted"}`}
          >
            {dayFmt.format(d)}
          </div>
        ))}
      </div>

      <div className="max-h-[65vh] overflow-y-auto">
        <div
          className={`grid grid-cols-[3rem_repeat(7,minmax(0,1fr))] ${
            mode === "paint" && !disabled ? "touch-none select-none" : ""
          }`}
          {...paintHandlers}
        >
          <div>
            {columns[0].map((ms, i) => (
              <div key={ms} className="h-6 pr-1.5 text-right text-[10px] leading-3 text-muted">
                {i % (60 / SLOT_MIN) === 0 ? hourFmt.format(ms) : ""}
              </div>
            ))}
          </div>

          {columns.map((col, ci) => (
            <div key={ci} className="border-l border-border">
              {col.map((ms, ri) => {
                const hourStart = ri % (60 / SLOT_MIN) === 0;
                const cell = heat?.get(ms);
                const count = cell?.count ?? 0;
                const isFree = mode === "paint" && selected?.has(ms);
                const style =
                  mode === "heat" && count > 0 && total > 0
                    ? {
                        background: `color-mix(in srgb, var(--accent) ${Math.round((count / total) * 100)}%, transparent)`,
                      }
                    : undefined;
                const title =
                  mode === "heat"
                    ? `${timeFmt.format(ms)} — ${count}/${total} free${
                        cell?.names?.length ? `\n${cell.names.join(", ")}` : ""
                      }`
                    : timeFmt.format(ms);
                return (
                  <div
                    key={ms}
                    data-slot={ms}
                    title={title}
                    style={style}
                    onClick={mode === "heat" && onPick ? () => onPick(ms) : undefined}
                    className={`h-6 ${hourStart ? "border-t border-border" : "border-t border-border/40"} ${
                      isFree ? "bg-emerald-500/60" : ""
                    } ${inHighlight(ms) ? "ring-2 ring-inset ring-teal-600" : ""} ${
                      mode === "heat" && onPick ? "cursor-pointer hover:brightness-95" : ""
                    } ${mode === "paint" && !disabled ? "cursor-crosshair" : ""}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
