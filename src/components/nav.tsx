"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CalendarDays, Home, LogOut, MessageCircle, Plus } from "lucide-react";
import { useUnreadCount } from "@/components/use-unread";
import { useUser } from "@/components/user-context";

const TABS = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/chat", label: "Chat", icon: MessageCircle },
];

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold ${className}`}>
      <span className="grid size-7 place-items-center rounded-md bg-brand text-header">
        <CalendarDays className="size-4" strokeWidth={2.5} />
      </span>
      <span className="text-lg leading-none">
        meetly<span className="text-brand">.</span>
      </span>
    </span>
  );
}

function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -right-1.5 -top-1.5 grid min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold leading-4 text-header">
      {count > 9 ? "9+" : count}
    </span>
  );
}

function AccountMenu() {
  const { email } = useUser();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
        aria-expanded={open}
        className="grid size-8 place-items-center rounded-full bg-header-2 text-sm font-semibold uppercase text-white ring-1 ring-white/25 transition hover:ring-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
      >
        {(email ?? "?").slice(0, 1)}
      </button>
      {open && (
        <div className="card absolute right-0 top-10 z-40 w-60 p-1 text-foreground shadow-lg">
          <p className="truncate px-3 py-2 text-xs text-muted">Signed in as {email}</p>
          <form action="/auth/signout" method="post">
            <button className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-surface-muted">
              <LogOut className="size-4" /> Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export function Nav() {
  const pathname = usePathname();
  const unread = useUnreadCount();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <header className="sticky top-0 z-30 bg-header text-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Link href="/home" aria-label="Meetly home" className="rounded-md outline-offset-4 focus-visible:outline-2 focus-visible:outline-brand">
            <Logo />
          </Link>

          <nav aria-label="Main" className="ml-4 hidden h-full md:flex">
            {TABS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                aria-current={isActive(href) ? "page" : undefined}
                className={`flex h-full items-center border-b-[3px] px-4 text-sm font-medium transition ${
                  isActive(href)
                    ? "border-brand text-white"
                    : "border-transparent text-white/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 md:gap-3">
            <Link href="/events/new" className="btn-primary !px-3 md:!px-4">
              <Plus className="size-4" strokeWidth={2.5} />
              <span className="hidden sm:inline">New event</span>
              <span className="sr-only sm:hidden">New event</span>
            </Link>
            <Link
              href="/notifications"
              aria-label="Notifications"
              aria-current={isActive("/notifications") ? "page" : undefined}
              className={`relative hidden size-9 place-items-center rounded-full transition md:grid ${
                isActive("/notifications") ? "bg-white/15" : "hover:bg-white/10"
              }`}
            >
              <Bell className="size-5" />
              <UnreadBadge count={unread} />
            </Link>
            <AccountMenu />
          </div>
        </div>
      </header>

      <nav
        aria-label="Mobile"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-surface md:hidden"
      >
        {[...TABS, { href: "/notifications", label: "Alerts", icon: Bell }].map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(href) ? "page" : undefined}
            className={`relative flex flex-1 flex-col items-center gap-0.5 border-t-2 py-2 text-[11px] font-medium ${
              isActive(href) ? "border-brand text-foreground" : "border-transparent text-muted"
            }`}
          >
            <span className="relative">
              <Icon className="size-5" />
              {href === "/notifications" && <UnreadBadge count={unread} />}
            </span>
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}
