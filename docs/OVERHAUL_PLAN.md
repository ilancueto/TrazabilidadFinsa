# Plan de implementación — Overhaul operativo

App: Trazabilidad de Entregas · Finning CAT  
Alcance: puntos 1 a 6 del overhaul de producto.  
Fuera de alcance (punto 7): OCR, SAP, Andreani API, cola offline, push, chat, GPS.

Principio: no se inventa un circuito nuevo. Se profundiza  
**Entrega → Requisitos → Evidencias → Revisión → Cierre**.

La estética negra Marca CAT se mantiene. Este plan no la reabre.

---

## 0. Cómo se construye

Tres tandas. Cada una entra a producción y se puede usar al día siguiente.  
No se empieza la siguiente si la anterior no está estable en iPhone y PC.

| Tanda | Nombre | Semanas (orientativo) | Qué gana la bodega |
|---|---|---|---|
| A | Circuito de revisión | 2 | Admin puede devolver. Picking avanza foto a foto. |
| B | Turno y control | 2 | Hay cola, hora límite, cierre de día y Excel. |
| C | Sistema de empresa | 2 | Informe de auditoría, televisor, plantillas por destino, Supervisor. |

Regla de cada item: migración si toca datos → acción server-side + permiso + auditoría → UI → prueba en celu y PC.

No hay mock. `localStorage` no es fuente de verdad.

---

## 1. Base que ya existe (no se rompe)

- Estados: `DRAFT → PUBLISHED → IN_PICKING → READY → CLOSED`
- `READY → IN_PICKING` ya está permitido a Admin en `src/lib/deliveries/state.ts` (hoy no hay botón de “devolver”)
- `assignee_id` ya existe; no es una cola
- Fotos: `POST /api/evidence`, HEIC, void, COMPLETE
- Catálogo de requisitos y usuarios Admin ya están
- PDF server-side en `/admin/deliveries/:id/report`

Todo lo nuevo se engancha acá. No se cambia la máquina de estados salvo agregar **acciones y metadatos**, no estados de moda.

---

## Tanda A — Circuito de revisión

Objetivo: que una entrega Lista se pueda **aceptar o devolver**, y que Picking no tenga que volver al checklist a cada foto.

### A1. Devolver a Picking

**Negocio.** Admin ve una Lista, no le cierra, la manda de nuevo al piso con un motivo. El motivo es obligatorio. Queda en historial y en observaciones.

**Datos.** Sin columna nueva al inicio. Se reusa:

- transición `READY → IN_PICKING` (ya permitida)
- `writeAudit` con acción nueva `RETURNED` (hay que ampliar el enum `audit_action`)
- se appendea una línea en `observations` y se prende `has_open_observation`

**Migración.**

```sql
alter type public.audit_action add value if not exists 'RETURNED';
alter type public.audit_action add value if not exists 'CLAIMED';
alter type public.audit_action add value if not exists 'REASSIGNED';
```

**Código.**

- `canReturnToPicking(role, status)` → Admin y `READY`
- `returnToPickingAction(deliveryId, reason)`
- UI en `status-actions.tsx`: “Devolver a Picking” + motivo
- Picking: banner “Te la devolvieron: {motivo}”

**Prueba.** Entrega Lista → devolver → Picking la ve En Picking → READY bloqueado hasta completar de nuevo si se anuló una foto.

### A2. Bandeja de revisión

**Negocio.** Admin entra y ve primero lo que hay que revisar, no toda la tabla.

**UI.**

- Nueva ruta `/admin/revision` o el tablero con pestaña **Para revisar** (filtro `status=READY` + fotos)
- Cada fila: número, destino, progreso, “Abrir revisión”
- Pantalla `/admin/deliveries/:id/revisar`: fotos grandes por requisito, aprobar (cerrar) o devolver

**Código.** Reusa `listDeliveries({ status: "READY" })` y `getDeliveryDetail`. No hace falta tabla nueva.

**Prueba.** Tres Listas aparecen en la bandeja. Cerrar una la saca. Devolverla también.

### A3. Cola “Siguiente foto”

**Negocio.** En el celu: sacar, subir, caer en el próximo requisito. Sin volver a la entrega.

**Hoy.** Después de subir, va a `/picking/:id?uploaded=1`.

**Cambio.**

- `persistEvidence` / redirect de `/api/evidence` y el `router.replace` de `evidence-capture.tsx`  
  → si hay `nextPendingRequirement`, ir a `/picking/:id/:nextId?uploaded=1`
- Botón fijo **Siguiente** en el detalle
- Al terminar los obligatorios: “Ya está. Podés marcarla lista.”

**Prueba.** iPhone: 3 requisitos seguidos sin volver al checklist.

### A4. Tomar / soltar entrega

**Negocio.** Picking toca “La tomo yo”. Queda `assignee_id` y evento `CLAIMED`. Admin puede reasignar (`REASSIGNED`).

**Datos.** Columna existente `assignee_id`.

**Código.**

- `claimDeliveryAction` (PICKING, no CLOSED)
- `reassignDeliveryAction` (ADMIN)
- Lista Picking: sección **Mías** y **Sin asignar**
- Admin: selector de responsable que ya está, más auditoría

**Prueba.** Emilio toma una. Ilan se la pasa. La lista de Emilio cambia.

### A5. Comparar fotos (mínimo viable)

**Negocio.** En la revisión, ver remito y etiquetas juntos.

**UI.** En `/revisar`, grilla 2 columnas de requisitos con foto activa. Clic agranda (lightbox ya existe).

Sin anotación todavía (eso es C).

**Listo tanda A cuando:** se puede devolver con motivo, revisar en una bandeja, cargar 4 fotos seguidas en el iPhone, y tomar una entrega.

---

## Tanda B — Turno y control

Objetivo: saber qué sale hoy, quién la tiene, y cómo cerró el día.

### B1. Hora límite

**Datos.**

```sql
alter table public.deliveries
  add column due_at timestamptz;
create index deliveries_due_at_idx on public.deliveries (due_at)
  where status not in ('CLOSED', 'DRAFT') and due_at is not null;
```

**UI.** En alta/edición: “Sale hoy / mañana / hora”.  
Listas Admin y Picking: orden **vencidas → urgentes → resto**.  
Chip “Vence 16:00” / “Vencida”.

**Código.** `deliveryInputSchema` + `listDeliveries` sort. No cambia estados.

### B2. Asignación como cola

Encima de A4:

- Filtro Picking: Mías / Libres / Todas
- Admin: “asignar las publicadas sin responsable”
- Si alguien marca lista, queda registrado quién

### B3. Cierre de día

**Ruta.** `/admin/dia?fecha=YYYY-MM-DD`

**Consulta (solo lecturas).** Para una fecha (timezone `America/Argentina/Buenos_Aires`):

- publicadas
- listas
- cerradas
- urgentes abiertas
- con observación
- tiempo medio publicada → primera foto
- tiempo medio lista → cerrada

**UI.** Negro / amarillo, números grandes, lista de las que no salieron.

Sin tabla nueva. Se deriva de `published_at`, `ready_at`, `closed_at`, `evidences.created_at`.

### B4. Excel del período

**Ruta.** `/admin/dia/export?desde=&hasta=`

Columnas: número, modalidad, destino, estado, prioridad, responsable, progreso, publicada, lista, cerrada, vencimiento, observación.

Librería: `exceljs` (server-side). Misma autorización que el PDF (solo Admin).

### B5. Alertas en el tablero (sin push)

En `/admin` y `/admin/dia`, bloques:

- Urgente sin foto hace más de 30 min
- Lista hace más de 2 h sin cerrar
- Observación abierta
- Vencida y no cerrada

Todo calculado al renderizar. Cero notificaciones al celu.

### B6. Cambio de contraseña propio

**UI.** En el menú del usuario: “Cambiar mi contraseña”.  
`supabase.auth.updateUser({ password })` con sesión actual.  
Admin sigue pudiendo resetear la de otro (ya está).

**Listo tanda B cuando:** una entrega tiene hora de salida, Picking ve “mías”, Admin baja el Excel del día y ve las trabadas sin preguntar por WhatsApp.

---

## Tanda C — Sistema de empresa

Objetivo: que resista una auditoría y que la jefatura la mire sin sentarse en la app.

### C1. Informe PDF de auditoría

Rehacer `src/lib/pdf/report.ts` y `/admin/deliveries/:id/report`:

1. Portada: logo oficial, número, modalidad, estado, destino, bultos, responsable, fechas
2. Checklist con OK / FALTA / NO APLICA
3. Una foto por página (o media), pie: requisito, quién, cuándo, comentario
4. Historial en castellano (hoy imprime el enum crudo: `CREATED`)
5. Motivo de devoluciones y reaperturas
6. Nombre de archivo: `entrega-{numero}-informe.pdf`

Tests: entrega sin fotos, con 2 fotos, con 15 fotos.

### C2. Calidad de la foto

**Datos.**

```sql
alter table public.requirement_types
  add column guidance text;

alter table public.evidences
  add column review_status text
    check (review_status in ('PENDING', 'ACCEPTED', 'REJECTED'))
    default 'PENDING';
alter table public.evidences
  add column review_note text;
```

**Negocio.**

- Cada tipo tiene una ayuda: “Se tiene que ver el número del remito”
- En revisión: Aceptar / Rechazar foto (no es void: la foto queda, no cuenta como OK)
- `hasActiveEvidence` pasa a exigir foto activa **y no rechazada**
- Rechazar obliga comentario y puede devolver la entrega (reusa A1)

**UI.** Texto de ayuda en `/picking/:id/:req`. En revisión, botones por foto.

Anotación (dibujar recuadro) se deja para un incremento después de C1–C2, mismo PR no.

### C3. Plantillas por destino

**Datos.**

```sql
create table public.destination_presets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  destination text not null,
  modality public.delivery_modality not null,
  packages integer,
  default_assignee_id uuid references public.profiles (id),
  requirement_overrides jsonb not null default '[]'::jsonb,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);
```

> Decisión posterior: esta propuesta fue descartada. La aplicación no expone un catálogo de destinos frecuentes.

### C4. Alta rápida y lote

> Decisión posterior: esta propuesta fue descartada para mantener un único flujo de alta.

- **Rápida:** número + modalidad + destino + publicar. Requisitos = plantilla. Un pantalla, dos campos menos.
- **Lote:** textarea con un número por línea, misma modalidad/destino. Crea N publicadas. Si un número existe, se salta y se lista.

Reusa `saveDeliveryAction`. Sin API nueva.

### C5. Cierre en lote

En la bandeja de revisión: checkboxes + “Cerrar las seleccionadas”.  
Solo `READY` sin observación abierta (o con confirmación si hay obs).  
Una auditoría `CLOSED` por entrega.

### C6. Televisor de bodega

**Ruta.** `/tablero` (o `/admin/tablero`).  
Pantalla completa, negro, números enormes, se refresca cada 30 s (`router.refresh` o poll).

Muestra: en picking, urgentes, vencidas, listas para revisar.  
Sin fotos (privacidad en el piso).  
Auth: cualquier usuario logueado, o un usuario `TABLERO` de solo lectura (si no queremos Supervisor todavía, alcanza PICKING/ADMIN).

### C7. Rol Supervisor

**Datos.** Ampliar enum:

```sql
alter type public.user_role add value if not exists 'SUPERVISOR';
```

**Permisos.** Ve Admin (tablero, día, PDF, bandeja). No crea, no cierra, no borra, no administra usuarios. No carga fotos salvo que se decida lo contrario (recomendación: no carga).

**Código.** `requireRole`, `permissions.ts`, RLS `current_role()`, UI de usuarios con el tercer acceso.

**Listo tanda C cuando:** el PDF se puede mandar a un reclamo, un destino frecuente se crea en dos toques, el televisor muestra el turno, y un Supervisor entra sin poder romper.

---

## 2. Personas y responsabilidad (repartido)

| Item | Tanda | Notas |
|---|---|---|
| Tomar / reasignar | A4 | |
| Cambiar mi contraseña | B6 | |
| Supervisor | C7 | |
| Desactivar usuario sin borrar historial | Hecho (eliminar / ban) | No reabrir |
| Turnos “quién está en piso ahora” | B2 opcional | Si no hay gente de sobra, no se prioriza. Se anota presencia con “La tomo yo”. |

No se agrega un módulo de RR.HH. El turno se infiere de quién tiene entregas abiertas.

---

## 3. Orden técnico (dependencias)

```
A1 Devolver ──┐
A2 Bandeja ───┼─► A5 Comparar fotos
A3 Siguiente ─┘
A4 Tomar ─────────► B2 Cola
                      │
B1 due_at ────────────┼─► B3 Día ─► B4 Excel
                      └─► B5 Alertas
                             │
C1 PDF ─► C2 Rechazar foto (usa A1 + A2)
C3 Destinos ─► C4 Alta rápida / lote
A2 ─► C5 Cierre lote
B3 ─► C6 Televisor
C7 Supervisor (después de A2 y B3, para que tenga qué mirar)
```

No se puede hacer C2 sin A1 (devolver).  
No se puede hacer C5 sin A2 (bandeja).  
C6 no depende de Supervisor.

---

## 4. Archivos que más se tocan

| Área | Archivos |
|---|---|
| Estados / permisos | `src/lib/deliveries/state.ts`, `permissions.ts`, tests |
| Acciones | `src/lib/actions/deliveries.ts`, nuevo `review.ts` |
| Queries | `src/lib/deliveries/queries.ts` |
| Fotos | `src/app/api/evidence/route.ts`, `evidence-capture.tsx`, `persist.ts` |
| Admin | `src/app/admin/page.tsx`, nuevas rutas `revision`, `dia`, `tablero`, `destinos` |
| Picking | `src/app/picking/page.tsx`, `picking/[id]/*` |
| PDF | `src/lib/pdf/report.ts` |
| Auth | `src/lib/actions/users.ts`, `src/lib/actions/auth.ts` |
| Schema | `supabase/migrations/20260815*.sql` y aplicar en cloud |

RLS: Supervisor y columnas nuevas. Las escrituras sensibles siguen yendo por server action + `createAdminClient` cuando haga falta (mismo patrón que borrar entrega).

---

## 5. Criterio de hecho (oficial)

Una pieza está hecha cuando:

1. Admin o Picking la usan en el flujo real, no en un mock
2. Queda auditada si cambia estado o evidencia
3. iPhone Safari y PC se ven y funcionan
4. `tsc`, lint y tests de estado/permisos pasan
5. Migración aplicada en Supabase cloud si tocó schema
6. Textos en castellano de instrucción, sin tono de demo

---

## 6. Riesgos

| Riesgo | Mitigación |
|---|---|
| Enum de Postgres: `ADD VALUE` no va en transacción vieja | Migraciones chicas, una por tanda |
| Rechazar foto vs void | Void = “esta no existe”. Reject = “existe y no sirve”. No mezclar |
| Lote de altas crea números a medias | Transacción por número; fallidos se listan, no se aborta todo |
| Televisor expone destinos en el piso | Sin fotos, sin observaciones largas |
| Supervisor mal recortado | Empezar read-only total; después se abre PDF y día |
| iPhone otra vez no toma la foto | No tocar el POST nativo `/api/evidence` salvo el redirect al próximo requisito |

---

## 7. Qué no entra (recordatorio)

OCR, lectura automática de remitos, SAP, Andreani API, cola offline, push, chat, mapas.

Si IT autoriza una API después, se abre otra tanda. No se mezcla con A–C.

---

## 8. Propuesta de arranque

**Primera semana de implementación: A1 + A2 + A3.**  
Con eso el circuito oficial gana el agujero que hoy tiene: no se puede devolver, y Picking pierde tiempo entre fotos.

Después A4 y A5. Recién ahí B.
