-- Separa la identidad de acceso de la atribución histórica. El perfil se
-- conserva para que entregas, fotos y auditorías sigan mostrando el nombre
-- aunque la cuenta haya sido eliminada de Supabase Auth.

alter table public.profiles
  drop constraint if exists profiles_id_fkey;

alter table public.profiles
  add column if not exists deleted_at timestamptz;

alter table public.profiles
  add column if not exists deleted_by uuid references public.profiles (id);

create index if not exists profiles_deleted_by_idx
  on public.profiles (deleted_by)
  where deleted_by is not null;

comment on column public.profiles.deleted_at is
  'Fecha en que se eliminó la cuenta de acceso. El perfil se conserva para atribución histórica.';

comment on column public.profiles.deleted_by is
  'Administrador que eliminó la cuenta de acceso.';

create or replace function public.current_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = (select auth.uid())
    and active
    and deleted_at is null
$$;
