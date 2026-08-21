# Reglas de negocio — fuente de verdad

Sprint 2.2. Semántica de modalidad/carrier: `docs/DOMAIN_MODEL.md`. Este documento no la duplica.

## Fuente de autoridad

```text
Backend/RPC  = autoridad final (mutación)
TS helpers   = representación para UX y prevalidación
UI           = consume helpers; no inventa reglas
```

Las mutaciones críticas pasan por RPCs `SECURITY DEFINER`. TypeScript no sustituye al backend. Si UI y RPC divergen, gana la RPC salvo bug demostrado en SQL.

| Acción | RPC / función |
| --- | --- |
| Crear / editar / publicar / volver a borrador | `save_delivery` |
| Marcar lista / cerrar / devolver / reabrir | `transition_delivery` |
| Tomar / soltar / reasignar una | `assign_delivery` |
| Asignar libres (inbox) | `bulk_assign_unassigned` |
| Asignar responsables en lote | `bulk_assign_picker` |
| Asignar lote/pallet | `bulk_assign_pallet` |
| Cargar evidencia | `register_evidence` vía `register_evidence_v2` |
| Anular evidencia | `void_evidence` |
| Revisar evidencia | `review_evidence` |
| Observación alta/resolución | `record_observation` |
| Archivar | `archive_delivery` |
| Cierre excepcional | `bulk_close_ready_deliveries` |

Helpers TS: `src/lib/deliveries/permissions.ts` y `src/lib/deliveries/state.ts`. Progreso FLOOR/DISPATCH: `src/lib/deliveries/progress.ts`.

---

## Estados

| Estado | Quién lo ve | Editar maestros | Asignar | Tomar | Soltar | FLOOR | DISPATCH | Observación | Cerrar | Reabrir |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `DRAFT` | ADMIN (y SUPERVISOR lectura) | ADMIN | no (`save_delivery` sí puede setear assignee al guardar) | no | no | no | no | ADMIN | no | no |
| `PUBLISHED` | todos los roles de lectura | ADMIN | ADMIN; SUPERVISOR en lote | PICKING si libre | PICKING propio; ADMIN | ADMIN/PICKING | ADMIN/PICKING | ADMIN/PICKING | no | no |
| `IN_PICKING` | todos | ADMIN | igual | PICKING si libre | PICKING propio; ADMIN | ADMIN/PICKING | ADMIN/PICKING | ADMIN/PICKING | no | no |
| `READY` | todos | ADMIN | ADMIN; SUPERVISOR en lote | no | ADMIN (no PICKING) | no | ADMIN/PICKING | ADMIN/PICKING | ADMIN si precondiciones | no |
| `CLOSED` | todos | no | no | no | no | no | no | no | no | ADMIN |

PICKING no ve `DRAFT` (`can_read_delivery`). SUPERVISOR no muta workflow salvo `bulk_assign_picker`.

Prohibido en todos los estados: PICKING cerrar, reabrir, editar maestros, revisar fotos, gestionar usuarios/catálogo. SUPERVISOR no carga evidencias ni cierra.

---

## Transiciones

### Explícitas (`transition_delivery` / `save_delivery`)

| Estado actual | Acción | Destino | Roles | Precondiciones |
| --- | --- | --- | --- | --- |
| — | crear borrador | `DRAFT` | ADMIN | requisitos en el payload |
| — | crear y publicar | `PUBLISHED` | ADMIN | requisitos publicables |
| `DRAFT` | publicar | `PUBLISHED` | ADMIN | `save_delivery` intent `publish` |
| `PUBLISHED` | volver a borrador | `DRAFT` | ADMIN | sin evidencias activas |
| `PUBLISHED` | marcar lista | `READY` | ADMIN, PICKING | FLOOR obligatorios completos |
| `IN_PICKING` | marcar lista | `READY` | ADMIN, PICKING | FLOOR obligatorios completos |
| `READY` | cerrar (normal) | `CLOSED` | ADMIN | sin observación abierta; todos los obligatorios aplicables `COMPLETE` (incluye DISPATCH) |
| `READY` | devolver | `IN_PICKING` | ADMIN | motivo; deja observación abierta |
| `CLOSED` | reabrir | `IN_PICKING` | ADMIN | motivo |

No existe `PUBLISHED → IN_PICKING` en `transition_delivery`.

### Implícitas (efecto colateral)

| Disparo | Destino | Quién | Notas |
| --- | --- | --- | --- |
| Primera evidencia en `PUBLISHED` | `IN_PICKING` | ADMIN/PICKING vía `register_evidence` | auditoría `PICKING_STARTED` |
| Anular evidencia FLOOR en `READY` y queda piso incompleto | `IN_PICKING` | ADMIN/PICKING vía `void_evidence` | |
| Rechazar foto en `READY` | `IN_PICKING` | ADMIN vía `review_evidence` | abre observación |

Soltar, tomar, reasignar, observación y archivo **no** cambian `status`.

### Cierre excepcional (no es transición de workflow)

`bulk_close_ready_deliveries`: ADMIN, confirmación `CERRAR TODAS`, motivo ≥ 5 caracteres. Fuerza `CLOSED` en **toda** entrega no archivada y no cerrada (`DRAFT`/`PUBLISHED`/`IN_PICKING`/`READY`), sin exigir evidencias ni resolver observaciones. Auditoría `CLOSED` con `exceptional`, `forced`, `bypassed*`. No usar para operación diaria.

---

## Evidencias FLOOR

- Carga: ADMIN o PICKING; estados `PUBLISHED` o `IN_PICKING`. **No** en `DRAFT`, `READY` ni `CLOSED`.
- En `READY` el backend rechaza FLOOR: «En una entrega lista sólo se pueden cargar evidencias de despacho».
- Obligatorios de piso incompletos bloquean `READY`, no el cierre por sí solos (en `READY` el piso ya está completo, salvo anulación).
- Evidencia anulada o `REJECTED` deja de contar como activa (`hasActiveEvidence`).
- Anular en `READY` un FLOOR que deja el piso incompleto revierte a `IN_PICKING`.

## Evidencias DISPATCH

- Carga: ADMIN o PICKING; `PUBLISHED`, `IN_PICKING` o `READY`. **No** `DRAFT`/`CLOSED`.
- `DESPACHO` (carrier Andreani hoy) incluye `ETIQUETAS` DISPATCH; `CUSTOMER_PICKUP` no. Pueden existir `ETIQUETAS_TECPETROL` / `ETIQUETAS_PLUSPETROL` según cliente.
- Obligatorios DISPATCH **no** bloquean `READY`. **Sí** bloquean el cierre normal.
- Anular DISPATCH en `READY` no revierte estado si el piso sigue completo; el cierre queda bloqueado hasta recargar.

No se cambia la semántica de tipos de requisito en 2.2.

---

## Cierre normal

Una sola regla:

1. Rol `ADMIN`.
2. Estado `READY`.
3. Sin `has_open_observation`.
4. Cero requisitos `required + applicable` con `status <> COMPLETE` (piso y despacho).
5. Revisión de fotos no es precondición de cierre: se puede cerrar con reviews `PENDING`.
6. Motivo no se pide en el cierre unitario; el excepcional sí.

Cierre por lote en `/admin/revision` reutiliza la misma regla entrega por entrega (`closeDeliveryAction`), no el RPC excepcional.

## Reapertura

ADMIN, sólo `CLOSED` → `IN_PICKING`, con motivo. Limpia `closed_at` / `closed_by`.

---

## Observaciones

No son un estado (`docs/DECISIONS.md`). Flag `has_open_observation` + texto.

- Alta: no `CLOSED`; ADMIN o PICKING. PICKING no ve `DRAFT`, así que en la práctica el borrador es ADMIN.
- Resolver: ADMIN, no `CLOSED`.
- Devolver a picking y rechazar foto abren observación.

---

## Roles (base para 2.3; no es la matriz formal)

| Acción | PICKING | SUPERVISOR | ADMIN |
| --- | --- | --- | --- |
| Ver no-borrador | Sí | Sí | Sí |
| Ver `DRAFT` | No | Sí | Sí |
| Cargar FLOOR / DISPATCH | Según estado | No | Según estado |
| Tomar / soltar propia | `PUBLISHED`/`IN_PICKING` | No | Soltar sí; tomar no (el assignee debe ser PICKING) |
| Reasignar una | No | No | Sí, salvo `DRAFT`/`CLOSED` |
| Asignar en lote (`bulk_assign_picker`) | No | Sí | Sí |
| Asignar libres / pallet | No | No | Sí |
| Crear / editar / publicar | No | No | Sí |
| Marcar lista | Sí | No | Sí |
| Revisar evidencia | No | No (lectura) | Sí, en `READY` |
| Cierre normal | No | No | Sí |
| Reabrir | No | No | Sí |
| Cierre excepcional | No | No | Sí |
| Usuarios / catálogo | No | No | Sí |
| Reportes / tablero / día | No | Sí | Sí |

---

## Decisiones sobre contradicciones

### 1. Soltar en `READY`

- **Regla:** PICKING no suelta ni toma en `READY`. ADMIN puede reasignar o soltar en `READY`.
- **Autoridad:** `assign_delivery` (PICKING sólo `PUBLISHED`/`IN_PICKING`).
- **Equívoco:** `canReleaseDelivery` permitía PICKING en `READY`; el botón aparecía y la RPC rechazaba.
- **Corrección:** el helper y la UI siguen a la RPC.
- **Prueba:** unitaria de `canReleaseDelivery`; integración PICKING `assign_delivery` en `READY`.

### 2. Cargar FLOOR en `READY`

- **Regla:** en `READY` sólo DISPATCH.
- **Autoridad:** `register_evidence`.
- **Equívoco:** `canUploadEvidence` no distinguía etapa; el checklist ofrecía «Subir foto» de piso.
- **Corrección:** `canUploadFloor` / `canUploadDispatch`; persist y captura usan la etapa.
- **Prueba:** unitaria por etapa; integración FLOOR denegado y DISPATCH aceptado en `READY`.

### 3. Cerrar con observación abierta

- **Regla:** el cierre normal exige observación resuelta.
- **Autoridad:** `transition_delivery` (y la Server Action, que ya lo chequeaba).
- **Equívoco:** `canClose` no miraba el flag; el botón se habilitaba.
- **Corrección:** `canClose` recibe precondiciones; la UI deshabilita con el motivo.
- **Prueba:** unitaria; integración `CLOSED` con observación abierta.

### 4. SUPERVISOR en asignación masiva

- **Regla:** son operaciones distintas. `assign_delivery` (una entrega) = ADMIN o PICKING (claim/release). `bulk_assign_picker` = ADMIN o SUPERVISOR.
- **Autoridad:** cada RPC.
- **Equívoco:** comparar `canReassignDelivery` (ADMIN) con el lote. No es la misma acción. El lote **sí** era más laxo: no validaba picker activo ni excluía `DRAFT`/`CLOSED`.
- **Corrección:** se mantiene SUPERVISOR en el lote (RPC original). Se alinea el lote con `assign_delivery` en destinatario PICKING activo y estados no `DRAFT`/`CLOSED`. Helper `canBulkAssignPicker`. La UI de pallet (sólo ADMIN) se oculta al SUPERVISOR.
- **Prueba:** SUPERVISOR lote válido; PICKING lote denegado; lote no toca `DRAFT`; assignee no-PICKING rechazado.

Ninguna de las cuatro quedó `REQUIERE DEFINICIÓN`.

---

## Excepciones

- Cierre excepcional: ver arriba. Documentado también en `docs/CierreExcepcional.md`.
- Compatibilidad `save_delivery(ANDREANI)` → `DESPACHO` + carrier: Sprint 2.1, no es regla de workflow.
- `TEMPLATE_SPECS` en TS es fallback si la plantilla de base viene vacía; el catálogo vivo está en `delivery_templates`.

## Fuera de alcance (registrado, no resuelto aquí)

- Matriz RBAC formal (`docs/RBAC_MATRIX.md`, Sprint 2.3).
- `GRANT ALL` a `anon` en RPCs (Sprint 2.4).
- `bulk_assign_pallet` puede etiquetar `DRAFT`/`CLOSED` (LOW previo).
- `/api/deliveries/check-number` metadatos a cualquier sesión.
- Revisión de evidencia no es puerta de cierre (queda explícito: no se exige `ACCEPTED` para cerrar).
