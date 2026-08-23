# Matriz RBAC — FINSA Trazabilidad

## Propósito

Este documento formaliza los permisos efectivos de los roles `PICKING`, `SUPERVISOR` y `ADMIN`.

No define permisos aspiracionales. Describe el comportamiento vigente y dónde se hace cumplir cada autorización. La autoridad final de mutaciones críticas sigue estando en RPCs/backend; los helpers TypeScript y la UI representan esas reglas para UX y prevalidación.

Referencias:

- `docs/BUSINESS_RULES.md`
- `src/lib/deliveries/permissions.ts`
- `src/lib/actions/deliveries.ts`
- RPCs y RLS versionadas en `supabase/migrations/`

## Principios

1. Ocultar un botón no constituye autorización.
2. Toda mutación crítica debe ser rechazada por backend si el rol no corresponde.
3. `SUPERVISOR` es principalmente un rol de lectura/operación de oficina con una excepción explícita: asignación masiva de responsables.
4. `PICKING` opera el trabajo de piso y evidencias, pero no administra maestros ni cierra entregas.
5. `ADMIN` es el único rol con autoridad de administración, revisión, cierre y excepciones.
6. Las restricciones por estado se aplican además de las restricciones por rol.

---

## Matriz principal

| Acción | PICKING | SUPERVISOR | ADMIN | Restricciones / autoridad |
| --- | --- | --- | --- | --- |
| Ver operaciones no borrador | Sí | Sí | Sí | Lectura bajo RLS / consultas de sesión |
| Ver entregas archivadas | No | Sí | Sí | `deliveries_select` + `can_read_delivery`; PICKING queda excluido |
| Ver `DRAFT` | No | Sí | Sí | `canSeeDrafts`; PICKING queda excluido |
| Acceder a área Picking | Sí | No | Sí | `canAccessPicking` |
| Acceder a área Oficina/Admin | No | Sí | Sí | `canAccessAdmin` |
| Crear entrega | No | No | Sí | `saveDeliveryAction` + `save_delivery` |
| Editar datos maestros | No | No | Sí | Permitido mientras no esté `CLOSED` |
| Editar requisitos | No | No | Sí | Misma regla que datos maestros |
| Publicar / volver a borrador | No | No | Sí | `save_delivery`; volver a borrador requiere no tener evidencia activa |
| Duplicar entrega | No | No | Sí | Helper/acción administrativa |
| Archivar entrega | No | No | Sí | `archive_delivery` |
| Tomar trabajo libre | Sí | No | No | PICKING; sólo `PUBLISHED`/`IN_PICKING`; debe estar libre |
| Soltar trabajo propio | Sí | No | No | PICKING; sólo `PUBLISHED`/`IN_PICKING` y asignado al usuario |
| Soltar asignación como administrador | No | No | Sí | Estados asignables: no `DRAFT`/`CLOSED` |
| Reasignar una entrega | No | No | Sí | No `DRAFT`/`CLOSED`; destinatario PICKING válido |
| Asignar responsables en lote | No | Sí | Sí | `bulk_assign_picker`; sólo destinos PICKING activos y estados permitidos |
| Asignar libres automáticamente | No | No | Sí | `bulk_assign_unassigned` |
| Asignar pallet/lote | No | No | Sí | `bulk_assign_pallet` |
| Cargar evidencia FLOOR | Sí | No | Sí | Sólo `PUBLISHED`/`IN_PICKING` |
| Cargar evidencia DISPATCH | Sí | No | Sí | `PUBLISHED`/`IN_PICKING`/`READY` |
| Anular evidencia | Sí | No | Sí | No `DRAFT`/`CLOSED`; reglas de estado pueden revertir READY |
| Agregar observación | Sí | No | Sí | PICKING sólo fuera de `DRAFT`; nadie en `CLOSED` |
| Resolver observación | No | No | Sí | No `CLOSED` |
| Marcar `READY` | Sí | No | Sí | Desde `PUBLISHED`/`IN_PICKING`; FLOOR obligatorio completo |
| Revisar evidencia | No | No | Sí | En flujo normal de revisión, `READY` |
| Devolver a Picking | No | No | Sí | `READY` → `IN_PICKING`, con motivo/observación |
| Cierre normal | No | No | Sí | Sólo `READY`; sin observación abierta; requisitos obligatorios completos |
| Reabrir | No | No | Sí | Sólo `CLOSED` → `IN_PICKING`, con motivo |
| Cierre excepcional masivo | No | No | Sí | Fuerza cierre de activas; requiere confirmación y motivo; auditable |
| Descargar reporte | No | Sí | Sí | `canDownloadReport` |
| Ver tablero/cierre de día | No | Sí | Sí | `canViewDayBoard` |
| Gestionar usuarios | No | No | Sí | `canManageUsers` |
| Gestionar catálogo/requisitos | No | No | Sí | `canManageCatalog` |

---

## Permisos por estado

### `DRAFT`

- `ADMIN`: lectura, edición de maestros/requisitos, publicación, observación y archivo según flujo.
- `SUPERVISOR`: lectura únicamente.
- `PICKING`: no puede ver la entrega.
- No se pueden cargar evidencias, tomar trabajo, marcar lista ni cerrar.

### `PUBLISHED`

- Todos los roles con lectura pueden verla.
- `PICKING`: puede tomar si está libre, soltar si es propia, cargar FLOOR/DISPATCH, agregar observación y marcar `READY` cuando FLOOR obligatorio esté completo.
- `SUPERVISOR`: lectura y asignación masiva de responsables.
- `ADMIN`: administración, asignación, evidencias y operaciones de workflow permitidas.

### `IN_PICKING`

Misma matriz operativa principal que `PUBLISHED`, salvo que el trabajo ya inició. `PICKING` puede operar evidencias, asignación propia y marcar `READY` cuando corresponda.

### `READY`

- `PICKING`: no puede tomar/soltar; puede cargar o anular evidencia `DISPATCH` y agregar observaciones.
- `SUPERVISOR`: lectura y asignación masiva según RPC; no revisa evidencia ni cierra.
- `ADMIN`: puede cargar DISPATCH, revisar evidencia, resolver observaciones, devolver a picking, reasignar y cerrar si se cumplen precondiciones.
- FLOOR nuevo está prohibido.

### `CLOSED`

- Sólo lectura para operación normal.
- `ADMIN` puede reabrir con motivo.
- No se permiten nuevas evidencias ni observaciones.

---

## Matriz de autoridad técnica

| Dominio | UX / prevalidación | Server Action / API | Autoridad final |
| --- | --- | --- | --- |
| Crear/editar/publicar | `permissions.ts` | `saveDeliveryAction` | `save_delivery` |
| Estado READY/CLOSED/reapertura | `permissions.ts`, `state.ts` | actions de workflow | `transition_delivery` |
| Claim/release/reasignación | `permissions.ts` | actions de asignación | `assign_delivery` |
| Asignación masiva | helpers/UI | action correspondiente | `bulk_assign_picker` / RPC de lote |
| Evidencias | `canUploadFloor/Dispatch`, `canVoidEvidence` | API/actions | `register_evidence`, `void_evidence` |
| Revisión | `canReviewEvidence` | action de revisión | `review_evidence` |
| Observaciones | helpers | actions | `record_observation` |
| Archivo | helper | action | `archive_delivery` |
| Cierre excepcional | UI administrativa | Server Action | `bulk_close_ready_deliveries` |
| Lectura | rutas/UI | consultas Supabase | RLS |

La UI nunca debe ampliar la autoridad descrita en esta tabla. Si una prevalidación TypeScript diverge de la RPC, la RPC prevalece y la divergencia se considera bug.

---

## Decisiones formales de Sprint 2.3

### Supervisor

El rol `SUPERVISOR` **no** es un `ADMIN` limitado. Su alcance vigente es:

- lectura de operaciones, incluidos borradores;
- acceso a Oficina, reportes, tablero y cierre de día;
- asignación masiva de responsables mediante la RPC específica;
- sin carga de evidencias;
- sin revisión de evidencias;
- sin cierre normal ni excepcional;
- sin reapertura;
- sin edición de maestros;
- sin gestión de usuarios o catálogo.

La tabla preliminar de `ENTERPRISE_PLAN.md` que indicaba “Revisar evidencia: Sí” para Supervisor era una referencia a definir, no el comportamiento implementado. El comportamiento formal vigente es **No**.

### Picking

`PICKING` tiene autoridad operacional sobre trabajo asignable y evidencia, pero no autoridad administrativa. Puede llevar una entrega desde `PUBLISHED/IN_PICKING` a `READY` cuando completa FLOOR; puede completar DISPATCH en `READY`, pero no puede cerrar.

### Admin

`ADMIN` concentra las operaciones administrativas y de control: creación, edición, revisión, cierre, reapertura, excepciones, usuarios y catálogo. Las acciones destructivas o excepcionales deben permanecer auditadas.

---

## Casos que deben permanecer testeados

- PICKING no puede crear, editar maestros, revisar, cerrar ni reabrir.
- PICKING no puede tomar/soltar en `READY`.
- PICKING puede cargar DISPATCH en `READY` pero no FLOOR.
- SUPERVISOR no puede mutar workflow ni evidencias.
- SUPERVISOR puede ejecutar la asignación masiva definida para su rol.
- ADMIN puede cerrar sólo bajo las precondiciones del cierre normal.
- Sólo ADMIN puede ejecutar cierre excepcional.
- Usuario deshabilitado debe perder autoridad efectiva; su verificación integral corresponde a Sprint 2.4.
- Ningún permiso de UI debe permitir saltar la denegación del backend.

---

## Hallazgos fuera del alcance de 2.3

La matriz no corrige hardening pendiente. Se mantienen para Sprint 2.4/2.5:

- revisión exhaustiva de RLS en todas las tablas;
- revisión de `SECURITY DEFINER`, `search_path` y grants;
- Storage y signed URLs;
- validación efectiva de usuario deshabilitado;
- supply-chain scanning y SBOM;
- hallazgos técnicos abiertos ya registrados en `docs/RISK_REGISTER.md` / `docs/AUDIT_REPORT.md`.

## Criterio de salida de 2.3

Sprint 2.3 se considera completo cuando:

1. cada operación relevante tiene un permiso inequívoco por rol;
2. las restricciones por estado están documentadas;
3. se identifica la autoridad técnica que hace cumplir cada mutación;
4. las diferencias entre la tabla preliminar y el comportamiento vigente quedan resueltas documentalmente;
5. los hardenings pendientes se mantienen explícitamente fuera de alcance para 2.4.
