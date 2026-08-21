# Registro de riesgos

| Nivel | Riesgo | Estado / mitigación |
| --- | --- | --- |
| LOW | Historial de migraciones: los filenames git usaban timestamps redondeados. | Cerrado en 1.1: `git mv` al version remoto. `migration list` 23/23. Ver `docs/MIGRATION_RECONCILIATION.md`. |
| MEDIUM | Migraciones con DML de clientes demo y tipos de requisito. | Aceptable con `on conflict`/`where not exists`; no reaplicar a producción. |
| HIGH | No hay PITR ni backup físico de Supabase disponible. | Backup lógico local cifrado y verificado; no reemplaza PITR. Ver `docs/BACKUP.md`. |
| MEDIUM | Clave de cifrado del backup y ciphertext en el mismo disco local. | Copiar la clave a un gestor de secretos / medio offline; no versionar. |
| MEDIUM | CI no ejecuta integración ni E2E. | Security scanning base ya quedó activo en 2.5; integración/E2E se completa en Sprint 3. |
| MEDIUM | `exceljs@4.4.0` arrastra `uuid@8.3.2`, reportado por `npm audit` con 2 vulnerabilidades MODERATE. | Aceptado temporalmente en 2.5: no hay fix automático no disruptivo; HIGH/CRITICAL bloquean CI y este hallazgo queda bajo seguimiento. Ver `docs/DEPENDENCY_SECURITY.md`. |
| LOW | Dependencias transitivas obsoletas/deprecadas (`inflight`, `rimraf@2`, `lodash.isequal`, `glob@7`, `fstream`, `uuid@8`). | Registradas en 2.5. Dependabot + revisión periódica; no forzar cambios breaking sin regresión probada. |
| LOW | `GET /api/deliveries/check-number` exponía metadatos a cualquier sesión autenticada. | Cerrado en 2.4: sólo `ADMIN`; conserva únicamente el indicador de duplicado y el mismo número consultado, sin metadatos operativos reales. |
| LOW | RPCs `SECURITY DEFINER` tenían ejecución para `anon`. | Cerrado en 2.4: `anon` sin ejecución de RPCs de negocio; helpers internos tampoco son invocables por usuarios finales. |
| LOW | `anon` conservaba privilegios SQL base sobre tablas `public`, aunque RLS lo bloqueaba. | Cerrado en 2.4: revocados todos los privilegios de tablas/secuencias `public` a `anon`. |
| LOW | `pg_trgm` está instalado en `public`. | Aceptado/diferido: tres índices productivos dependen de `gin_trgm_ops`; moverlo requiere ventana controlada. No es una exposición explotable por sí sola. |
| LOW | Supabase Auth tiene leaked-password protection deshabilitado. | Pendiente operativo: habilitar desde configuración de Auth si el plan/proyecto lo permite. No requiere cambio de aplicación. |
| LOW | `bulk_assign_picker` no validaba picker activo ni excluía `DRAFT`/`CLOSED`. | Cerrado en 2.2: migración `20260821160000`. SUPERVISOR sigue autorizado en el lote. |
| LOW | Permisos TS y RPCs divergían (soltar en READY, upload FLOOR en READY, SUPERVISOR en lote). | Cerrado en 2.2: `docs/BUSINESS_RULES.md`; helpers y UI alineados a las RPCs. |
| LOW | UPDATE directo de `deliveries` por JWT. | Cerrado: se eliminó `deliveries_update` y se revocó `UPDATE` a `authenticated`/`anon`. RPCs definer siguen escribiendo. Ver `docs/RLS_REMEDIATION_PLAN.md` PR 1. |
| LOW | UPDATE directo de `evidences` (anular/revisar). | Cerrado: se eliminó `evidences_update_void` y se revocó `UPDATE` a `authenticated`/`anon`. RPCs y thumbnail definer siguen. Ver `docs/RLS_REMEDIATION_PLAN.md` PR 2. |
| LOW | INSERT directo de `audit_events`. | Cerrado: se eliminó `audit_insert` y se revocó `INSERT` a `authenticated`/`anon`. Las RPCs definer siguen auditando. Ver `docs/RLS_REMEDIATION_PLAN.md` PR 3. |
| LOW | Una RPC de evidencia podía recibir una `storage_key` arbitraria suministrada por cliente. | Cerrado en 2.4: trigger DB valida bucket, existencia del objeto, UUID en path y coincidencia de MIME/tamaño contra `storage.objects`. |
