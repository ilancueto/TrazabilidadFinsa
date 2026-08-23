-- Sprint 4.5: consulta ordenada para el panel y frontera de lectura de archivadas.
create index if not exists audit_events_created_at_id_idx
  on public.audit_events (created_at desc, id desc);

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
        or (
          public.current_role() = 'PICKING'
          and d.status <> 'DRAFT'
          and d.deleted_at is null
        )
      )
  )
$$;

drop policy if exists deliveries_select on public.deliveries;
create policy deliveries_select on public.deliveries
  for select to authenticated
  using (
    public.current_role() in ('ADMIN', 'SUPERVISOR')
    or (
      public.current_role() = 'PICKING'
      and status <> 'DRAFT'
      and deleted_at is null
    )
  );
