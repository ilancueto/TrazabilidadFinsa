# Inventario de datos

Esquema aplicativo: `public`. Entidades principales: `profiles`, `deliveries`, `delivery_requirements`, `evidences`, `requirement_types`, `delivery_templates`, `template_requirements`, `clients`, `destination_presets` y `audit_events`.

El snapshot versionado está en `supabase/schema-baselines/v0.9-baseline-public.sql`. Hay 23 migraciones locales; su historial no coincide aún con producción, registrado en el plan como riesgo bloqueante.

