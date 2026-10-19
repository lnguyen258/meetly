"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, MessagesSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { EmptyState, PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/badge";
import type { MeetEvent } from "@/lib/types";

export default function ChatList() {
  const supabase = useMemo(() => createClient(), []);
  const [events, setEvents] = useState<MeetEvent[] | null>(null);

  useEffect(() => {
    let active = true;
    supabase
      .from("events")
      .select("*")
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .then(({ data }) => active && setEvents((data ?? []) as MeetEvent[]));
    return () => {
      active = false;
    };
  }, [supabase]);

  return (
    <>
      <PageHeader title="Chat" subtitle="Talk with your team about each meeting." />
      {events === null && <div className="h-32 animate-pulse rounded-lg bg-border" />}
      {events?.length === 0 && (
        <EmptyState
          icon={MessagesSquare}
          title="No conversations yet"
          body="Each event gets its own thread once you start scheduling."
        />
      )}
      {!!events?.length && (
        <ul className="card divide-y divide-border overflow-hidden">
          {events.map((e) => (
            <li key={e.id}>
              <Link href={`/chat/${e.id}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface-muted">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-header-2 text-white">
                  <MessagesSquare className="size-5" />
                </span>
                <span className="min-w-0 flex-1 truncate font-semibold">{e.title}</span>
                <StatusBadge status={e.status} />
                <ChevronRight className="size-4 text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
