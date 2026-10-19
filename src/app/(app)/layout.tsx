import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const NAV = [
  { href: "/home", label: "Home" },
  { href: "/notifications", label: "Notifications" },
  { href: "/calendar", label: "Your Calendar" },
  { href: "/chat", label: "Chat" },
];

// Auth depends on the request, so it must run at request time, not during prerender.
async function AuthGate({ children }: { children: React.ReactNode }) {
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login");
  return <>{children}</>;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <nav className="order-last flex justify-around border-t p-2 md:order-first md:w-56 md:flex-col md:justify-start md:gap-1 md:border-r md:border-t-0 md:p-4">
        <span className="mb-2 hidden text-lg font-semibold md:block">Meetly</span>
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className="rounded px-3 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            {n.label}
          </Link>
        ))}
        <form action="/auth/signout" method="post" className="md:mt-auto">
          <button className="rounded px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800">
            Sign out
          </button>
        </form>
      </nav>
      <main className="flex-1 p-4 md:p-8">
        <Suspense fallback={<p className="text-sm text-neutral-500">Loading…</p>}>
          <AuthGate>{children}</AuthGate>
        </Suspense>
      </main>
    </div>
  );
}
