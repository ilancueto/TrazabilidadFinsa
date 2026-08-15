-- Tanda C enums. Tienen que commitearse antes de usarse en policies.
alter type public.user_role add value if not exists 'SUPERVISOR';
alter type public.audit_action add value if not exists 'EVIDENCE_REVIEWED';
