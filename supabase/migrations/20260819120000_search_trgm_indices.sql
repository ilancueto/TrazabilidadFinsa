create extension if not exists pg_trgm;

create index if not exists deliveries_number_trgm_idx
  on public.deliveries using gin (number gin_trgm_ops)
  where deleted_at is null;

create index if not exists deliveries_destination_trgm_idx
  on public.deliveries using gin (destination gin_trgm_ops)
  where deleted_at is null;

create index if not exists deliveries_pallet_trgm_idx
  on public.deliveries using gin (pallet_code gin_trgm_ops)
  where deleted_at is null and pallet_code is not null;
