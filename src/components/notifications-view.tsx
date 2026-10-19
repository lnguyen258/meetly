"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellOff, CalendarCheck, CalendarX, CheckCheck, MailPlus, MessageSquareReply, UserPlus, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/components/user-context";
import { EmptyState, PageHeader } from "@/components/page-header";
import { timeAgo } from "@/lib/format";
import type { AppNotification } from "@/lib/types";

const ICONS: Record<string, LucideIcon> = {
  invite: MailPlus,
  joined: UserPlus,
  availability_shared: Users,
  proposal: CalendarCheck,
  response: MessageSquareReply,
  confirmed: CalendarCheck,
  cancelled: CalendarX,
};

export default function NotificationsView() {
  const supabase = useMemo(() => createClient(), []);
  const { userId } = useUser();
  const router = useRouter();
  const [items, setItems] = useState<AppNotification[] | null>(null);

  const fetchItems = useCallback(async () => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    return (data ?? []) as AppNotification[];
  }, [supabase]);

  useEffect(() => {
    let active = true;
    fetchItems().then((r) => active && setItems(r));
    const channel = supabase
      .channel(`notifs:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => fetchItems().then((r) => active && setItems(r)),
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [supabase, userId, fetchItems]);

  async function open(n: AppNotification) {
    if (!n.read_at) await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", n.id);
    if (n.event_id) router.push(`/events/${n.event_id}`);
  }

  async function markAllRead() {
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
    setItems(await fetchItems());
  }

  const unread = (items ?? []).filter((n) => !n.read_at).length;

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle="Invites and meeting proposals."
        action={
          unread > 0 ? (
            <button className="btn-secondary" onClick={markAllRead}>
              <CheckCheck className="size-4" /> Mark all read
            </button>
          ) : undefined
        }
      />
      {items === null && <div className="h-32 animate-pulse rounded-2xl bg-surface-muted" />}
      {items?.length === 0 && (
        <EmptyState
          icon={BellOff}
          title="You're all caught up"
          body="When someone invites you to a meeting or proposes a time, it will show up here."
        />
      )}
      {!!items?.length && (
        <ul className="card divide-y divide-border overflow-hidden">
          {items.map((n) => {
            const Icon = ICONS[n.type] ?? Bell;
            return (
              <li key={n.id}>
                <button
                  onClick={() => open(n)}
                  className={`flex w-full items-start gap-4 p-4 text-left transition hover:bg-surface-muted ${n.read_at ? "" : "bg-accent-soft/40"}`}
                >
                  <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{n.title}</span>
                    <span className="block text-sm text-muted">{n.body}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-muted">
                    {timeAgo(n.created_at)}
                    {!n.read_at && <span className="size-2 rounded-full bg-accent" aria-label="Unread" />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
