-- Run this once in Supabase Dashboard -> SQL Editor.
-- Each authenticated account can read and update only its own application state.
create table if not exists public.app_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

drop policy if exists "Users read their own state" on public.app_state;
create policy "Users read their own state"
  on public.app_state for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users insert their own state" on public.app_state;
create policy "Users insert their own state"
  on public.app_state for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users update their own state" on public.app_state;
create policy "Users update their own state"
  on public.app_state for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Needed for automatic updates from another device.
alter publication supabase_realtime add table public.app_state;
