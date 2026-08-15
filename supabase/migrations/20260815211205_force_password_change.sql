-- Los accesos creados o reiniciados por Administración usan una clave temporal.
-- El usuario debe reemplazarla antes de entrar a la operación.

alter table public.profiles
  add column if not exists must_change_password boolean not null default true;

alter table public.profiles
  add column if not exists password_changed_at timestamptz;

-- Conserva el acceso normal de quienes ya habían ingresado antes de esta mejora.
-- Los usuarios que nunca iniciaron sesión quedan marcados para cambio obligatorio.
update public.profiles as profile
set must_change_password = false
from auth.users as auth_user
where auth_user.id = profile.id
  and auth_user.last_sign_in_at is not null;

comment on column public.profiles.must_change_password is
  'Obliga a reemplazar la contraseña temporal antes de usar la aplicación.';

comment on column public.profiles.password_changed_at is
  'Fecha del último cambio de contraseña confirmado desde la aplicación.';
