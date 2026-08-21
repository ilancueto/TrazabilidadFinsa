# Registro de riesgos

| Nivel | Riesgo | Estado / mitigación |
| --- | --- | --- |
| HIGH | Historial de migraciones local y productivo divergente. | Bloquea confirmar equivalencia; reconciliar en un PR específico y no aplicar migraciones a ciegas. El snapshot coincide en cuerpos recientes de `bulk_close_ready_deliveries` y `register_evidence`, no en versiones. |
| MEDIUM | Migraciones con DML de clientes demo y tipos de requisito. | Aceptable con `on conflict`/`where not exists`; no reaplicar a producción. |
| HIGH | No hay PITR ni backup físico de Supabase disponible. | Backup lógico local creado; pendiente cifrado y retención. |
| MEDIUM | Backup local sin cifrar. | Cifrar antes de moverlo o compartirlo. |
| MEDIUM | CI no ejecuta integración, E2E ni escaneo de seguridad. | Abordar en Sprint 3. |
| MEDIUM | `GET /api/deliveries/check-number` devuelve metadatos de entrega a cualquier sesión autenticada. | Restringir a ADMIN y responder sólo `exists` en el hardening de Sprint 2. |
| MEDIUM | RPCs `SECURITY DEFINER` con `GRANT ALL` a `anon` en el snapshot productivo. | El cuerpo exige sesión y rol; revocar `anon` en Sprint 2.4. |
| MEDIUM | `bulk_assign_picker` no valida picker activo ni excluye entregas `DRAFT`/`CLOSED`. | Alinear la RPC con `assign_delivery` en Sprint 2. |
| MEDIUM | Permisos TS y RPCs divergen (soltar en READY, upload FLOOR en READY, SUPERVISOR en asignación masiva). | Unificar en Sprint 2.2; hoy la RPC es la que manda. |
| HIGH | RLS de `deliveries` permite a PICKING actualizar filas no cerradas, incluido `deleted_at` y `status`, sin pasar por RPC. | Restringir columnas/filas o forzar mutaciones sólo vía RPC en Sprint 2.4. |
| HIGH | `evidences_update_void` y `audit_insert` permiten anular/revisar evidencias o insertar auditoría eludiendo las RPCs. | Ajustar policies al contrato de las funciones en Sprint 2.4. |

