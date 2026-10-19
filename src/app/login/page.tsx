"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, Users, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/nav";

const FEATURES = [
  { icon: Eye, title: "Private by design", text: "Share free/busy slots only, never event details." },
  { icon: Zap, title: "Always up to date", text: "Availability updates live. No new links to send." },
  { icon: Users, title: "Best time, fast", text: "See the whole team in one view and pick a slot." },
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

  const signin = mode === "signin";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center px-4 py-10">
      <Link href="/" aria-label="Meetly" className="mb-6 text-foreground">
        <Logo className="text-2xl [&>span:first-child]:size-8" />
      </Link>

      <div className="card w-full p-6">
        <h1 className="mb-4 text-2xl font-normal">{signin ? "Sign in" : "Create account"}</h1>

        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Email
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input font-normal"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Password
            <input
              type="password"
              required
              minLength={6}
              autoComplete={signin ? "current-password" : "new-password"}
              placeholder={signin ? undefined : "At least 6 characters"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input font-normal"
            />
          </label>
          <button disabled={busy} className="btn-primary mt-1 w-full">
            {busy ? "Please wait…" : signin ? "Sign in" : "Create account"}
          </button>
        </form>

        {message && (
          <p
            role="status"
            className={`mt-3 rounded-md border px-3 py-2 text-sm ${
              message.error
                ? "border-danger/40 bg-danger/10 text-danger"
                : "border-accent/40 bg-accent-soft text-foreground"
            }`}
          >
            {message.text}
          </p>
        )}

        <div className="my-4 flex items-center gap-3 text-xs text-muted">
          <span className="h-px flex-1 bg-border" />
          or
          <span className="h-px flex-1 bg-border" />
        </div>

        <button onClick={google} type="button" className="btn-secondary w-full">
          <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
            <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9Z" />
            <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.7-4.9H1.3v3.1A12 12 0 0 0 12 24Z" />
            <path fill="#FBBC05" d="M5.3 14.4a7.2 7.2 0 0 1 0-4.8V6.5H1.3a12 12 0 0 0 0 11l4-3.1Z" />
            <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.5l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z" />
          </svg>
          Continue with Google
        </button>
      </div>

      <div className="mt-5 flex w-full items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-border" />
        {signin ? "New to Meetly?" : "Already have an account?"}
        <span className="h-px flex-1 bg-border" />
      </div>
      <button
        type="button"
        className="btn-secondary mt-3 w-full"
        onClick={() => {
          setMode(signin ? "signup" : "signin");
          setMessage(null);
        }}
      >
        {signin ? "Create your account" : "Sign in to your account"}
      </button>

      <ul className="mt-10 grid w-full gap-4 border-t border-border pt-6 sm:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <li key={title} className="text-xs text-muted">
            <Icon className="mb-1.5 size-4 text-brand" />
            <p className="font-semibold text-foreground">{title}</p>
            {text}
          </li>
        ))}
      </ul>
    </main>
  );
}
