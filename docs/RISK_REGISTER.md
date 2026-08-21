# Registro de riesgos

| Nivel | Riesgo | Estado / mitigación |
| --- | --- | --- |
| LOW | Historial de migraciones: los filenames git usaban timestamps redondeados. | Cerrado en 1.1: `git mv` al version remoto. `migration list` 23/23. Ver `docs/MIGRATION_RECONCILIATION.md`. |
| MEDIUM | Migraciones con DML de clientes demo y tipos de requisito. | Aceptable con `on conflict`/`where not exists`; no reaplicar a producción. |
| HIGH | No hay PITR ni backup físico de Supabase disponible. | Backup lógico local cifrado y verificado; no reemplaza PITR. Ver `docs/BACKUP.md`. |
| MEDIUM | Clave de cifrado del backup y ciphertext en el mismo disco local. | Copiar la clave a un gestor de secretos / medio offline; no versionar. |
| MEDIUM | CI no ejecuta integración, E2E ni escaneo de seguridad. | Abordar en Sprint 3. |
| MEDIUM | `GET /api/deliveries/check-number` devuelve metadatos de entrega a cualquier sesión autenticada. | Restringir a ADMIN y responder sólo `exists` en el hardening de Sprint 2. |
| MEDIUM | RPCs `SECURITY DEFINER` con `GRANT ALL` a `anon` en el snapshot productivo. | El cuerpo exige sesión y rol; revocar `anon` en Sprint 2.4. |
| MEDIUM | `bulk_assign_picker` no valida picker activo ni excluye entregas `DRAFT`/`CLOSED`. | Alinear la RPC con `assign_delivery` en Sprint 2. |
| MEDIUM | Permisos TS y RPCs divergen (soltar en READY, upload FLOOR en READY, SUPERVISOR en asignación masiva). | Unificar en Sprint 2.2; hoy la RPC es la que manda. |
| LOW | UPDATE directo de `deliveries` por JWT. | Cerrado: se eliminó `deliveries_update` y se revocó `UPDATE` a `authenticated`/`anon`. RPCs definer siguen escribiendo. Ver `docs/RLS_REMEDIATION_PLAN.md` PR 1. |
| LOW | UPDATE directo de `evidences` (anular/revisar). | Cerrado: se eliminó `evidences_update_void` y se revocó `UPDATE` a `authenticated`/`anon`. RPCs y thumbnail definer siguen. Ver `docs/RLS_REMEDIATION_PLAN.md` PR 2. |
| HIGH | `audit_insert` permite fabricar auditoría eludiendo las RPCs. | Plan en `docs/RLS_REMEDIATION_PLAN.md` (PR 3). Sin migración en este corte. |

