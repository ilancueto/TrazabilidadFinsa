# MEGA PROMPT --- Sistema interno de Trazabilidad de Entregas \| Finning CAT

## Rol

Actuá como **Staff Full-Stack Engineer + Product Engineer + UX
Engineer + Security-minded Architect**. Convertí la demo conceptual
aprobada para uso interno en una aplicación web/PWA real, robusta y
mantenible para Bodega y Despacho.

No construyas una landing ni un mock. Construí un **producto operativo
real**.

## Problema y principio del producto

Existen confusiones operativas con remitos, etiquetas, triplicados,
packing lists, bultos y evidencia de cómo fue preparada/entregada una
orden.

La unidad principal es la **entrega**, por ejemplo `806042356`.

Principio: **Entrega → Requisitos → Evidencias → Auditoría → Cierre**.

Cada entrega conserva modalidad, requisitos aplicables/no aplicables,
creador, responsable Picking, fotografías clasificadas, bultos,
observaciones, estado, timestamps, historial e informe final.

## Modalidades

### Despacho --- Andreani

Requisitos posibles: Remito, Etiquetas, Triplicado, Packing List,
Bultos/Pallet, Evidencia final y futuros requisitos configurables.

### Retira cliente

Requisitos posibles: Remito, Triplicado, Packing List cuando aplique,
Bultos, Evidencia final/retiro y futuros requisitos configurables.

No hardcodear el modelo de modo que impida agregar modalidades o
requisitos.

## Roles

### ADMIN --- principalmente PC

Puede crear/editar entregas, seleccionar modalidad, definir aplica/no
aplica, bultos, prioridad, destino, observaciones, asignar Picking,
publicar, buscar/filtrar, revisar evidencias, consultar auditoría,
cerrar/reabrir mediante flujo auditado y descargar informe.

### PICKING --- principalmente PWA móvil

Puede ver entregas publicadas, buscar, abrir detalle, cargar evidencias,
agregar observaciones y marcar lista cuando todos los requisitos
obligatorios estén completos.

Picking NO puede cambiar requisitos a No aplica, modificar modalidad,
borrar evidencias cerradas, cerrar administrativamente ni alterar
auditoría.

Usuarios seed de referencia: **Ilan Cueto** y **Emilio Chejolan**. No
modelarlos como únicos usuarios.

## Estados

Diseñá una máquina explícita como base:
`DRAFT → PUBLISHED → IN_PICKING → READY → CLOSED`.

Evaluá si `WITH_OBSERVATION` debe ser estado o flag/issue independiente
y documentá la decisión.

Las transiciones se validan en backend. READY exige todos los requisitos
obligatorios; CLOSED sólo Admin; reapertura genera auditoría.

## Modelo de requisitos/evidencias

No guardar una galería genérica.

`Delivery → DeliveryRequirement → Evidence[]`

Requirement: id, delivery_id, type, label, required, applicable, status,
display_order, timestamps.

Evidence: id, requirement_id, provider, storage key/file id, filename,
MIME, size, dimensiones, uploader, timestamp, comentario, checksum si
aporta valor y metadata de void/reemplazo. Un requisito admite varias
fotos.

## Fotografías

Comprimir/redimensionar **antes de subir**: - lado largo aprox.
1600--2000 px; - JPEG/WebP con calidad suficiente para leer
documentos; - orientación correcta; - preview; - progreso; - retry; -
protección contra doble upload; - confirmación backend antes de marcar
guardada.

No fingir soporte offline. Dejar cola offline para fase posterior.

## Storage

Preferencia: Supabase/PostgreSQL para datos y storage desacoplado para
fotos.

Crear una abstracción para poder usar storage corporativo, Google Drive
autorizado, Supabase Storage o S3-compatible.

Nunca exponer secretos en frontend ni usar URLs públicas eternas.
Guardar IDs/keys y generar acceso autorizado.

Si se usa Google Drive: upload server-side, OAuth/token refresh seguro,
carpetas tipo `/Trazabilidad/2026/08/806042356/remito/`, metadata en DB.
No usar cuenta personal en producción sin aprobación IT.

## Stack recomendado

-   Next.js actual + App Router.
-   TypeScript strict.
-   React.
-   PWA.
-   Supabase PostgreSQL.
-   Supabase Auth si encaja.
-   RLS.
-   Zod.
-   Server Actions/Route Handlers según corresponda.
-   Tests unit/integration/E2E.
-   Vercel si está autorizado.

Justificá dependencias relevantes. Evitá sobreingeniería.

## UX / identidad

Estética Finning/CAT autorizada: negro/antracita, blanco/grises,
amarillo industrial `#FFCC00` como acento. Sobria, industrial y de alta
legibilidad. No inundar todo de amarillo. Asset oficial de marca debe
estar aprobado y local al proyecto, no hotlinkeado.

### Desktop Admin

KPIs: activas, en Picking, listas, observaciones. Tabla con filtros,
búsqueda, prioridad, responsable, modalidad, última actualización,
progreso y alertas críticas.

### Mobile Picking

Pocos taps, botones grandes, cámara, feedback inmediato. Flujo:
`Entrega → requisito → foto → confirmar → siguiente`.

## Alta/edición

Campos: número único, modalidad, destino/cliente, bultos \> 0, prioridad
Normal/Alta/Urgente, responsable Picking, observaciones y requisitos.

Plantillas Andreani/Retira cliente proponen requisitos; Admin puede
ajustarlos antes de publicar.

Toda edición relevante debe auditarse. CLOSED requiere flujo especial.

## Búsqueda

Número completo o últimos dígitos, destino, responsable, modalidad,
estado, prioridad, fecha y pendientes críticos. Destacar urgentes y
trabadas sin depender sólo del color.

## Auditoría

Audit log append-only lógico: CREATED, PUBLISHED, EDITED, ASSIGNED,
PICKING_STARTED, EVIDENCE_UPLOADED, EVIDENCE_VOIDED, OBSERVATION_ADDED,
READY, CLOSED, REOPENED.

Cada evento: actor, timestamp servidor, delivery, action, metadata y
before/after cuando corresponda. Usuario normal no edita auditoría.

## Informe

Admin descarga PDF real generado server-side. Debe contener branding
autorizado, entrega, modalidad, destino, estado, prioridad, responsable,
fechas, bultos, observaciones, checklist, fotos con pie,
uploader/timestamp e historial relevante. No usar `window.print()` como
solución final.

## Seguridad

Auth real; autorización server-side; RLS; validación; no confiar en
roles del cliente; secretos server-side; límites MIME/tamaño; nombres
saneados; no ejecutar uploads; acceso autorizado a fotos; retención
documentada. No inventar compliance: marcar decisiones pendientes de IT.

## DB mínima

Proponer migraciones para: - profiles - deliveries - requirement_types -
delivery_requirements - evidences - audit_events - delivery_templates -
template_requirements

Agregar índices, constraints, FK, timestamps y estrategia
void/soft-delete. Preparar evolución a transportista, sucursal, SLA,
bultos individualizados, firma/retiro, OCR, ERP/SAP y métricas. No
implementar SAP sin especificación real.

## Seeds

-   806042356 --- Andreani --- Urgente --- Ilan Cueto --- En Picking.
-   806042401 --- Retira cliente --- Emilio Chejolan --- Lista.
-   806042487 --- Andreani --- Alta --- Ilan Cueto --- observación de
    etiqueta.
-   806042512 --- Andreani --- Emilio Chejolan --- Cerrada.

Usar sólo clientes/evidencias ficticias.

## MVP obligatorio

1.  Login.
2.  Roles.
3.  Dashboard Admin.
4.  Alta.
5.  Edición auditada.
6.  Plantillas.
7.  Publicación.
8.  Bandeja Picking.
9.  Checklist.
10. Captura/carga.
11. Compresión.
12. Persistencia real.
13. Progreso.
14. Validación READY.
15. Historial.
16. Búsqueda/filtros.
17. Informe PDF.
18. Responsive/PWA.
19. Seeds.
20. Tests críticos.

## Fuera del MVP

OCR, IA, reconocimiento automático, SAP, push, analítica avanzada, QR,
tracking Andreani, firma compleja y offline completo. Preparar
arquitectura, no distraerse implementándolo.

## Forma de trabajo obligatoria

Antes de código: 1. inspeccioná repo completo; 2. leé `PLAN.md`; 3.
identificá stack/scripts/estado; 4. reutilizá sólo conceptos útiles de
la demo; 5. generá diagnóstico; 6. proponé arquitectura; 7. marcá qué
existe; 8. implementá en slices verticales.

Durante: - actualizar PLAN.md; - `[x]` sólo si está implementado y
verificado; - typecheck/lint/tests frecuentes; - no usar `any`,
`@ts-ignore` o catches vacíos para tapar errores; - no romper mobile; -
migraciones reproducibles; - `.env.example`, jamás secretos; -
documentar setup; - ante ambigüedad no bloqueante, decidir y documentar;
preguntar sólo por decisiones bloqueantes o de seguridad corporativa.

## Criterio de aceptación end-to-end

Admin inicia sesión → crea `806042590` → Andreani → requisitos → asigna
Picking → publica → aparece en otro dispositivo → Admin puede editar y
queda auditado.

Picking inicia sesión → ve la entrega → carga fotos → app comprime →
persiste → progreso cambia → READY bloqueado si falta requisito →
completa → READY.

Admin revisa fotos/auditoría → descarga PDF → CLOSED.

Refresh no pierde datos; otro dispositivo ve lo mismo; localStorage NO
es fuente de verdad.

Picking no puede elevar rol manipulando frontend, editar requisitos por
API ni acceder evidencia sin autorización.

## Entregables

Código, migraciones, seeds, README, `.env.example`, PLAN.md actualizado,
arquitectura, tests, deploy instructions, decisiones pendientes IT,
riesgos conocidos y staging.

Al terminar resumí: implementado, pendiente, tests ejecutados, problemas
conocidos, decisiones IT y próximos pasos.

## Regla final

No optimices para una captura linda. Optimizá para que **Admin cree una
entrega en PC y Picking la documente desde un celular de forma rápida,
segura, persistente y trazable**.
