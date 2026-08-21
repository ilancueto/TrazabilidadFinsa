-- Alinea bulk_assign_picker con assign_delivery: picker PICKING activo y
-- no muta DRAFT/CLOSED. SUPERVISOR sigue autorizado en el lote.
-- Picking puede cambiar assignee_id vía RPC (claim/release); el trigger
-- ya no lo trata como dato maestro. UPDATE directo de deliveries sigue revocado.

create or replace function public.bulk_assign_picker(
  p_delivery_ids uuid[],
  p_assignee_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_delivery_id uuid;
  v_user_role public.user_role;
  v_user_id uuid;
  v_picker_name text := 'Sin asignar';
begin
  v_user_role := public.current_role();
  v_user_id := auth.uid();

  if v_user_role not in ('ADMIN', 'SUPERVISOR') then
    raise exception 'No autorizado para asignar responsables en lote';
  end if;

  if p_delivery_ids is null or array_length(p_delivery_ids, 1) is null then
    raise exception 'Elegí al menos una entrega';
  end if;

  if p_assignee_id is not null then
    select full_name into v_picker_name
    from public.profiles
    where id = p_assignee_id and role = 'PICKING' and active and deleted_at is null;
    if v_picker_name is null then
      raise exception 'El responsable no está activo en Picking';
    end if;
  end if;

  foreach v_delivery_id in array p_delivery_ids
  loop
    update public.deliveries
    set
      assignee_id = p_assignee_id,
      updated_at = now()
    where id = v_delivery_id
      and deleted_at is null
      and status not in ('DRAFT', 'CLOSED');

    if found then
      v_count := v_count + 1;
      insert into public.audit_events (delivery_id, actor_id, action, metadata)
      values (
        v_delivery_id,
        v_user_id,
        'ASSIGNED',
        jsonb_build_object(
          'assignee_id', p_assignee_id,
          'assignee_name', v_picker_name,
          'bulk', true
        )
      );
    end if;
  end loop;

  return v_count;
end;
$$;

create or replace function public.enforce_delivery_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role public.user_role;
begin
  actor_role := public.current_role();

  if actor_role is null then
    return new;
  end if;

  if old.status = 'CLOSED' and actor_role <> 'ADMIN' then
    raise exception 'La entrega cerrada está bloqueada';
  end if;

  if actor_role = 'PICKING' then
    if new.number is distinct from old.number
      or new.modality is distinct from old.modality
      or new.carrier is distinct from old.carrier
      or new.destination is distinct from old.destination
      or new.packages is distinct from old.packages
      or new.priority is distinct from old.priority
      or new.created_by is distinct from old.created_by
      or new.closed_by is distinct from old.closed_by
      or new.closed_at is distinct from old.closed_at
    then
      raise exception 'Picking no puede editar datos maestros de la entrega';
    end if;

    if new.status = 'CLOSED' then
      raise exception 'Picking no puede cerrar una entrega';
    end if;
  end if;

  return new;
end;
$$;

-- Rollback (no aplicar en cadena; sólo si hay que revertir esta migración):
--
-- restore bulk_assign_picker from 20260818230000 (sin filtro de estado ni picker activo).
-- restore enforce_delivery_update from 20260821152000 (assignee_id otra vez maestro de Picking).
