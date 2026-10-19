"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Repeat } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/page-header";
import { addDays, mondayOf, parseDateOnly, toDateOnly } from "@/lib/time";
import type { EventKind } from "@/lib/types";

const DURATIONS = [30, 45, 60, 90, 120, 180];

export default function NewEventPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<EventKind>("one_time");
  const [week, setWeek] = useState(() => toDateOnly(addDays(mondayOf(new Date()), 7)));
  const [duration, setDuration] = useState(60);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error } = await supabase
      .from("events")
      .insert({
        title: title.trim(),
        description: description.trim() || null,
        kind,
        week_start: toDateOnly(mondayOf(parseDateOnly(week))),
        duration_min: duration,
      })
      .select("id")
      .single();
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    router.push(`/events/${data.id}`);
  }

  return (
    <>
      <PageHeader
        title="New event"
        subtitle="No fixed time yet. Pick the week, invite people, and find the best slot together."
      />
      <form onSubmit={submit} className="card flex max-w-xl flex-col gap-5 p-6">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Title
          <input
            required
            maxLength={120}
            className="input font-normal"
            placeholder="Weekly team sync"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Description <span className="font-normal text-muted">(optional)</span>
          <textarea
            rows={3}
            className="input font-normal"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">How often?</legend>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                { value: "one_time", label: "One time", icon: CalendarClock },
                { value: "weekly", label: "Every week", icon: Repeat },
              ] as const
            ).map(({ value, label, icon: Icon }) => (
              <button
                type="button"
                key={value}
                onClick={() => setKind(value)}
                aria-pressed={kind === value}
                className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition ${
                  kind === value
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-border hover:bg-surface-muted"
                }`}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {kind === "weekly" ? "Reference week" : "Which week?"}
            <input
              type="date"
              required
              className="input font-normal"
              value={week}
              onChange={(e) => setWeek(e.target.value)}
            />
            <span className="text-xs font-normal text-muted">
              Week of {parseDateOnly(toDateOnly(mondayOf(parseDateOnly(week || toDateOnly(new Date()))))).toLocaleDateString()}
            </span>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Length
            <select
              className="input font-normal"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            >
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {d < 60 ? `${d} minutes` : `${d / 60} hour${d === 60 ? "" : "s"}`}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error && <p className="rounded-xl bg-danger/10 px-3.5 py-2.5 text-sm text-danger">{error}</p>}
        <button disabled={busy || !title.trim()} className="btn-primary self-start">
          {busy ? "Creating…" : "Create & invite people"}
        </button>
      </form>
    </>
  );
}
