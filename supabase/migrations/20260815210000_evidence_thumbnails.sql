alter table public.evidences
  add column if not exists thumbnail_storage_key text;
alter table public.evidences
  add column if not exists thumbnail_mime_type text;
alter table public.evidences
  add column if not exists thumbnail_size_bytes integer;

create or replace function public.register_evidence_v2(
  p_evidence_id uuid,
  p_requirement_id uuid,
  p_storage_key text,
  p_filename text,
  p_mime_type text,
  p_size_bytes integer,
  p_width integer,
  p_height integer,
  p_checksum text,
  p_comment text,
  p_thumbnail_storage_key text,
  p_thumbnail_mime_type text,
  p_thumbnail_size_bytes integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  delivery_id uuid;
begin
  delivery_id := public.register_evidence(
    p_evidence_id, p_requirement_id, p_storage_key, p_filename, p_mime_type,
    p_size_bytes, p_width, p_height, p_checksum, p_comment
  );
  update public.evidences set
    thumbnail_storage_key = p_thumbnail_storage_key,
    thumbnail_mime_type = p_thumbnail_mime_type,
    thumbnail_size_bytes = p_thumbnail_size_bytes
  where id = p_evidence_id;
  return delivery_id;
end;
$$;

grant execute on function public.register_evidence_v2(uuid, uuid, text, text, text, integer, integer, integer, text, text, text, text, integer) to authenticated;
