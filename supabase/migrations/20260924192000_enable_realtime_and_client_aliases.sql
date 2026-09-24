-- Habilitar Realtime para entregas y crear tabla de alias/equivalencias de clientes SAP

-- 1. Habilitar replicación Realtime en la tabla deliveries si aún no está
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'deliveries'
  ) then
    alter publication supabase_realtime add table public.deliveries;
  end if;
end $$;

-- 2. Tabla de equivalencias / alias de clientes SAP
create table if not exists public.client_aliases (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  alias text not null,
  created_at timestamptz not null default now(),
  constraint client_aliases_alias_not_empty check (char_length(trim(alias)) >= 2)
);

create unique index if not exists client_aliases_alias_ci_idx
  on public.client_aliases (lower(trim(alias)));

create index if not exists client_aliases_client_idx
  on public.client_aliases (client_id);

-- RLS
alter table public.client_aliases enable row level security;

create policy client_aliases_select on public.client_aliases
  for select to authenticated
  using (true);

create policy client_aliases_admin_write on public.client_aliases
  for all to authenticated
  using (public.current_role() = 'ADMIN')
  with check (public.current_role() = 'ADMIN');

grant select, insert, update, delete on public.client_aliases to authenticated, service_role;
