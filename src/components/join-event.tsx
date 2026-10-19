"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function JoinEvent({ code }: { code: string }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.rpc("join_event", { code }).then(({ data, error }) => {
      if (!active) return;
      if (error || !data) setFailed(true);
      else router.replace(`/events/${data}`);
    });
    return () => {
      active = false;
    };
  }, [supabase, code, router]);

  if (failed) {
    return (
      <div className="card p-10 text-center">
        <h1 className="text-lg font-semibold">This invite link is not valid</h1>
        <p className="mt-1 text-sm text-muted">It may have expired or the event was cancelled.</p>
        <Link href="/home" className="btn-secondary mt-5">
          Back home
        </Link>
      </div>
    );
  }
  return <p className="text-sm text-muted">Joining event…</p>;
}
