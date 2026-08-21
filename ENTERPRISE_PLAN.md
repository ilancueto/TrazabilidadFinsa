# FINSA Trazabilidad — Enterprise Readiness Plan

## Objetivo

Convertir la aplicación actual de trazabilidad de bodega en un producto corporativo robusto, medible, auditable y mantenible, listo para evaluación formal por IT y para una eventual propuesta comercial interna.

El objetivo final es publicar una versión `v1.0.0` con calidad de **Enterprise Release Candidate**, documentación completa, seguridad validada, ambientes separados, pruebas automatizadas, observabilidad, recuperación ante incidentes y métricas operativas confiables.

---

## Principios de ejecución

- No agregar funcionalidades grandes mientras existan riesgos críticos de arquitectura, seguridad o integridad.
- Toda regla de negocio crítica debe validarse del lado servidor.
- Todo cambio de base debe existir como migración versionada en el repositorio.
- Ningún cambio relevante debe probarse por primera vez en producción.
- Los cambios deben llegar mediante PRs pequeños, revisables y reversibles.
- Las acciones excepcionales deben ser explícitas, justificadas y auditables.
- Los datos históricos no deben perderse durante refactors o migraciones.
- Las métricas de negocio deben tener definición documentada y reproducible.
- La documentación debe permitir que un equipo externo al autor original pueda operar y mantener el sistema.

---

# Sprint 1 — Baseline, inventario y auditoría

## 1.1 Congelar una línea base estable

- [x] Identificar el commit exacto actualmente productivo.
- [x] Crear tag `v0.9-baseline` sobre la versión estable.

Baseline productivo verificado en Vercel: `d9b5330c66370969ff0a3d60568f6a4252d17087` (deployment `READY`).
- [x] Registrar versión de Next.js, React, Supabase SDK, Node y dependencias críticas.

Versiones del baseline: Node `24.x` en Vercel (local `v24.19.0`, CI `24`), Next.js `16.3.1`, React/React DOM `19.2.8`, `@supabase/ssr` `0.12.4` y `@supabase/supabase-js` `2.112.3`. Las versiones resueltas quedan bloqueadas en `package-lock.json`.
- [x] Guardar snapshot del esquema de base.

Snapshot del esquema aplicativo `public` de producción: `supabase/schema-baselines/v0.9-baseline-public.sql` (sin datos; PostgreSQL `17.6.1`). Los esquemas gestionados por Supabase se documentarán por separado.
- [ ] Confirmar que las migraciones actuales representan el estado real de producción.

Bloqueado: el historial remoto diverge del repositorio. Producción registra `20260820223232`, `20260820224306`, `20260820225315` y `20260820230305` sin archivos locales; el repositorio contiene `20260820200000`, `20260820205500`, `20260820212000` y `20260820223500` sin registro remoto. Requiere reconciliación versionada antes de confirmar equivalencia.
- [x] Documentar buckets de Storage y políticas asociadas.

Inventario y modelo de acceso documentados en `docs/STORAGE.md`.
- [ ] Registrar variables de entorno requeridas sin incluir secretos.
- [ ] Generar backup de base y evidencias antes de comenzar cambios estructurales.

### Criterio de salida

Debe existir un punto de recuperación conocido y documentado que permita volver al sistema estable previo a la productización.

## 1.2 Auditoría completa del repositorio

Revisar:

- [ ] rutas `src/app`;
- [ ] server actions;
- [ ] rutas API;
- [ ] lógica de permisos;
- [ ] transiciones de estado;
- [ ] cálculo de progreso;
- [ ] carga/anulación/revisión de evidencias;
- [ ] generación de PDF/ZIP/Excel;
- [ ] PWA y comportamiento móvil;
- [ ] componentes compartidos;
- [ ] consultas Supabase;
- [ ] RPCs;
- [ ] RLS;
- [ ] migraciones;
- [ ] índices y constraints;
- [ ] dependencias externas;
- [ ] código muerto;
- [ ] `TODO`/`FIXME`;
- [ ] usos de `any` o casts inseguros;
- [ ] lógica duplicada frontend/backend;
- [ ] secretos o credenciales accidentales en Git.

Clasificar hallazgos:

- `CRITICAL`
- `HIGH`
- `MEDIUM`
- `LOW`
- `CLEANUP`

### Entregables

- [ ] `docs/ARCHITECTURE_CURRENT.md`
- [ ] `docs/AUDIT_REPORT.md`
- [ ] `docs/RISK_REGISTER.md`
- [ ] diagrama de arquitectura actual
- [ ] inventario de RPCs, tablas, policies y buckets

### Criterio de salida

No debe existir ninguna parte crítica del sistema cuyo comportamiento o dependencia no esté entendido y documentado.

---

# Sprint 2 — Dominio definitivo y seguridad

## 2.1 Normalizar modalidad y transportista

Situación actual: el concepto histórico `ANDREANI` funciona internamente como modalidad, aunque el negocio necesita distinguir tipo de operación de transportista.

Modelo objetivo:

```text
Modalidad
- DESPACHO
- RETIRA_CLIENTE

Transportista
- ANDREANI
- OTRO (futuro)
```

### Tareas

- [ ] Diseñar migración segura `ANDREANI -> DESPACHO`.
- [ ] Agregar campo/entidad de transportista si corresponde.
- [ ] Migrar datos históricos conservando IDs, evidencias, auditoría, fechas y estados.
- [ ] Actualizar tipos TypeScript.
- [ ] Actualizar Zod schemas.
- [ ] Actualizar filtros.
- [ ] Actualizar templates.
- [ ] Actualizar RPCs.
- [ ] Actualizar reportes.
- [ ] Actualizar pruebas.
- [ ] Confirmar que no queden comparaciones directas con `ANDREANI` como modalidad.

### Criterio de salida

La semántica de la base debe coincidir con la operación real: `DESPACHO` y `RETIRA_CLIENTE` son modalidades; Andreani es un transportista.

## 2.2 Fuente única de reglas de negocio

- [ ] Inventariar todas las reglas de transición de estado.
- [ ] Inventariar reglas de cierre.
- [ ] Inventariar reglas de evidencias FLOOR/DISPATCH.
- [ ] Inventariar reglas por rol.
- [ ] Eliminar contradicciones entre frontend y backend.
- [ ] Definir claramente qué puede ocurrir en `DRAFT`, `PUBLISHED`, `IN_PICKING`, `READY`, `CLOSED`.
- [ ] Hacer que el frontend refleje reglas, no que las invente.

### Criterio de salida

Una misma operación debe producir el mismo resultado sin importar desde qué componente sea invocada.

## 2.3 Matriz RBAC formal

Crear `docs/RBAC_MATRIX.md` con acciones y roles.

Cobertura mínima:

| Acción | Picking | Supervisor | Admin |
|---|---:|---:|---:|
| Ver operaciones | Sí | Sí | Sí |
| Cargar evidencia | Sí | Según regla | Sí |
| Tomar trabajo | Sí | Según regla | Sí |
| Crear entrega | No | Definir | Sí |
| Editar maestros | No | Definir | Sí |
| Revisar evidencia | No | Sí | Sí |
| Cierre normal | No | Definir | Sí |
| Reabrir | No | Definir | Sí |
| Cierre excepcional | No | No | Sí |
| Gestionar usuarios | No | No | Sí |
| Ajustes de catálogo | No | No | Sí |

## 2.4 Hardening Supabase

- [ ] Revisar todas las policies RLS.
- [ ] Confirmar que cada tabla sensible tenga RLS habilitado.
- [ ] Revisar todas las funciones `SECURITY DEFINER`.
- [ ] Fijar `search_path` explícito en RPCs privilegiadas.
- [ ] Revisar grants a `anon`, `authenticated`, `service_role`.
- [ ] Evitar autorización basada únicamente en inputs del cliente.
- [ ] Validar ownership y acceso a Storage.
- [ ] Revisar signed URLs y expiración.
- [ ] Validar MIME real y extensiones.
- [ ] Validar límite de tamaño.
- [ ] Prevenir paths arbitrarios.
- [ ] Revisar eliminación/anulación de evidencias.
- [ ] Confirmar que usuarios deshabilitados pierdan acceso efectivo.

## 2.5 Seguridad de supply chain

- [ ] Dependabot o equivalente habilitado.
- [ ] `npm audit`/scanner de dependencias en CI.
- [ ] secret scanning.
- [ ] code scanning si está disponible.
- [ ] revisar dependencias sin mantenimiento.
- [ ] generar SBOM inicial.

### Entregables del Sprint 2

- [ ] `docs/DOMAIN_MODEL.md`
- [ ] `docs/RBAC_MATRIX.md`
- [ ] `docs/SECURITY_MODEL.md`
- [ ] migración de modalidad
- [ ] suite de pruebas de permisos base

### Criterio de salida

Las reglas de negocio y seguridad deben estar expresadas, implementadas y verificadas en backend.

---

# Sprint 3 — Testing, CI y ambientes

## 3.1 Unit tests

Cobertura prioritaria:

- [ ] transiciones de estado;
- [ ] permisos;
- [ ] cálculo de progreso;
- [ ] requisitos FLOOR/DISPATCH;
- [ ] filtros por modalidad;
- [ ] búsquedas;
- [ ] lógica de cierres;
- [ ] cierres excepcionales;
- [ ] reaperturas;
- [ ] alertas.

Objetivo orientativo: alta cobertura del dominio crítico; evitar perseguir cobertura artificial de componentes triviales.

## 3.2 Integration tests

- [ ] RPC de creación/edición.
- [ ] transición PUBLISHED -> IN_PICKING.
- [ ] transición IN_PICKING -> READY.
- [ ] carga de evidencia FLOOR.
- [ ] carga de evidencia DISPATCH en READY.
- [ ] revisión de evidencia.
- [ ] cierre normal.
- [ ] reapertura.
- [ ] cierre excepcional.
- [ ] archive/soft delete.
- [ ] RLS por rol.
- [ ] Storage access.
- [ ] rechazo de operaciones no autorizadas.

## 3.3 E2E críticos con Playwright

### Flujo DESPACHO

- [ ] Admin crea despacho.
- [ ] Admin publica.
- [ ] Picking lo ve solo en Despachos.
- [ ] Picking lo toma.
- [ ] Picking carga evidencias de Piso.
- [ ] Picking marca Lista.
- [ ] Picking carga evidencia de Despacho.
- [ ] Supervisor/Admin revisa.
- [ ] Admin cierra.
- [ ] Auditoría final correcta.

### Flujo RETIRA CLIENTE

- [ ] Admin crea retiro.
- [ ] Aparece solo en Retira cliente.
- [ ] Picking lo toma.
- [ ] Carga evidencias requeridas.
- [ ] Marca listo.
- [ ] Se revisa/cierra según regla definida.
- [ ] Auditoría final correcta.

### Casos de regresión

- [ ] doble click/doble submit;
- [ ] dos pickers intentando tomar la misma entrega;
- [ ] evidencia rechazada;
- [ ] evidencia anulada;
- [ ] observación abierta;
- [ ] reapertura;
- [ ] cierre excepcional;
- [ ] refresh durante upload;
- [ ] error de red;
- [ ] usuario desactivado;
- [ ] intento de llamada directa a RPC restringida;
- [ ] operación archivada;
- [ ] carga de foto no permitida por etapa.

## 3.4 Pipeline CI obligatorio

Cada PR debe ejecutar:

```text
typecheck
lint
unit
integration
build
e2e-critical
security-scan
```

- [ ] bloquear merge ante fallos críticos;
- [ ] almacenar resultados/test artifacts cuando sea útil;
- [ ] documentar comandos locales equivalentes.

## 3.5 Separación DEV / STAGING / PROD

### DEV

- desarrollo local;
- datos sintéticos;
- libertad de reset.

### STAGING

- proyecto Supabase independiente;
- Vercel Preview/Staging;
- sin datos reales sensibles;
- migraciones se validan aquí antes de producción.

### PROD

- acceso restringido;
- cambios únicamente provenientes de release aprobada;
- backups y monitoreo activos.

### Tareas

- [ ] crear Supabase staging;
- [ ] configurar variables de entorno por ambiente;
- [ ] separar Storage;
- [ ] preparar datos seed sintéticos;
- [ ] probar migraciones completas en staging;
- [ ] documentar promoción a producción;
- [ ] documentar rollback.

### Entregables del Sprint 3

- [ ] `docs/TESTING.md`
- [ ] `docs/ENVIRONMENTS.md`
- [ ] pipeline CI estable
- [ ] staging funcional

### Criterio de salida

Los flujos críticos deben poder probarse automáticamente antes de cada release y ningún cambio debe depender de probar directamente en producción.

---

# Sprint 4 — Observabilidad, auditoría y recuperación

## 4.1 Logging estructurado

Agregar campos útiles:

- timestamp;
- environment;
- request/operation ID;
- route/action;
- user ID cuando corresponda;
- delivery ID;
- duration;
- result;
- error code.

Nunca registrar:

- passwords;
- access tokens;
- service role keys;
- contenido sensible innecesario.

## 4.2 Error tracking

- [ ] integrar una herramienta de error tracking aprobable por IT;
- [ ] capturar errores server y client relevantes;
- [ ] agrupar errores repetidos;
- [ ] conservar stack traces útiles;
- [ ] distinguir staging/prod;
- [ ] definir política de datos enviados al proveedor.

## 4.3 Health checks

`/api/health` debe verificar como mínimo:

- [ ] proceso web operativo;
- [ ] conectividad a Supabase;
- [ ] consulta simple a DB;
- [ ] disponibilidad de dependencias críticas.

Evitar exponer secretos o información interna sensible.

## 4.4 Métricas técnicas

Medir:

- [ ] uploads exitosos/fallidos;
- [ ] latencia API;
- [ ] errores RPC;
- [ ] errores por endpoint;
- [ ] errores por status HTTP;
- [ ] reintentos;
- [ ] cierres excepcionales;
- [ ] reaperturas;
- [ ] tiempos de respuesta p50/p95.

## 4.5 Auditoría visible

Crear timeline por entrega con:

- creación;
- publicación;
- asignación;
- claim;
- carga/anulación/revisión de evidencia;
- observaciones;
- READY;
- cierre;
- reapertura;
- archivo;
- cierres excepcionales.

Crear panel de eventos sensibles:

- [ ] cierres excepcionales;
- [ ] reaperturas;
- [ ] archivos;
- [ ] cambios de responsable;
- [ ] evidencias anuladas/rechazadas;
- [ ] cambios administrativos.

Filtros:

- fecha;
- usuario;
- entrega;
- acción;
- motivo.

## 4.6 Backup y restore

Definir:

- [ ] backup de PostgreSQL;
- [ ] backup/retención de Storage;
- [ ] frecuencia;
- [ ] retención;
- [ ] responsable;
- [ ] recuperación;
- [ ] validación posterior al restore.

Realizar simulacro:

- [ ] restaurar staging desde backup;
- [ ] validar tablas;
- [ ] validar evidencias;
- [ ] validar usuarios/configuración necesaria;
- [ ] documentar duración real.

Definir:

- `RPO` objetivo;
- `RTO` objetivo.

### Entregables del Sprint 4

- [ ] `docs/MONITORING.md`
- [ ] `docs/BACKUP_RESTORE.md`
- [ ] `docs/INCIDENT_RUNBOOK.md`
- [ ] auditoría visible
- [ ] restore probado

### Criterio de salida

Ante un error o incidente debe ser posible detectar qué pasó, identificar el alcance y recuperar el servicio mediante un procedimiento documentado.

---

# Sprint 5 — Métricas, UX y performance

## 5.1 Definir métricas operativas

Toda métrica debe tener definición escrita antes de implementarse.

### Volumen

- [ ] despachos por día/semana/mes;
- [ ] retiros por día/semana/mes;
- [ ] cerradas;
- [ ] backlog;
- [ ] urgentes.

### Tiempos

- [ ] publicación -> primera evidencia;
- [ ] publicación -> finalización de Piso;
- [ ] Piso -> READY;
- [ ] READY -> evidencia Despacho;
- [ ] READY -> CLOSED;
- [ ] lead time total.

Calcular:

- promedio;
- mediana/P50;
- P90;
- tendencia.

### Calidad

- [ ] observaciones por operación;
- [ ] evidencia rechazada;
- [ ] reaperturas;
- [ ] cierres excepcionales;
- [ ] operaciones con faltantes;
- [ ] tasa de finalización sin incidentes.

### Productividad

- [ ] volumen por picker;
- [ ] tiempo medio por picker cuando sea operacionalmente válido;
- [ ] carga actual;
- [ ] trabajo sin asignar.

No convertir métricas en ranking individual sin validación del negocio/HR.

## 5.2 Dashboard

Vistas sugeridas:

- Hoy;
- Últimos 7 días;
- Mes;
- Comparativa con período anterior;
- Despachos;
- Retira cliente;
- Calidad;
- Excepciones.

## 5.3 KPI corporativos

- [ ] reunirse con stakeholders para obtener definiciones oficiales de OTIF/OTIL/IRA u otros KPI aplicables;
- [ ] documentar fórmula oficial;
- [ ] identificar datos faltantes;
- [ ] implementar únicamente cuando exista trazabilidad suficiente.

No etiquetar una métrica propia con un KPI corporativo si la fórmula no coincide oficialmente.

## 5.4 UX operativa

Probar en:

- [ ] iPhone Safari/PWA;
- [ ] Android Chrome/PWA;
- [ ] escritorio Chrome/Edge;
- [ ] resolución pequeña;
- [ ] red lenta/inestable.

Revisar:

- [ ] foco y teclado móvil;
- [ ] tamaños táctiles;
- [ ] loading states;
- [ ] feedback de upload;
- [ ] retry;
- [ ] doble submit;
- [ ] confirmaciones destructivas;
- [ ] mensajes de error;
- [ ] accesibilidad teclado;
- [ ] contraste;
- [ ] labels/ARIA;
- [ ] recuperación tras refresh.

## 5.5 Resiliencia de uploads

- [ ] barra/estado de progreso;
- [ ] cancelación/reintento seguro;
- [ ] detección de fallo de red;
- [ ] idempotencia para evitar duplicados;
- [ ] mensaje claro cuando DB registra pero Storage falla o viceversa;
- [ ] estrategia de limpieza de archivos huérfanos.

## 5.6 Performance

Medir:

- [ ] tiempo inicial de carga;
- [ ] queries lentas;
- [ ] payloads;
- [ ] imágenes;
- [ ] pagination;
- [ ] índices DB;
- [ ] N+1 queries;
- [ ] bundle size.

### Entregables del Sprint 5

- [ ] `docs/METRICS_DEFINITIONS.md`
- [ ] dashboard operativo
- [ ] informe UX/mobile
- [ ] informe de performance

### Criterio de salida

El sistema debe demostrar cuantitativamente qué ocurre en la operación y mantenerse usable en las condiciones reales de bodega.

---

# Sprint 6 — Documentación IT, release y paquete comercial

## 6.1 Documentación técnica mínima

Crear/actualizar:

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

## 6.2 Arquitectura

Documentar:

- usuario;
- navegador/PWA;
- Next.js;
- Vercel;
- Supabase Auth;
- Postgres;
- RLS;
- RPCs;
- Storage;
- integraciones externas;
- límites de confianza;
- flujo de datos.

## 6.3 ERD

Mostrar como mínimo:

- profiles;
- deliveries;
- clients;
- delivery_requirements;
- requirement_types;
- evidences;
- templates;
- template_requirements;
- audit_events;
- entidades adicionales relevantes.

## 6.4 Deployment/runbook

Un desarrollador nuevo debe poder:

- [ ] clonar;
- [ ] instalar;
- [ ] configurar env;
- [ ] levantar local;
- [ ] crear DB desde migraciones;
- [ ] ejecutar tests;
- [ ] desplegar staging;
- [ ] promover release;
- [ ] diagnosticar incidentes comunes.

## 6.5 Licencias y dependencias

- [ ] inventario OSS;
- [ ] licencias;
- [ ] versiones;
- [ ] servicios SaaS;
- [ ] responsabilidades;
- [ ] SBOM final.

## 6.6 Release Candidate

Feature freeze.

Crear:

```text
v1.0.0-rc.1
```

Durante RC solo aceptar:

- bug fixes;
- seguridad;
- documentación;
- cambios requeridos por IT.

Checklist RC:

- [ ] CI verde;
- [ ] E2E verde;
- [ ] security tests verdes;
- [ ] migración desde estado productivo probada;
- [ ] rollback probado;
- [ ] backup/restore probado;
- [ ] staging aprobado;
- [ ] documentación revisada;
- [ ] errores conocidos documentados;
- [ ] cero issues CRITICAL abiertos;
- [ ] HIGH justificados o cerrados.

## 6.7 Release v1.0.0

Solo luego de aceptación del RC:

```text
v1.0.0
```

Registrar:

- fecha;
- commit;
- migraciones;
- changelog;
- rollback target;
- responsable de release.

---

# Paquete para IT

Preparar una entrega técnica con:

1. Resumen ejecutivo técnico.
2. Arquitectura.
3. Stack y dependencias.
4. Modelo de datos.
5. Seguridad y RBAC.
6. RLS y Storage.
7. Estrategia de testing.
8. CI/CD.
9. Ambientes.
10. Backup/DR.
11. Monitoreo.
12. Runbooks.
13. SBOM/licencias.
14. Riesgos conocidos.
15. Roadmap futuro.
16. Demo reproducible.

El objetivo es que IT pueda responder:

- ¿Qué hace?
- ¿Dónde corre?
- ¿Qué datos almacena?
- ¿Quién puede hacer qué?
- ¿Cómo se prueba?
- ¿Cómo se actualiza?
- ¿Cómo se recupera?
- ¿Cómo se monitorea?
- ¿Qué dependencias tiene?
- ¿Quién lo mantiene?

---

# Paquete comercial / negocio

Separado del documento técnico.

Debe incluir:

- problema original;
- proceso anterior;
- solución;
- alcance actual;
- flujo operativo;
- evidencia de adopción;
- errores/riesgos reducidos;
- tiempos antes/después si existen datos confiables;
- trazabilidad obtenida;
- dashboards/KPIs;
- escalabilidad a otras bodegas/sucursales;
- costos de infraestructura;
- costos de mantenimiento;
- propuesta de soporte;
- modelo de entrega/licenciamiento a definir.

No presentar ahorros económicos inventados: toda afirmación debe estar respaldada por mediciones o supuestos claramente indicados.

---

# Propiedad intelectual y compliance

Antes de una propuesta comercial formal:

- [ ] revisar relación entre desarrollo y contrato laboral;
- [ ] determinar propiedad del código;
- [ ] revisar uso de recursos corporativos;
- [ ] revisar marca Finning/CAT y activos gráficos;
- [ ] revisar tratamiento de datos internos;
- [ ] revisar términos de Vercel/Supabase y proveedores externos;
- [ ] determinar si se requiere aprobación de seguridad/compliance;
- [ ] acordar ownership y mantenimiento posterior.

Este punto debe resolverse antes de fijar una estructura comercial definitiva.

---

# Definition of Done — Enterprise v1.0

La aplicación no se considerará lista para entrega a IT hasta cumplir:

## Arquitectura y dominio

- [ ] modelo `DESPACHO` / `RETIRA_CLIENTE` correcto en DB;
- [ ] transportista separado;
- [ ] reglas críticas centralizadas;
- [ ] base reproducible desde migraciones.

## Seguridad

- [ ] RLS auditado;
- [ ] RPCs auditadas;
- [ ] RBAC probado;
- [ ] Storage auditado;
- [ ] cero secretos en repo;
- [ ] dependencias escaneadas;
- [ ] SBOM disponible.

## Calidad

- [ ] typecheck verde;
- [ ] lint verde;
- [ ] unit verde;
- [ ] integration verde;
- [ ] E2E crítico verde;
- [ ] build verde;
- [ ] CI requerido para merge.

## Infraestructura

- [ ] DEV separado;
- [ ] STAGING separado;
- [ ] PROD separado;
- [ ] rollback documentado;
- [ ] backups activos;
- [ ] restore probado.

## Operación

- [ ] health check;
- [ ] error tracking;
- [ ] logs estructurados;
- [ ] métricas técnicas;
- [ ] auditoría visible;
- [ ] runbook de incidentes.

## Negocio

- [ ] dashboard operativo;
- [ ] métricas definidas;
- [ ] tendencias históricas;
- [ ] excepciones medibles;
- [ ] datos suficientes para demostrar valor.

## Documentación

- [ ] arquitectura;
- [ ] ERD;
- [ ] seguridad;
- [ ] RBAC;
- [ ] deployment;
- [ ] ambientes;
- [ ] testing;
- [ ] monitoreo;
- [ ] backup/restore;
- [ ] incident response;
- [ ] dependencias;
- [ ] changelog.

## Release

- [ ] `v1.0.0-rc.1` validada;
- [ ] cero CRITICAL abiertos;
- [ ] riesgos HIGH aceptados explícitamente o resueltos;
- [ ] demo de IT repetible;
- [ ] release `v1.0.0` etiquetada.

---

# Orden de prioridad inmediato

No comenzar por dashboards ni features nuevas.

Orden recomendado:

1. Baseline y backup.
2. Auditoría de arquitectura/seguridad.
3. Modelo definitivo de modalidad.
4. Fuente única de reglas críticas.
5. Tests de permisos y E2E.
6. CI.
7. Staging.
8. Observabilidad.
9. Backup/restore probado.
10. Auditoría visible.
11. Métricas y dashboard.
12. UX/performance.
13. Documentación final.
14. RC y presentación a IT.

---

# Regla para futuros cambios

Toda nueva funcionalidad deberá responder estas preguntas antes de implementarse:

1. ¿Qué problema operativo resuelve?
2. ¿Qué rol puede usarla?
3. ¿Cuál es la regla del backend?
4. ¿Qué evento de auditoría genera?
5. ¿Cómo se prueba automáticamente?
6. ¿Qué métrica permite evaluar su resultado?
7. ¿Cómo se revierte si falla?
8. ¿Qué documentación debe actualizarse?

Si una feature no puede responderlas todavía, no está lista para producción corporativa.
