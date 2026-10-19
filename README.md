# Meetly

Live group scheduling on top of a personal calendar. A host invites people to a one-time or weekly event with no fixed time, everyone shares **free/busy slots only** (never event names), the host sees a live combined heatmap, proposes a time, and invitees approve it into their calendar.

**Stack:** Next.js 16 (App Router) · Supabase (Postgres, Auth, RLS, Realtime) · Tailwind 4 · FullCalendar · deployed on Vercel.

## Setup

1. `npm install`
2. Create a Supabase project and run the SQL in `supabase/migrations/` **in order** (SQL Editor).
3. Copy `.env.example` to `.env.local` and fill in the project URL and anon/publishable key.
4. Supabase → Authentication → URL Configuration: add `http://localhost:3000/auth/callback` and your Vercel URL's `/auth/callback` as redirect URLs. Enable the Google provider for Google login.
5. `npm run dev`

For Vercel, set the same two env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) and redeploy.

## Tests

- `npm test` — unit tests (availability expansion incl. DST, heatmap ranking).
- `npm run test:e2e` — Playwright, two users through the full flow against the configured Supabase project. Turn **off** "Confirm email" in Supabase Auth while running it; it creates `meetly.test.*@gmail.com` accounts you can delete afterwards. Use `E2E_BASE_URL=http://localhost:3001` to target an already running server.

## How it works

- Availability is stored as free 30-minute slots. Raw slots are readable only by their owner; everyone else gets aggregates through the `event_heatmap` RPC (only the host also receives names).
- The workflow (invite, share, propose, approve, finalize, cancel) lives in `security definer` RPCs so permissions and notifications cannot be bypassed from the client.
- "Keep in sync with my calendar" re-submits a member's slots whenever their calendar changes, so nobody needs a new link when plans change.
