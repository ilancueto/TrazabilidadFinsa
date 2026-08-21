# Registro de riesgos

| Nivel | Riesgo | Estado / mitigación |
| --- | --- | --- |
| HIGH | Historial de migraciones local y productivo divergente. | Bloquea confirmar equivalencia; reconciliar en un PR específico y no aplicar migraciones a ciegas. |
| HIGH | No hay PITR ni backup físico de Supabase disponible. | Backup lógico local creado; pendiente cifrado y retención. |
| MEDIUM | Backup local sin cifrar. | Cifrar antes de moverlo o compartirlo. |
| MEDIUM | CI no ejecuta integración, E2E ni escaneo de seguridad. | Abordar en Sprint 3. |
| MEDIUM | `GET /api/deliveries/check-number` devuelve metadatos de entrega a cualquier sesión autenticada. | Restringir a ADMIN y responder sólo `exists` en el hardening de Sprint 2. |
| MEDIUM | RPCs `SECURITY DEFINER` con `GRANT ALL` a `anon` en el snapshot productivo. | El cuerpo exige sesión y rol; revocar `anon` en Sprint 2.4. |
| MEDIUM | `bulk_assign_picker` no valida picker activo ni excluye entregas `DRAFT`/`CLOSED`. | Alinear la RPC con `assign_delivery` en Sprint 2. |

