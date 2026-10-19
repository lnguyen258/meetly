import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/nav";
import { UserProvider } from "@/components/user-context";

// Auth depends on the request, so it must run at request time, not during prerender.
async function AuthGate({ children }: { children: React.ReactNode }) {
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login");
  const value = { userId: data.claims.sub, email: (data.claims.email as string | undefined) ?? null };
  return (
    <UserProvider value={value}>
      <Nav />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-6 md:px-10 md:pb-10 md:pt-10">
        {children}
      </main>
    </UserProvider>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Suspense
        fallback={
          <main className="flex-1 px-4 pt-6 md:px-10 md:pt-10">
            <div className="h-8 w-40 animate-pulse rounded-lg bg-surface-muted" />
          </main>
        }
      >
        <AuthGate>{children}</AuthGate>
      </Suspense>
    </div>
  );
}
