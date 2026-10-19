"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Eye, Users, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const FEATURES = [
  { icon: Eye, text: "Share free/busy slots only, never event details" },
  { icon: Zap, text: "Availability updates live, no new links to send" },
  { icon: Users, text: "Pick the best time for the whole team in one view" },
];

// Only follow same-site relative paths after login.
function nextPath(): string {
  const next = new URLSearchParams(location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/home";
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const supabase = createClient();
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMessage({ text: error.message, error: true });
      else {
        router.replace(nextPath());
        router.refresh();
      }
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(nextPath())}` },
      });
      if (error) setMessage({ text: error.message, error: true });
      else if (data.session) {
        router.replace(nextPath());
        router.refresh();
      } else setMessage({ text: "Check your email to confirm your account.", error: false });
    }
    setBusy(false);
  }

  async function google() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(nextPath())}` },
    });
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-accent p-12 text-accent-foreground lg:flex">
        <div className="absolute -right-24 -top-24 size-96 rounded-full bg-white/10" />
        <div className="absolute -bottom-32 -left-16 size-96 rounded-full bg-white/10" />
        <div className="relative flex items-center gap-2.5">
          <span className="grid size-10 place-items-center rounded-xl bg-white/20">
            <CalendarDays className="size-5" />
          </span>
          <span className="text-xl font-semibold tracking-tight">Meetly</span>
        </div>
        <div className="relative">
          <h2 className="text-4xl font-semibold leading-tight tracking-tight">
            Find a time that works
            <br />
            for everyone, live.
          </h2>
          <ul className="mt-8 space-y-4">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-white/90">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/15">
                  <Icon className="size-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-white/70">Scheduling without the back-and-forth.</p>
      </aside>

      <main className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="grid size-9 place-items-center rounded-xl bg-accent text-accent-foreground">
              <CalendarDays className="size-5" />
            </span>
            <span className="text-lg font-semibold tracking-tight">Meetly</span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mb-8 mt-1 text-sm text-muted">
            {mode === "signin"
              ? "Sign in to see your calendar and meetings."
              : "Start scheduling with your team in minutes."}
          </p>

          <button onClick={google} type="button" className="btn-secondary w-full">
            <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
              <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9Z" />
              <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.7-4.9H1.3v3.1A12 12 0 0 0 12 24Z" />
              <path fill="#FBBC05" d="M5.3 14.4a7.2 7.2 0 0 1 0-4.8V6.5H1.3a12 12 0 0 0 0 11l4-3.1Z" />
              <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.5l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z" />
            </svg>
            Continue with Google
          </button>

          <div className="my-6 flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-border" />
            or with email
            <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={submit} className="flex flex-col gap-3">
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
            />
            <input
              type="password"
              required
              minLength={6}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
            />
            <button disabled={busy} className="btn-primary mt-1">
              {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          {message && (
            <p
              role="status"
              className={`mt-4 rounded-xl px-3.5 py-2.5 text-sm ${
                message.error ? "bg-danger/10 text-danger" : "bg-accent-soft text-accent"
              }`}
            >
              {message.text}
            </p>
          )}

          <p className="mt-8 text-center text-sm text-muted">
            {mode === "signin" ? "New to Meetly?" : "Already have an account?"}{" "}
            <button
              className="font-medium text-accent hover:underline"
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setMessage(null);
              }}
            >
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}
