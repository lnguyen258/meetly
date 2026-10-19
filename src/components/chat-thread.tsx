"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/components/user-context";
import { fmtTime } from "@/lib/format";
import type { ChatMessage } from "@/lib/types";

export default function ChatThread({ id }: { id: string }) {
  const supabase = useMemo(() => createClient(), []);
  const { userId } = useUser();
  const [title, setTitle] = useState("");
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async () => {
    const { data } = await supabase
      .from("messages")
      .select("*, profiles(display_name)")
      .eq("event_id", id)
      .order("created_at");
    return (data ?? []) as ChatMessage[];
  }, [supabase, id]);

  useEffect(() => {
    let active = true;
    supabase
      .from("events")
      .select("title")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => active && setTitle(data?.title ?? "Event"));
    fetchMessages().then((m) => active && setMessages(m));
    const channel = supabase
      .channel(`chat:${id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `event_id=eq.${id}` },
        () => fetchMessages().then((m) => active && setMessages(m)),
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [supabase, id, fetchMessages]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setText("");
    setError(null);
    const { error } = await supabase.from("messages").insert({ event_id: id, body });
    if (error) {
      setError(error.message);
      setText(body);
    } else setMessages(await fetchMessages());
  }

  return (
    <div className="flex h-[calc(100dvh-9rem)] flex-col md:h-[calc(100dvh-6rem)]">
      <header className="mb-4 flex items-center gap-3">
        <Link href="/chat" aria-label="Back to chats" className="rounded-lg p-2 hover:bg-surface-muted">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight">{title}</h1>
          <Link href={`/events/${id}`} className="text-sm text-accent hover:underline">
            View event
          </Link>
        </div>
      </header>

      <div className="card flex-1 space-y-3 overflow-y-auto p-4">
        {messages === null && <div className="h-8 w-1/2 animate-pulse rounded-lg bg-surface-muted" />}
        {messages?.length === 0 && (
          <p className="py-10 text-center text-sm text-muted">No messages yet. Say hi 👋</p>
        )}
        {messages?.map((m) => {
          const mine = m.user_id === userId;
          return (
            <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
              <span className="mb-0.5 px-1 text-xs text-muted">
                {mine ? "You" : (m.profiles?.display_name ?? "Someone")} · {fmtTime(m.created_at)}
              </span>
              <p
                className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm ${
                  mine ? "bg-accent text-accent-foreground" : "bg-surface-muted"
                }`}
              >
                {m.body}
              </p>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      <form onSubmit={send} className="mt-3 flex gap-2">
        <input
          className="input"
          placeholder="Write a message…"
          maxLength={2000}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="btn-primary shrink-0" disabled={!text.trim()} aria-label="Send">
          <Send className="size-4" />
        </button>
      </form>
    </div>
  );
}
