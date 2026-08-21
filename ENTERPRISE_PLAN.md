# FINSA Trazabilidad — Enterprise Readiness Plan

## Objetivo

Convertir FINSA Trazabilidad en un producto corporativo robusto, medible, auditable y mantenible, listo para evaluación formal por IT y una eventual propuesta comercial interna.

Objetivo final: `v1.0.0` con calidad de **Enterprise Release Candidate**, seguridad validada, ambientes separados, pruebas automatizadas, observabilidad, recuperación ante incidentes, métricas operativas y documentación suficiente para que un equipo distinto del autor pueda operar y mantener el sistema.

## Convenciones del dominio

- Modalidad técnica `DESPACHO` → UI **Despacho**.
- Modalidad técnica `CUSTOMER_PICKUP` → UI **Retira cliente**.
- `ANDREANI` es transportista (`carrier`), no modalidad.
- Backend/RPC = autoridad final de mutaciones críticas.
- Helpers TypeScript = representación para UX/prevalidación.
- UI = consume reglas; no las inventa.

## Principios de ejecución

- No agregar features grandes mientras existan riesgos críticos de arquitectura, seguridad o integridad.
- Toda regla crítica debe validarse del lado servidor.
- Todo cambio de base debe existir como migración versionada.
- Ningún cambio relevante debe probarse por primera vez en producción.
- Usar PRs pequeños, revisables y reversibles.
- Preservar datos históricos.
- Acciones excepcionales: explícitas, justificadas y auditables.
- No inventar métricas, permisos ni requisitos corporativos.
- Evitar overengineering y dependencias innecesarias.

---

# Estado ejecutivo

- [x] Sprint 1 — Baseline, inventario y auditoría.
- [x] Sprint 2.1 — Normalización modalidad/transportista.
- [x] Sprint 2.2 — Fuente única de reglas de negocio.
- [x] Sprint 2.3 — Matriz RBAC formal.
- [x] Sprint 2.4 — Hardening Supabase.
- [x] Sprint 2.5 — Supply-chain security.
- [ ] Sprint 3 — Testing, CI y ambientes.
- [ ] Sprint 4 — Observabilidad, auditoría y recuperación.
- [ ] Sprint 5 — Métricas, UX y performance.
- [ ] Sprint 6 — Documentación IT, release y paquete comercial.

**Sprint 2 — Dominio definitivo y seguridad: COMPLETO ✅**

**Sprint 3.1 — Unit tests: COMPLETO ✅**

**Próxima unidad:** Sprint 3.2 — Integration tests.

---

# Sprint 1 — Baseline, inventario y auditoría ✅

## 1.1 Línea base estable

- [x] Identificar commit productivo estable.
- [x] Crear tag `v0.9-baseline`.
- [x] Registrar versiones críticas del stack.
- [x] Guardar snapshot del esquema `public`.
- [x] Documentar Storage y policies.
- [x] Documentar variables de entorno sin secretos.
- [x] Generar backup de DB y evidencias.
- [x] Cifrar/verificar backup y documentar recuperación/retención.
- [x] Reconciliar migraciones locales/remotas.
- [x] Verificar que la base pueda reconstruirse desde migraciones.

Documentación principal:

- `docs/BACKUP.md`
- `docs/STORAGE.md`
- `docs/ENVIRONMENT_VARIABLES.md`
- `docs/MIGRATION_RECONCILIATION.md`
- `supabase/schema-baselines/v0.9-baseline-public.sql`

## 1.2 Auditoría completa

- [x] Rutas `src/app`.
- [x] Server Actions y API routes.
- [x] Permisos y transiciones.
- [x] Cálculo de progreso.
- [x] Evidencias: carga/anulación/revisión.
- [x] PDF/ZIP/Excel.
- [x] PWA/móvil.
- [x] Componentes compartidos.
- [x] Consultas Supabase.
- [x] RPCs.
- [x] RLS.
- [x] Migraciones.
- [x] Índices/constraints.
- [x] Dependencias externas.
- [x] Código muerto/TODO/FIXME/casts inseguros.
- [x] Lógica duplicada frontend/backend.
- [x] Secretos accidentales en Git.

Entregables:

- [x] `docs/ARCHITECTURE_CURRENT.md`
- [x] `docs/AUDIT_REPORT.md`
- [x] `docs/RISK_REGISTER.md`
- [x] diagrama de arquitectura actual
- [x] inventario de RPCs/tablas/policies/buckets

**Salida cumplida:** baseline recuperable y comportamiento crítico entendido/documentado.

---

# Sprint 2 — Dominio definitivo y seguridad

## 2.1 Modalidad y transportista ✅

Modelo efectivo:

```text
Modalidad
- DESPACHO
- CUSTOMER_PICKUP   # UI: Retira cliente

Transportista
- ANDREANI
```

- [x] Diseñar migración `ANDREANI` modalidad → `DESPACHO` + carrier.
- [x] Agregar `deliveries.carrier`.
- [x] Migrar históricos conservando IDs/evidencias/auditoría/fechas/estados.
- [x] Actualizar TypeScript.
- [x] Actualizar Zod.
- [x] Actualizar filtros.
- [x] Actualizar templates.
- [x] Actualizar RPCs.
- [x] Actualizar reportes.
- [x] Actualizar tests.
- [x] Eliminar uso de `ANDREANI` como modalidad de aplicación.

Referencias:

- `docs/DOMAIN_MODEL.md`
- `docs/MODALITY_MIGRATION_PLAN.md`
- migración `20260821153000...`

## 2.2 Fuente única de reglas de negocio ✅

- [x] Inventariar transiciones.
- [x] Inventariar cierre normal/excepcional.
- [x] Inventariar FLOOR/DISPATCH.
- [x] Inventariar reglas por rol.
- [x] Eliminar contradicciones frontend/backend conocidas.
- [x] Definir DRAFT/PUBLISHED/IN_PICKING/READY/CLOSED.
- [x] Hacer que UI consuma helpers coherentes con backend.
- [x] Añadir tests unitarios/integración de reglas críticas.

Fuente: `docs/BUSINESS_RULES.md`.

Autoridad final: RPCs. Helpers: `src/lib/deliveries/permissions.ts`, `state.ts`, `progress.ts`.

## 2.3 Matriz RBAC formal ✅

- [x] Crear `docs/RBAC_MATRIX.md`.
- [x] Definir permisos efectivos de PICKING.
- [x] Definir permisos efectivos de SUPERVISOR.
- [x] Definir permisos efectivos de ADMIN.
- [x] Documentar restricciones por estado.
- [x] Documentar autoridad técnica por acción.
- [x] Resolver diferencias entre tabla preliminar y comportamiento real.
- [x] Confirmar que 2.3 no necesita ampliar permisos ni cambiar código.

Decisiones formales:

| Acción | PICKING | SUPERVISOR | ADMIN |
| --- | ---: | ---: | ---: |
| Ver no-borrador | Sí | Sí | Sí |
| Ver DRAFT | No | Sí | Sí |
| Crear/editar/publicar | No | No | Sí |
| Claim/release propio | Sí, según estado | No | No |
| Asignación masiva de responsables | No | Sí | Sí |
| Cargar FLOOR/DISPATCH | Sí, según estado | No | Sí |
| Revisar evidencia | No | No | Sí |
| Marcar READY | Sí, según regla | No | Sí |
| Cierre normal | No | No | Sí |
| Reabrir | No | No | Sí |
| Cierre excepcional | No | No | Sí |
| Reportes/tablero/día | No | Sí | Sí |
| Usuarios/catálogo | No | No | Sí |

**Nota:** el borrador anterior del plan sugería revisión de evidencia para SUPERVISOR. La matriz formal confirma que el comportamiento implementado vigente es **ADMIN únicamente**.

### Evidencia de cierre 2.3

- Documento: `docs/RBAC_MATRIX.md`.
- PR: #38.
- Merge: `94641d5ab3ecf2da385a8f485c3dacd70a36285b`.
- Preview Vercel: `READY`.
- Producción del merge: `READY`.
- Sin cambios de código, DB o permisos en esta unidad.

## 2.4 Hardening Supabase ✅

Las tres mutaciones directas HIGH detectadas en Sprint 1 ya fueron remediadas (`deliveries` UPDATE, `evidences` UPDATE, `audit_events` INSERT). El hardening restante fue completado y documentado.

- [x] Revisar todas las policies RLS.
- [x] Confirmar RLS en cada tabla sensible.
- [x] Revisar todas las funciones `SECURITY DEFINER`.
- [x] Fijar/verificar `search_path` en RPCs privilegiadas.
- [x] Revisar grants a `anon`, `authenticated`, `service_role`.
- [x] Evitar autorización basada sólo en inputs del cliente.
- [x] Validar ownership/acceso de Storage.
- [x] Revisar signed URLs y expiración.
- [x] Validar MIME real y extensiones.
- [x] Validar límites de tamaño.
- [x] Prevenir paths arbitrarios.
- [x] Revisar eliminación/anulación de evidencias.
- [x] Confirmar que usuarios deshabilitados pierdan acceso efectivo.
- [x] Resolver o registrar explícitamente los hallazgos de seguridad pendientes del `RISK_REGISTER`.

Evidencia de cierre:

- `docs/SECURITY_MODEL.md`.
- `docs/RISK_REGISTER.md` actualizado.
- PRs #40 y #41.
- Merge final técnico: `b6c18ffcc8db93ccf290273b5062d47feb7e06a8`.
- Preview y producción Vercel: `READY`.
- Warnings operativos restantes (`pg_trgm` en `public` y leaked-password protection) registrados explícitamente; no bloquean el cierre técnico de 2.4.

## 2.5 Supply-chain security ✅

- [x] Dependabot o equivalente.
- [x] `npm audit`/scanner en CI.
- [x] Secret scanning.
- [x] Code scanning si está disponible.
- [x] Revisar dependencias sin mantenimiento.
- [x] Generar SBOM inicial.

Evidencia de cierre:

- `.github/dependabot.yml` para npm y GitHub Actions.
- `.github/workflows/ci.yml`: `npm audit --audit-level=high` bloqueante y SBOM CycloneDX como artifact.
- `.github/workflows/security.yml`: Gitleaks + CodeQL en PR/main y ejecución semanal.
- `docs/DEPENDENCY_SECURITY.md`.
- `docs/RISK_REGISTER.md` actualizado.
- PR #43.
- Merge técnico: `406db893cdd18d48b1c3ab579f6ead024b206861`.
- CI quality: `success`.
- Dependency security: `success`.
- Gitleaks: `success`.
- CodeQL: `success`.
- Vercel Preview: `success`.
- SBOM inicial generado correctamente como artifact `sbom-cyclonedx`.
- `npm audit`: cero HIGH/CRITICAL; dos MODERATE transitivas vía `exceljs → uuid@8.3.2`, registradas y aceptadas temporalmente sin forzar cambios breaking.

### Entregables Sprint 2

- [x] `docs/DOMAIN_MODEL.md`
- [x] `docs/RBAC_MATRIX.md`
- [x] `docs/SECURITY_MODEL.md`
- [x] `docs/DEPENDENCY_SECURITY.md`
- [x] migración de modalidad
- [x] suite base de reglas/permisos
- [x] supply-chain scanning + SBOM inicial

**Sprint 2 — Dominio definitivo y seguridad: COMPLETO ✅**

---

# Sprint 3 — Testing, CI y ambientes

## 3.1 Unit tests ✅

- [x] transiciones de estado
- [x] permisos
- [x] cálculo de progreso
- [x] FLOOR/DISPATCH
- [x] filtros por modalidad
- [x] búsquedas
- [x] cierres normales/excepcionales
- [x] reaperturas
- [x] alertas

Objetivo: cobertura alta del dominio crítico, no cobertura artificial de componentes triviales.

Evidencia de cierre:

- estrategia y comandos documentados en `docs/TESTING.md`.
- transiciones/cierres/reapertura: `src/lib/deliveries/state.test.ts`.
- permisos: `src/lib/deliveries/permissions.test.ts`.
- progreso: `src/lib/deliveries/progress.test.ts`.
- FLOOR/DISPATCH: `src/lib/deliveries/stages.test.ts`.
- modalidades: `src/lib/deliveries/queries.test.ts`.
- búsquedas: `src/lib/deliveries/search.test.ts`.
- cierre excepcional: `src/lib/actions/bulk-close.test.ts` sobre helper usado por producción.
- alertas: `src/lib/deliveries/alerts.test.ts`.
- CI `npm run verify`: `success` tras corregir el mock hoisted del test de modalidad.
- La autoridad final de RPC/RLS/cierres se valida en Sprint 3.2; 3.1 cubre lógica unitaria y prevalidación.

## 3.2 Integration tests

- [ ] creación/edición RPC
- [ ] PUBLISHED → IN_PICKING
- [ ] IN_PICKING/PUBLISHED → READY
- [ ] FLOOR
- [ ] DISPATCH en READY
- [ ] revisión
- [ ] cierre normal
- [ ] reapertura
- [ ] cierre excepcional
- [ ] archive/soft delete
- [ ] RLS por rol
- [ ] Storage access
- [ ] rechazo de operaciones no autorizadas

## 3.3 E2E críticos

### DESPACHO

- [ ] Admin crea/publica.
- [ ] Picking lo ve sólo en Despachos.
- [ ] Picking toma.
- [ ] Carga FLOOR.
- [ ] Marca READY.
- [ ] Carga DISPATCH.
- [ ] Admin revisa.
- [ ] Admin cierra.
- [ ] Auditoría correcta.

### RETIRA CLIENTE (`CUSTOMER_PICKUP`)

- [ ] Admin crea/publica.
- [ ] Aparece sólo en Retira cliente.
- [ ] Picking toma/carga evidencias.
- [ ] Marca READY.
- [ ] Revisión/cierre según regla.
- [ ] Auditoría correcta.

### Regresiones

- [ ] doble submit
- [ ] dos pickers intentando claim simultáneo
- [ ] evidencia rechazada/anulada
- [ ] observación abierta
- [ ] reapertura
- [ ] cierre excepcional
- [ ] refresh/error de red durante upload
- [ ] usuario desactivado
- [ ] RPC restringida llamada directamente
- [ ] entrega archivada
- [ ] evidencia prohibida por etapa

## 3.4 CI obligatorio

Cada PR deberá ejecutar, según corresponda:

```text
typecheck
lint
unit
integration
build
e2e-critical
security-scan
```

- [ ] bloquear merge ante fallos críticos
- [ ] conservar artifacts útiles
- [ ] documentar comandos locales equivalentes

## 3.5 DEV / STAGING / PROD

DEV:
- local
- datos sintéticos
- reset permitido

STAGING:
- Supabase independiente
- Vercel preview/staging
- sin datos reales sensibles
- migraciones antes que PROD

PROD:
- acceso restringido
- release aprobada
- backups/monitoreo

Pendiente:

- [ ] Supabase staging
- [ ] env por ambiente
- [ ] Storage separado
- [ ] seed sintético
- [ ] migraciones completas probadas en staging
- [ ] promoción documentada
- [ ] rollback documentado

Entregables:

- [x] `docs/TESTING.md`
- [ ] `docs/ENVIRONMENTS.md`
- [ ] pipeline CI estable
- [ ] staging funcional

---

# Sprint 4 — Observabilidad, auditoría y recuperación

## 4.1 Logging estructurado

Definir timestamp, environment, operation/request ID, route/action, user/delivery ID cuando corresponda, duración, resultado y error code.

Nunca loguear passwords, access tokens, service-role keys ni datos sensibles innecesarios.

## 4.2 Error tracking

- [ ] herramienta aprobable por IT
- [ ] errores server/client relevantes
- [ ] agrupación y stack traces
- [ ] separación staging/prod
- [ ] política de datos enviados

## 4.3 Health

- [ ] proceso web
- [ ] conectividad Supabase
- [ ] consulta DB
- [ ] dependencias críticas

## 4.4 Métricas técnicas

- [ ] uploads OK/fallidos
- [ ] latencia API y p50/p95
- [ ] errores RPC/API/HTTP
- [ ] reintentos
- [ ] cierres excepcionales
- [ ] reaperturas

## 4.5 Auditoría visible

Timeline por entrega: creación, publicación, asignación, claim, evidencias, observaciones, READY, cierre, reapertura, archivo y excepciones.

Panel sensible:

- [ ] cierres excepcionales
- [ ] reaperturas
- [ ] archivos
- [ ] cambios de responsable
- [ ] evidencia anulada/rechazada
- [ ] cambios administrativos

Filtros: fecha, usuario, entrega, acción, motivo.

## 4.6 Backup / restore

- [ ] estrategia DB
- [ ] estrategia Storage
- [ ] frecuencia/retención/responsable
- [ ] restore documentado
- [ ] restore real en staging
- [ ] validar tablas/evidencias/configuración
- [ ] medir duración
- [ ] definir RPO/RTO

Entregables:

- [ ] `docs/MONITORING.md`
- [ ] `docs/BACKUP_RESTORE.md`
- [ ] `docs/INCIDENT_RUNBOOK.md`
- [ ] auditoría visible
- [ ] restore probado

---

# Sprint 5 — Métricas, UX y performance

## 5.1 Métricas operativas

Definir antes de implementar:

Volumen:
- [ ] despachos/retiros por período
- [ ] cerradas/backlog/urgentes

Tiempos:
- [ ] publicación → primera evidencia
- [ ] publicación → FLOOR completo
- [ ] FLOOR → READY
- [ ] READY → DISPATCH
- [ ] READY → CLOSED
- [ ] lead time total
- [ ] promedio/P50/P90/tendencia

Calidad:
- [ ] observaciones
- [ ] evidencia rechazada
- [ ] reaperturas
- [ ] cierres excepcionales
- [ ] faltantes
- [ ] finalización sin incidentes

Productividad:
- [ ] volumen por picker
- [ ] tiempos sólo cuando sean operacionalmente válidos
- [ ] carga actual
- [ ] trabajo libre

No convertir métricas en ranking individual sin validación de negocio/HR.

## 5.2 Dashboard

- [ ] Hoy
- [ ] 7 días
- [ ] Mes
- [ ] período anterior
- [ ] Despachos
- [ ] Retira cliente
- [ ] Calidad
- [ ] Excepciones

## 5.3 KPI corporativos

- [ ] obtener definiciones oficiales OTIF/OTIL/IRA aplicables
- [ ] documentar fórmula
- [ ] identificar datos faltantes
- [ ] implementar sólo con trazabilidad suficiente

## 5.4 UX operativa

Probar:

- [ ] iPhone Safari/PWA
- [ ] Android Chrome/PWA
- [ ] escritorio Chrome/Edge
- [ ] resolución pequeña
- [ ] red lenta/inestable

Revisar foco/teclado, táctil, loading, upload, retry, doble submit, acciones destructivas, errores, accesibilidad y recuperación tras refresh.

## 5.5 Uploads resilientes

- [ ] progreso
- [ ] retry/cancelación segura
- [ ] fallos de red
- [ ] idempotencia
- [ ] consistencia DB/Storage
- [ ] archivos huérfanos

## 5.6 Performance

- [ ] carga inicial
- [ ] queries lentas
- [ ] payloads
- [ ] imágenes
- [ ] paginación
- [ ] índices
- [ ] N+1
- [ ] bundle size

Entregables:

- [ ] `docs/METRICS_DEFINITIONS.md`
- [ ] dashboard operativo
- [ ] informe UX/mobile
- [ ] informe performance

---

# Sprint 6 — Documentación IT, release y paquete comercial

## 6.1 Documentación técnica final

Objetivo:

```text
README.md
docs/ARCHITECTURE.md
docs/ERD.md
docs/DOMAIN_MODEL.md
docs/SECURITY_MODEL.md
docs/RBAC_MATRIX.md
docs/DEPLOYMENT.md
docs/ENVIRONMENTS.md
docs/TESTING.md
docs/MONITORING.md
docs/BACKUP_RESTORE.md
docs/INCIDENT_RUNBOOK.md
docs/METRICS_DEFINITIONS.md
docs/DEPENDENCIES.md
CHANGELOG.md
```

## 6.2 Arquitectura / ERD

Documentar navegador/PWA, Next.js/Vercel, Auth, Postgres/RLS/RPC, Storage, integraciones, trust boundaries y flujo de datos.

ERD mínimo: profiles, deliveries, clients, delivery_requirements, requirement_types, evidences, templates, template_requirements, audit_events y entidades nuevas relevantes.

## 6.3 Runbook de deployment

Un desarrollador nuevo debe poder:

- [ ] clonar/instalar/configurar env
- [ ] levantar local
- [ ] recrear DB desde migraciones
- [ ] ejecutar tests
- [ ] desplegar staging
- [ ] promover release
- [ ] diagnosticar incidentes comunes

## 6.4 Licencias / dependencias

- [ ] inventario OSS
- [ ] licencias/versiones
- [ ] SaaS/responsabilidades
- [ ] SBOM final

## 6.5 Release Candidate

Crear `v1.0.0-rc.1` con feature freeze.

Durante RC: sólo bugfix, seguridad, documentación o cambios requeridos por IT.

Checklist:

- [ ] CI/E2E/security verdes
- [ ] migración desde productivo probada
- [ ] rollback probado
- [ ] backup/restore probado
- [ ] staging aprobado
- [ ] documentación revisada
- [ ] errores conocidos documentados
- [ ] cero CRITICAL
- [ ] HIGH cerrados o aceptados explícitamente

## 6.6 v1.0.0

Tras aceptar RC:

- [ ] tag `v1.0.0`
- [ ] fecha/commit/migraciones/changelog
- [ ] rollback target
- [ ] responsable de release

---

# Paquete para IT

Debe permitir responder:

1. Qué hace.
2. Dónde corre.
3. Qué datos almacena.
4. Quién puede hacer qué.
5. Cómo se prueba.
6. Cómo se actualiza.
7. Cómo se recupera.
8. Cómo se monitorea.
9. Qué dependencias tiene.
10. Quién lo mantiene.

Incluir arquitectura, stack, modelo, seguridad/RBAC/RLS/Storage, testing, CI/CD, ambientes, backup/DR, monitoreo, runbooks, SBOM/licencias, riesgos, roadmap y demo reproducible.

# Paquete comercial / negocio

Separado del técnico:

- problema/proceso anterior
- solución y alcance
- flujo operativo
- evidencia de adopción
- riesgos/errores reducidos
- tiempos antes/después sólo si son confiables
- trazabilidad
- dashboards/KPI
- escalabilidad
- infraestructura/mantenimiento
- soporte/licenciamiento a definir

No inventar ahorros económicos.

# Propiedad intelectual y compliance

Antes de propuesta comercial formal:

- [ ] relación desarrollo/contrato laboral
- [ ] propiedad del código
- [ ] uso de recursos corporativos
- [ ] marca Finning/CAT y activos gráficos
- [ ] tratamiento de datos internos
- [ ] términos Vercel/Supabase/proveedores
- [ ] aprobación security/compliance si aplica
- [ ] ownership y mantenimiento futuro

---

# Definition of Done — Enterprise v1.0

## Arquitectura y dominio

- [x] modelo técnico `DESPACHO` / `CUSTOMER_PICKUP` correcto en DB
- [x] transportista separado
- [x] reglas críticas centralizadas/documentadas
- [x] base reproducible desde migraciones

## Seguridad

- [x] RLS auditado completamente
- [x] RPCs privilegiadas auditadas completamente
- [ ] RBAC probado de punta a punta
- [x] Storage auditado
- [x] cero secretos de producción detectados en repo
- [x] dependencias escaneadas
- [x] SBOM disponible

## Calidad

- [ ] typecheck verde como requisito sistemático
- [ ] lint verde como requisito sistemático
- [x] unit verde
- [ ] integration verde
- [ ] E2E crítico verde
- [ ] build verde como requisito sistemático
- [ ] CI requerido para merge

## Infraestructura

- [ ] DEV separado
- [ ] STAGING separado
- [ ] PROD separado formalmente
- [ ] rollback documentado
- [ ] backups operativos formalizados
- [ ] restore probado

## Operación

- [ ] health check completo
- [ ] error tracking
- [ ] logs estructurados
- [ ] métricas técnicas
- [ ] auditoría visible
- [ ] runbook incidentes

## Negocio

- [ ] dashboard operativo
- [ ] métricas definidas
- [ ] tendencias históricas
- [ ] excepciones medibles
- [ ] evidencia cuantitativa de valor

## Documentación

- [ ] arquitectura final
- [ ] ERD
- [x] security model
- [x] RBAC formal (`docs/RBAC_MATRIX.md`)
- [ ] deployment
- [ ] ambientes
- [x] testing
- [ ] monitoreo
- [ ] backup/restore final
- [ ] incident response
- [ ] dependencias
- [ ] changelog

## Release

- [ ] `v1.0.0-rc.1` validada
- [ ] cero CRITICAL abiertos
- [ ] HIGH aceptados explícitamente o resueltos
- [ ] demo IT repetible
- [ ] `v1.0.0` etiquetada

---

# Prioridad inmediata

Completado:

1. [x] Baseline/backup.
2. [x] Auditoría arquitectura/seguridad inicial.
3. [x] Modelo definitivo de modalidad/carrier.
4. [x] Fuente única de reglas críticas.
5. [x] Matriz RBAC formal.
6. [x] Hardening Supabase (2.4).
7. [x] Supply-chain security (2.5).
8. [x] Unit testing base (3.1).

Siguiente:

9. [ ] Integration tests (3.2).
10. [ ] E2E críticos (3.3).
11. [ ] CI obligatorio (3.4).
12. [ ] Staging/ambientes (3.5).
13. [ ] Observabilidad/DR.
14. [ ] Auditoría visible.
15. [ ] Métricas/dashboard.
16. [ ] UX/performance.
17. [ ] Documentación final/RC/IT.

# Regla para futuros cambios

Toda feature debe responder antes de producción:

1. ¿Qué problema operativo resuelve?
2. ¿Qué rol puede usarla?
3. ¿Cuál es la regla de backend?
4. ¿Qué auditoría genera?
5. ¿Cómo se prueba?
6. ¿Qué métrica evalúa su resultado?
7. ¿Cómo se revierte?
8. ¿Qué documentación actualiza?

Si no puede responderse, no está lista para producción corporativa.
