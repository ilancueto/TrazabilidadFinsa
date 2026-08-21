create or replace function public.validate_evidence_storage_binding()
returns trigger
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  main_object storage.objects%rowtype;
  thumb_object storage.objects%rowtype;
begin
  if new.provider <> 'SUPABASE' then
    return new;
  end if;

  if new.storage_key is null
    or new.storage_key like '/%'
    or new.storage_key like '%..%'
    or position(new.id::text in new.storage_key) = 0
  then
    raise exception 'Ruta de evidencia inválida';
  end if;

  if new.mime_type not in ('image/jpeg', 'image/png', 'image/webp') then
    raise exception 'MIME de evidencia inválido';
  end if;

  if new.size_bytes is null or new.size_bytes <= 0 or new.size_bytes > 8388608 then
    raise exception 'Tamaño de evidencia inválido';
  end if;

  select * into main_object
  from storage.objects
  where bucket_id = 'evidences' and name = new.storage_key;

  if not found then
    raise exception 'El archivo de evidencia no existe en Storage';
  end if;

  if coalesce(main_object.metadata->>'mimetype', '') <> new.mime_type
    or coalesce((main_object.metadata->>'size')::bigint, -1) <> new.size_bytes
  then
    raise exception 'Los metadatos de evidencia no coinciden con Storage';
  end if;

  if new.thumbnail_storage_key is not null then
    if new.thumbnail_storage_key like '/%'
      or new.thumbnail_storage_key like '%..%'
      or position(new.id::text in new.thumbnail_storage_key) = 0
      or new.thumbnail_mime_type <> 'image/webp'
      or new.thumbnail_size_bytes is null
      or new.thumbnail_size_bytes <= 0
      or new.thumbnail_size_bytes > 8388608
    then
      raise exception 'Thumbnail de evidencia inválido';
    end if;

    select * into thumb_object
    from storage.objects
    where bucket_id = 'evidences' and name = new.thumbnail_storage_key;

    if not found then
      raise exception 'El thumbnail no existe en Storage';
    end if;

    if coalesce(thumb_object.metadata->>'mimetype', '') <> new.thumbnail_mime_type
      or coalesce((thumb_object.metadata->>'size')::bigint, -1) <> new.thumbnail_size_bytes
    then
      raise exception 'Los metadatos del thumbnail no coinciden con Storage';
    end if;
  elsif new.thumbnail_mime_type is not null or new.thumbnail_size_bytes is not null then
    raise exception 'Metadatos de thumbnail incompletos';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_evidence_storage_binding() from public, anon, authenticated;

drop trigger if exists evidences_validate_storage_binding on public.evidences;
create trigger evidences_validate_storage_binding
before insert or update of storage_key, mime_type, size_bytes, thumbnail_storage_key, thumbnail_mime_type, thumbnail_size_bytes
on public.evidences
for each row execute function public.validate_evidence_storage_binding();
