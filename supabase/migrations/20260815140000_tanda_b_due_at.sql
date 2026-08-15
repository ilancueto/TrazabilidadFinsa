alter table public.deliveries
  add column if not exists due_at timestamptz;

create index if not exists deliveries_due_at_idx
  on public.deliveries (due_at)
  where status not in ('CLOSED', 'DRAFT') and due_at is not null;
