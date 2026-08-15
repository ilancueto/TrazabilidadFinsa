alter table public.requirement_types
  add column if not exists guidance text;

alter table public.evidences
  add column if not exists review_status text not null default 'PENDING';
alter table public.evidences
  add column if not exists review_note text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'evidences_review_status_check'
  ) then
    alter table public.evidences
      add constraint evidences_review_status_check
      check (review_status in ('PENDING', 'ACCEPTED', 'REJECTED'));
  end if;
end $$;

create table if not exists public.destination_presets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  destination text not null,
  modality public.delivery_modality not null,
  packages integer,
  default_assignee_id uuid references public.profiles (id),
  requirement_overrides jsonb not null default '[]'::jsonb,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.destination_presets enable row level security;

drop policy if exists destination_presets_select on public.destination_presets;
create policy destination_presets_select on public.destination_presets
  for select to authenticated
  using (public.current_role() in ('ADMIN', 'SUPERVISOR'));

drop policy if exists destination_presets_admin on public.destination_presets;
create policy destination_presets_admin on public.destination_presets
  for all to authenticated
  using (public.current_role() = 'ADMIN')
  with check (public.current_role() = 'ADMIN');

create or replace function public.can_read_delivery(target_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.deliveries d
    where d.id = target_id
      and (
        public.current_role() in ('ADMIN', 'SUPERVISOR')
        or (public.current_role() = 'PICKING' and d.status <> 'DRAFT')
      )
  )
$$;

drop policy if exists deliveries_select on public.deliveries;
create policy deliveries_select on public.deliveries
  for select to authenticated
  using (
    public.current_role() in ('ADMIN', 'SUPERVISOR')
    or (public.current_role() = 'PICKING' and status <> 'DRAFT')
  );
