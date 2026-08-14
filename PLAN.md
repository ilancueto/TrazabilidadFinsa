# PLAN.md — Trazabilidad de Entregas

> Estado: **MVP local operativo**. Supabase corre en Docker (puertos `55xxx`).
> Principio: **Entrega → Requisitos → Evidencias → Auditoría → Cierre**.

## 0. Objetivo

Construir una web/PWA interna para que Admin cree entregas desde PC y
Picking documente cada paso desde celular con fotografías y
trazabilidad.

**MVP exitoso:** Admin crea/publica → aparece en Picking → Picking
completa evidencias → sistema bloquea READY si falta algo → Admin
revisa, descarga informe y cierra.

## 1. Arquitectura / decisiones IT

-   [x] Confirmar Next.js + TypeScript + App Router.
-   [x] Confirmar Supabase PostgreSQL (local hasta cuenta cloud).
-   [x] Confirmar autenticación interna (Supabase Auth local).
-   [ ] Confirmar hosting autorizado.
-   [ ] Confirmar storage autorizado (hoy: adapter Supabase local).
-   [ ] Confirmar política de retención.
-   [ ] Confirmar asset oficial Finning/CAT.
-   [x] Documentar ADRs (`docs/DECISIONS.md`).

### Abstracción de storage

-   [x] `EvidenceStorage.upload()`
-   [x] `EvidenceStorage.getAuthorizedUrl()`
-   [x] `EvidenceStorage.void()`
-   [x] Soportar corporativo / Drive autorizado / Supabase /
    S3-compatible. (contrato listo; implementación activa: Supabase)

## 2. Bootstrap

-   [x] Proyecto ordenado.
-   [x] TypeScript strict.
-   [x] ESLint/formatter.
-   [x] `.env.example`.
-   [x] README.
-   [x] Scripts dev/build/lint/typecheck/test.
-   [x] PWA manifest/iconos.
-   [x] Error/loading/not-found base.

## 3. Base de datos

-   [x] `profiles`
-   [x] `deliveries`
-   [x] `requirement_types`
-   [x] `delivery_requirements`
-   [x] `evidences`
-   [x] `audit_events`
-   [x] `delivery_templates`
-   [x] `template_requirements`
-   [x] Número de entrega UNIQUE.
-   [x] Bultos \> 0.
-   [x] FK/constraints.
-   [x] Índices por número, estado, modalidad, prioridad, picker y
    fechas.
-   [x] Migraciones reproducibles.
-   [x] Seeds.

## 4. Auth / permisos

-   [x] Login/logout/sesión.
-   [x] Roles ADMIN/PICKING.
-   [x] Guards server-side.
-   [x] RLS.
-   [x] Tests RLS (`npm run smoke`).
-   [x] Picking no edita requisitos.
-   [x] Picking no cierra.
-   [x] Evidencias requieren autorización.

## 5. Estados

Base: `DRAFT → PUBLISHED → IN_PICKING → READY → CLOSED`

-   [x] Resolver observación como estado vs flag (flag).
-   [x] Validar transiciones server-side.
-   [x] READY exige requisitos.
-   [x] CLOSED sólo Admin.
-   [x] Reapertura auditada.
-   [x] Tests.

## 6. Plantillas

### Andreani

-   [x] Remito
-   [x] Etiquetas
-   [x] Triplicado
-   [x] Packing List configurable
-   [x] Bultos/Pallet
-   [x] Evidencia final

### Retira cliente

-   [x] Remito
-   [x] Triplicado
-   [x] Packing List configurable
-   [x] Bultos
-   [x] Evidencia final/retiro
-   [x] Admin ajusta antes de publicar.
-   [x] Picking no cambia aplica/no aplica.
-   [x] Extensible a nuevas modalidades/requisitos.

## 7. Admin dashboard

-   [x] KPIs activas / Picking / listas / observaciones.
-   [x] Tabla.
-   [x] Buscar número y últimos dígitos.
-   [x] Filtros modalidad/estado/prioridad/responsable/fecha.
-   [x] Progreso X/Y.
-   [x] Última actualización.
-   [x] Pendientes críticos.
-   [x] Responsive.

## 8. Crear entrega

-   [x] Número.
-   [x] Modalidad.
-   [x] Destino/cliente.
-   [x] Bultos.
-   [x] Prioridad.
-   [x] Responsable.
-   [x] Observaciones.
-   [x] Requisitos.
-   [x] Plantilla automática.
-   [x] Guardar borrador.
-   [x] Publicar.
-   [x] Validación.
-   [x] Auditoría.

## 9. Editar entrega

-   [x] Editar desde listado/detalle.
-   [x] Reglas según estado.
-   [x] Warning si Picking ya inició.
-   [x] Before/after auditado.
-   [x] CLOSED bloqueada.
-   [x] Reapertura separada.

## 10. Picking PWA

-   [x] Home móvil.
-   [x] Pendientes.
-   [x] Buscar.
-   [x] Urgentes primero.
-   [x] Progreso/alertas.
-   [x] Detalle.
-   [x] Botones grandes.
-   [x] Sin acciones Admin.
-   [x] PWA instalable.

## 11. Evidencia fotográfica

-   [x] Cámara/selector.
-   [x] Preview.
-   [x] Orientación.
-   [x] Resize 1600--2000 px.
-   [x] JPEG/WebP.
-   [x] Validar MIME/tamaño.
-   [x] Upload progress.
-   [x] Retry/cancel.
-   [x] Anti doble-submit.
-   [x] Confirmación backend.
-   [x] Varias fotos/requisito.
-   [x] Uploader + timestamp server-side.
-   [x] Comentario.
-   [x] Auditoría.
-   [x] UX de fallo/red/sesión.

## 12. Storage

-   [x] Adapter.
-   [x] Sin URLs públicas permanentes.
-   [x] Metadata DB.
-   [x] Acceso signed/autorizado.
-   [x] Estructura año/mes/entrega/requisito.
-   [x] Void en vez de delete silencioso.
-   [x] Test permisos.
-   [ ] IT confirma Drive/storage.
-   [ ] IT confirma retención/backups.

## 13. Detalle

-   [x] Número/modalidad/estado/prioridad.
-   [x] Destino/responsable/bultos.
-   [x] Creación/actualización.
-   [x] Observaciones.
-   [x] Progreso.
-   [x] Checklist.
-   [x] Evidencias/miniaturas/metadata.
-   [x] Timeline.
-   [x] Alertas.
-   [x] Acciones por rol.

## 14. Auditoría

-   [x] CREATED
-   [x] PUBLISHED
-   [x] EDITED
-   [x] ASSIGNED
-   [x] PICKING_STARTED
-   [x] EVIDENCE_UPLOADED
-   [x] EVIDENCE_VOIDED
-   [x] OBSERVATION_ADDED
-   [x] READY
-   [x] CLOSED
-   [x] REOPENED
-   [x] Append-only lógico.
-   [x] Actor/timestamp/metadata/before-after.

## 15. Informe PDF

-   [x] Server-side.
-   [x] Datos de entrega.
-   [x] Checklist.
-   [x] Fotos + pie + uploader/timestamp.
-   [x] Historial.
-   [x] Branding autorizado (placeholder hasta asset IT).
-   [x] Nombre consistente.
-   [ ] Tests con pocas/muchas fotos.

## 16. Seeds

-   [x] 806042356 — Andreani — Urgente — Ilan Cueto — En
    Picking.
-   [x] 806042401 — Retira cliente — Emilio Chejolan — Lista.
-   [x] 806042487 — Andreani — Alta — Ilan Cueto — observación
    etiqueta.
-   [x] 806042512 — Andreani — Emilio Chejolan — Cerrada.
-   [x] Evidencias/timeline dummy.
-   [x] Sin clientes reales.

## 17. Testing

### Unit

-   [x] Validaciones.
-   [x] Estados.
-   [x] Compresión/helpers (path).
-   [x] Permisos.

### Integration

-   [x] Auth/RLS smoke (`npm run smoke`).
-   [x] Upload persist + HTTP (`npm test` / `npm run test:upload`).
-   [ ] READY/CLOSE E2E en UI.
-   [ ] Informe E2E.

### E2E

-   [ ] Admin crea 806042590.
-   [ ] Publica.
-   [ ] Picking la ve en otro flujo.
-   [x] Carga evidencias (API + persistencia real verificada).
-   [ ] Bloqueo si falta requisito.
-   [ ] READY.
-   [ ] Admin revisa/informe/CLOSED.
-   [ ] Refresh persiste.
-   [ ] Otro dispositivo ve datos.

### Security

-   [x] Picking intenta endpoint Admin (redirect + RLS).
-   [x] Manipulación de role cliente (rol en `profiles`).
-   [x] Editar requisitos sin permiso.
-   [x] Acceso no autorizado a evidencia.
-   [x] MIME inválido.

## 18. Performance / UX

-   [ ] Lazy thumbnails (hoy el proxy sirve el archivo completo).
-   [x] No full-size en listados.
-   [x] Queries/índices.
-   [x] Evitar N+1 (batch de requisitos).
-   [x] Skeleton/loading/empty/error states.
-   [x] Feedback de guardado.
-   [x] Mobile usable con una mano.

## 19. Observabilidad

-   [x] Error logging.
-   [x] No loggear documentos/secretos.
-   [ ] Métricas de fallos de upload.
-   [x] Health check.
-   [x] Runbook básico.

## 20. Deploy

### Staging

-   [ ] Proyecto/variables/datos demo separados.
-   [ ] URL interna.

### Producción

-   [ ] Aprobación IT.
-   [ ] Storage prod.
-   [ ] RLS revisada.
-   [ ] Backups.
-   [ ] Política acceso.
-   [ ] Smoke test.

## 21. Documentación

-   [x] README/setup/env/migraciones/seeds.
-   [x] Roles/arquitectura/storage/deploy.
-   [x] Runbook.
-   [x] Decisiones IT.
-   [x] Riesgos conocidos.

## 22. Fase 2

-   [ ] SLA/hora límite.
-   [ ] Orden por vencimiento.
-   [ ] Supervisor.
-   [ ] Métricas/reportes.
-   [ ] Bultos individualizados.
-   [ ] Cola offline.
-   [ ] Notificaciones.

## 23. Fase 3

-   [ ] OCR.
-   [ ] Lectura remitos/etiquetas.
-   [ ] Comparación automática.
-   [ ] Alertas de inconsistencia.
-   [ ] ERP/SAP sólo con API aprobada.
-   [ ] Andreani API si aporta valor.
-   [ ] QR opcional.
-   [ ] Analítica avanzada.

## 24. Definition of Done

Una tarea sólo pasa a `[x]` cuando está implementada, autorizada
server-side si aplica, funciona en el dispositivo objetivo,
typecheck/lint/tests pasan, no rompe flujos y queda documentada.

**MVP DONE (local):** el circuito está implementado con persistencia en
Postgres local, RLS real y seeds. Falta el circuito E2E en dos
dispositivos y la cuenta Supabase cloud. `localStorage` no es fuente de
verdad.
