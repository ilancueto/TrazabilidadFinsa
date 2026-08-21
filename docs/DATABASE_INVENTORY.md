# Inventario de datos

Esquema aplicativo: `public`. Entidades principales: `profiles`, `deliveries`, `delivery_requirements`, `evidences`, `requirement_types`, `delivery_templates`, `template_requirements`, `clients`, `destination_presets` y `audit_events`.

El snapshot versionado está en `supabase/schema-baselines/v0.9-baseline-public.sql`. Hay 23 migraciones locales; el historial coincide con producción tras alinear timestamps (`docs/MIGRATION_RECONCILIATION.md`).

Índices duplicados en el snapshot: `audit_events_delivery_idx` / `idx_audit_events_delivery_created`; `evidences_active_idx` / `idx_evidences_req_active`; `deliveries_client_idx` / `idx_deliveries_client_id`.

