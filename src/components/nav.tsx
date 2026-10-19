"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUnreadCount } from "@/components/use-unread";
import { Bell, CalendarDays, Home, LogOut, MessageCircle } from "lucide-react";

const NAV = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/chat", label: "Chat", icon: MessageCircle },
];

export function Nav() {
  const pathname = usePathname();
  const unread = useUnreadCount();

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 flex justify-around border-t border-border bg-surface/90 px-2 py-1.5 backdrop-blur md:sticky md:top-0 md:h-screen md:w-64 md:shrink-0 md:flex-col md:justify-start md:gap-1 md:border-r md:border-t-0 md:px-4 md:py-6"
    >
      <Link href="/home" className="mb-6 hidden items-center gap-2.5 px-2 md:flex">
        <span className="grid size-9 place-items-center rounded-xl bg-accent text-accent-foreground">
          <CalendarDays className="size-5" />
        </span>
        <span className="text-lg font-semibold tracking-tight">Meetly</span>
      </Link>

      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-[11px] font-medium transition md:flex-row md:gap-3 md:px-3 md:py-2.5 md:text-sm ${
              active
                ? "bg-accent-soft text-accent"
                : "text-muted hover:bg-surface-muted hover:text-foreground"
            }`}
          >
            <span className="relative">
              <Icon className="size-5" />
              {href === "/notifications" && unread > 0 && (
                <span className="absolute -right-2 -top-1.5 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-4 text-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </span>
            {label}
          </Link>
        );
      })}

      <form action="/auth/signout" method="post" className="hidden md:mt-auto md:block">
        <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted transition hover:bg-surface-muted hover:text-foreground">
          <LogOut className="size-5" />
          Sign out
        </button>
      </form>
    </nav>
  );
}
