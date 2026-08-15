-- Tanda A: devolver, tomar y reasignar quedan auditados con acciones propias.
alter type public.audit_action add value if not exists 'RETURNED';
alter type public.audit_action add value if not exists 'CLAIMED';
alter type public.audit_action add value if not exists 'REASSIGNED';
