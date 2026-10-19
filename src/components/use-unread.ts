"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/components/user-context";

/** Live count of unread notifications for the signed-in user. */
export function useUnreadCount(): number {
  const { userId } = useUser();
  const [count, setCount] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    const refresh = async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .is("read_at", null);
      if (active) setCount(count ?? 0);
    };
    refresh();
    const channel = supabase
      .channel(`unread:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        refresh,
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return count;
}
