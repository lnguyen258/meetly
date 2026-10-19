-- Meetly core schema: events, members, availability, calendar, notifications, chat.
-- Availability is stored as FREE 30-minute slots only (absence = busy/unknown).

-- ---------------------------------------------------------------- tables

create table public.events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  description text,
  kind text not null check (kind in ('one_time', 'weekly')),
  week_start date not null,
  duration_min int not null check (duration_min between 15 and 480),
  status text not null default 'collecting'
    check (status in ('collecting', 'proposed', 'confirmed', 'cancelled')),
  final_start timestamptz,
  final_end timestamptz,
  invite_code text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 16),
  created_at timestamptz not null default now()
);

create table public.event_members (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  has_shared boolean not null default false,
  auto_sync boolean not null default true,
  approval text not null default 'pending' check (approval in ('pending', 'accepted', 'declined')),
  availability_updated_at timestamptz not null default now(),
  joined_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index event_members_user_idx on public.event_members (user_id);

create table public.availability_slots (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  slot_start timestamptz not null,
  primary key (event_id, user_id, slot_start)
);

create table public.calendar_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  start_at timestamptz not null,
  end_at timestamptz not null,
  rrule text,
  event_id uuid references public.events (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (end_at > start_at)
);
create index calendar_items_user_idx on public.calendar_items (user_id, start_at);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  event_id uuid references public.events (id) on delete cascade,
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index messages_event_idx on public.messages (event_id, created_at);

-- ---------------------------------------------------------------- helpers

create function public.is_event_member(eid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.event_members
    where event_id = eid and user_id = (select auth.uid())
  );
$$;

-- The host is always a member of their own event.
create function public.add_owner_as_member() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.event_members (event_id, user_id, approval)
  values (new.id, new.owner_id, 'accepted');
  return new;
end;
$$;

create trigger on_event_created
  after insert on public.events
  for each row execute function public.add_owner_as_member();

-- ---------------------------------------------------------------- RLS

alter table public.events enable row level security;
alter table public.event_members enable row level security;
alter table public.availability_slots enable row level security;
alter table public.calendar_items enable row level security;
alter table public.notifications enable row level security;
alter table public.messages enable row level security;

create policy "events: owner or member can read" on public.events for select to authenticated
  using (owner_id = (select auth.uid()) or public.is_event_member(id));
create policy "events: create as self" on public.events for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "events: owner updates" on public.events for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "events: owner deletes" on public.events for delete to authenticated
  using (owner_id = (select auth.uid()));

create policy "members: visible to fellow members" on public.event_members for select to authenticated
  using (public.is_event_member(event_id));
create policy "members: update own row" on public.event_members for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "members: leave or be removed by host" on public.event_members for delete to authenticated
  using (
    user_id = (select auth.uid())
    or exists (select 1 from public.events e where e.id = event_id and e.owner_id = (select auth.uid()))
  );

-- Slots are private: owners read their own rows; everyone else only sees aggregates via event_heatmap().
create policy "slots: own rows" on public.availability_slots for select to authenticated
  using (user_id = (select auth.uid()));

create policy "calendar: own rows" on public.calendar_items for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "notifications: read own" on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy "notifications: update own" on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "notifications: delete own" on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "messages: members read" on public.messages for select to authenticated
  using (public.is_event_member(event_id));
create policy "messages: members post as self" on public.messages for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_event_member(event_id));

-- ---------------------------------------------------------------- RPCs

-- Aggregated availability. Everyone sees counts; only the host also gets names.
create function public.event_heatmap(eid uuid)
returns table (slot_start timestamptz, free_count bigint, free_names text[])
language plpgsql stable security definer set search_path = '' as $$
declare
  is_owner boolean;
begin
  if not public.is_event_member(eid) then
    raise exception 'not a member of this event';
  end if;
  select e.owner_id = (select auth.uid()) into is_owner from public.events e where e.id = eid;
  return query
    select s.slot_start,
           count(*)::bigint,
           case when is_owner then array_agg(coalesce(p.display_name, 'Someone') order by p.display_name) else null end
    from public.availability_slots s
    join public.profiles p on p.id = s.user_id
    where s.event_id = eid
    group by s.slot_start;
end;
$$;

-- Replace the caller's free slots for an event.
create function public.submit_availability(eid uuid, slots timestamptz[], sync boolean default true)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  ev public.events;
  me uuid := (select auth.uid());
  already boolean;
  my_name text;
begin
  select * into ev from public.events where id = eid;
  if not found or not public.is_event_member(eid) then
    raise exception 'not allowed';
  end if;
  if ev.status in ('confirmed', 'cancelled') then
    raise exception 'event is closed';
  end if;
  if cardinality(slots) > 1500 then
    raise exception 'too many slots';
  end if;

  delete from public.availability_slots where event_id = eid and user_id = me;
  insert into public.availability_slots (event_id, user_id, slot_start)
    select distinct eid, me, s
    from unnest(slots) as s
    where s >= ev.week_start::timestamptz - interval '2 days'
      and s < ev.week_start::timestamptz + interval '9 days';

  select has_shared into already from public.event_members where event_id = eid and user_id = me;
  if not already and ev.owner_id <> me then
    select coalesce(display_name, 'Someone') into my_name from public.profiles where id = me;
    insert into public.notifications (user_id, type, event_id, title, body)
    values (ev.owner_id, 'availability_shared', eid, ev.title, my_name || ' shared their availability');
  end if;

  update public.event_members
    set has_shared = true, auto_sync = sync, availability_updated_at = now()
    where event_id = eid and user_id = me;
end;
$$;

-- Host invites an existing user by email.
create function public.invite_user(eid uuid, invitee_email text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  ev public.events;
  target uuid;
begin
  select * into ev from public.events where id = eid and owner_id = (select auth.uid());
  if not found then raise exception 'only the host can invite'; end if;
  select id into target from auth.users where lower(email) = lower(trim(invitee_email));
  if target is null then return 'not_found'; end if;
  if exists (select 1 from public.event_members where event_id = eid and user_id = target) then
    return 'already_member';
  end if;
  insert into public.event_members (event_id, user_id) values (eid, target);
  insert into public.notifications (user_id, type, event_id, title, body)
  values (target, 'invite', eid, ev.title, 'You were invited — share when you are free');
  return 'invited';
end;
$$;

-- Join through a shareable invite link.
create function public.join_event(code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  ev public.events;
  me uuid := (select auth.uid());
  my_name text;
begin
  select * into ev from public.events where invite_code = code;
  if not found or ev.status = 'cancelled' then raise exception 'invalid invite'; end if;
  if not exists (select 1 from public.event_members where event_id = ev.id and user_id = me) then
    insert into public.event_members (event_id, user_id) values (ev.id, me);
    select coalesce(display_name, 'Someone') into my_name from public.profiles where id = me;
    insert into public.notifications (user_id, type, event_id, title, body)
    values (ev.owner_id, 'joined', ev.id, ev.title, my_name || ' joined the event');
  end if;
  return ev.id;
end;
$$;

-- Host picks a time. Resets approvals, refreshes calendar entries and notifies everyone.
create function public.propose_time(eid uuid, start_ts timestamptz) returns void
language plpgsql security definer set search_path = '' as $$
declare
  ev public.events;
  me uuid := (select auth.uid());
  end_ts timestamptz;
  rule text;
  m record;
begin
  select * into ev from public.events where id = eid and owner_id = me;
  if not found then raise exception 'only the host can propose a time'; end if;
  if ev.status = 'cancelled' then raise exception 'event is cancelled'; end if;

  end_ts := start_ts + make_interval(mins => ev.duration_min);
  rule := case when ev.kind = 'weekly' then 'FREQ=WEEKLY' else null end;

  update public.events set status = 'proposed', final_start = start_ts, final_end = end_ts where id = eid;
  update public.event_members
    set approval = case when user_id = me then 'accepted' else 'pending' end
    where event_id = eid;

  delete from public.calendar_items where event_id = eid;
  insert into public.calendar_items (user_id, title, start_at, end_at, rrule, event_id)
  values (me, ev.title, start_ts, end_ts, rule, eid);

  for m in select user_id from public.event_members where event_id = eid and user_id <> me loop
    insert into public.notifications (user_id, type, event_id, title, body)
    values (m.user_id, 'proposal', eid, ev.title, 'A time was proposed — please approve or decline');
  end loop;
end;
$$;

-- Member approves/declines the proposed time. Approving adds it to their calendar.
create function public.respond_to_proposal(eid uuid, accept boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  ev public.events;
  me uuid := (select auth.uid());
  my_name text;
  rule text;
  pending_left int;
  m record;
begin
  select * into ev from public.events where id = eid;
  if not found or not public.is_event_member(eid) then raise exception 'not allowed'; end if;
  if ev.status <> 'proposed' then raise exception 'nothing to respond to'; end if;

  update public.event_members
    set approval = case when accept then 'accepted' else 'declined' end
    where event_id = eid and user_id = me;

  delete from public.calendar_items where event_id = eid and user_id = me;
  if accept then
    rule := case when ev.kind = 'weekly' then 'FREQ=WEEKLY' else null end;
    insert into public.calendar_items (user_id, title, start_at, end_at, rrule, event_id)
    values (me, ev.title, ev.final_start, ev.final_end, rule, eid);
  end if;

  if ev.owner_id <> me then
    select coalesce(display_name, 'Someone') into my_name from public.profiles where id = me;
    insert into public.notifications (user_id, type, event_id, title, body)
    values (ev.owner_id, 'response', eid, ev.title,
            my_name || case when accept then ' accepted' else ' declined' end);
  end if;

  select count(*) into pending_left from public.event_members
    where event_id = eid and approval <> 'accepted';
  if pending_left = 0 then
    update public.events set status = 'confirmed' where id = eid;
    for m in select user_id from public.event_members where event_id = eid loop
      insert into public.notifications (user_id, type, event_id, title, body)
      values (m.user_id, 'confirmed', eid, ev.title, 'Everyone accepted — it is confirmed');
    end loop;
  end if;
end;
$$;

-- Host locks the event in even if some people have not answered.
create function public.finalize_event(eid uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  ev public.events;
  m record;
begin
  select * into ev from public.events where id = eid and owner_id = (select auth.uid());
  if not found then raise exception 'only the host can finalize'; end if;
  if ev.status <> 'proposed' then raise exception 'propose a time first'; end if;
  update public.events set status = 'confirmed' where id = eid;
  for m in select user_id from public.event_members where event_id = eid and user_id <> ev.owner_id loop
    insert into public.notifications (user_id, type, event_id, title, body)
    values (m.user_id, 'confirmed', eid, ev.title, 'The host confirmed the meeting');
  end loop;
end;
$$;

create function public.cancel_event(eid uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  ev public.events;
  m record;
begin
  select * into ev from public.events where id = eid and owner_id = (select auth.uid());
  if not found then raise exception 'only the host can cancel'; end if;
  update public.events set status = 'cancelled' where id = eid;
  delete from public.calendar_items where event_id = eid;
  for m in select user_id from public.event_members where event_id = eid and user_id <> ev.owner_id loop
    insert into public.notifications (user_id, type, event_id, title, body)
    values (m.user_id, 'cancelled', eid, ev.title, 'This event was cancelled');
  end loop;
end;
$$;

-- Only signed-in users may call the RPCs.
revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.is_event_member(uuid),
  public.event_heatmap(uuid),
  public.submit_availability(uuid, timestamptz[], boolean),
  public.invite_user(uuid, text),
  public.join_event(text),
  public.propose_time(uuid, timestamptz),
  public.respond_to_proposal(uuid, boolean),
  public.finalize_event(uuid),
  public.cancel_event(uuid)
to authenticated;

-- ---------------------------------------------------------------- realtime

alter publication supabase_realtime add table
  public.notifications, public.event_members, public.events, public.messages, public.calendar_items;
