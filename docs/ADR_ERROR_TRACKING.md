# ADR — Error tracking (Sprint 4.2a)

Estado: **decisión técnica recomendada. No implementada.**

Fecha de consulta de fuentes oficiales: **2026-08-22**.

Esta etapa no instala SDKs, no crea cuentas, no configura DSN, no toca Vercel ni Supabase y no habilita envío externo.

Documento rector: `ENTERPRISE_PLAN.md` Sprint 4.2. Esta subetapa cubre únicamente la decisión de herramienta y la política de datos. Sprint 4.2 permanece incompleto hasta 4.2b.

---

## Contexto

`main` al inicio de este análisis: `e22ec4dc3cde32b6748cbf7fb62b69a844a97df3` (merge de Sprint 4.1).

Sprint 4.1 dejó un contrato de logging estructurado en `src/lib/observability.ts` y `docs/MONITORING.md`. Ese contrato cubre timestamp, environment, códigos estables, requestId/operationId, route/action/operation, duración, resultado y redacción de secretos. **No cubre** stack traces (se omiten a propósito), agrupación de eventos equivalentes, errores de cliente, source maps ni un producto de issues.

La aplicación es Next.js **16.3.1** (App Router, React 19.2.8) en Vercel, con Route Handlers, Server Actions, `src/proxy.ts` y un `src/app/error.tsx` que muestra `error.digest` pero **no reporta** a ningún servicio. No existen `instrumentation.ts`, `global-error.tsx` ni SDK de error tracking.

Política de costo vigente: **costo adicional no aprobado = USD 0**.

---

## Problema

Sin error tracking, un fallo de servidor sólo aparece como una línea JSON en runtime logs de Vercel (retención corta) y un fallo de cliente puede no dejar rastro. Sprint 4.2 exige:

- herramienta aprobable por IT;
- errores server y client relevantes;
- agrupación y stack traces;
- separación STAGING / PROD;
- política explícita de datos enviados.

El logger de 4.1 no cumple esos puntos por diseño. Hay que decidir si un proveedor externo es necesario, cuál, qué datos puede recibir y cómo desactivarlo, **antes** de integrar nada.

---

## Requisitos

Obligatorios (Sprint 4.2):

| Requisito | Criterio de aceptación |
| --- | --- |
| Herramienta aprobable por IT | Vendor documentado, DPA disponible, controles de acceso, kill switch. Aprobación humana pendiente. |
| Errores server | Unhandled + handled relevantes en Route Handlers, Server Actions, proxy y `onRequestError`. |
| Errores client | Error boundary App Router + unhandled en cliente. |
| Agrupación | Eventos equivalentes colapsan en un issue. |
| Stack traces | Frames originales, no sólo el bundle minificado. |
| Separación STAGING / PROD | Un evento de staging no se confunde con producción. |
| Política de datos | Allowlist mínima; denylist explícita. |

Adicionales de esta subetapa:

- release SHA;
- environment;
- requestId / operationId;
- route / action / operation;
- códigos estables de 4.1 cuando existan;
- scrubbing/redaction;
- kill switch;
- el proveedor caído no debe romper requests, uploads, navegación, Server Actions ni login.

El error tracking **nunca** es dependencia crítica de la aplicación.

---

## Qué cubre Sprint 4.1 y qué falta

Cubierto hoy:

- Logs JSON en servidor con redacción de passwords, tokens, Authorization, cookies, API keys, service-role, secretos y omit de bodies/evidencias.
- Correlación `requestId` / `operationId`.
- Códigos estables (`evidence.upload_failed`, `health.check_failed`, etc.).
- Superficies instrumentadas: `src/proxy.ts`, `src/app/api/evidence/route.ts`, `src/app/api/health/route.ts`, `src/app/api/deliveries/export-zip/route.ts`, `src/app/admin/deliveries/[id]/report/route.ts`, `src/lib/actions/evidence.ts`, `src/lib/evidence/persist.ts`, `src/lib/storage/supabase-adapter.ts`, `src/lib/clients/queries.ts`.

Falta realmente (no inventado):

- Stack traces (el logger los excluye).
- Agrupación de issues.
- Errores de cliente (`src/app/error.tsx` no reporta; no hay `global-error.tsx`).
- Source maps.
- Release tracking.
- Alertas de error (Vercel Alerts requiere Observability Plus, plan pago).
- Retención operativa: runtime logs Vercel Hobby = **1 hora**; Pro = 1 día. Insuficiente para un issue que aparece al día siguiente.

---

## Fuentes oficiales consultadas (2026-08-22)

| Fuente | URL |
| --- | --- |
| Sentry Next.js SDK | https://docs.sentry.io/platforms/javascript/guides/nextjs/ |
| Sentry data collected | https://docs.sentry.io/platforms/javascript/guides/nextjs/data-management/data-collected/ |
| Sentry scrubbing | https://docs.sentry.io/platforms/javascript/guides/nextjs/data-management/sensitive-data/ |
| Sentry options (DSN, enabled, environment, dataCollection) | https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/ |
| Sentry environments | https://docs.sentry.io/concepts/key-terms/environments/ |
| Sentry data residency US/EU | https://docs.sentry.io/organization/data-storage-location/ |
| Sentry pricing docs | https://docs.sentry.io/pricing/ |
| Sentry pricing page | https://sentry.io/pricing/ |
| Sentry DPA | https://sentry.io/legal/dpa/ |
| `@sentry/nextjs` npm (10.70.0, 2026-08-10) | https://www.npmjs.com/package/@sentry/nextjs |
| Sentry Turbopack / Next.js 16 (2026-01-29) | https://blog.sentry.io/turbopack-support-next-js-sdk/ |
| BugSnag React | https://docs.bugsnag.com/platforms/javascript/react/ |
| BugSnag Express/Node | https://docs.bugsnag.com/platforms/javascript/express/ |
| Rollbar Next.js | https://docs.rollbar.com/docs/nextjs |
| Rollbar pricing | https://rollbar.com/pricing/ |
| Vercel Observability | https://vercel.com/docs/observability |
| Vercel Observability Plus | https://vercel.com/docs/observability/observability-plus |
| Vercel runtime logs | https://vercel.com/docs/logs/runtime |
| Vercel alerts | https://vercel.com/docs/alerts/configure-alerts |
| Next.js error handling | https://nextjs.org/docs/app/getting-started/error-handling |
| Next.js OpenTelemetry | https://nextjs.org/docs/app/guides/open-telemetry |

No se usaron blogs de terceros como base de la decisión. Las páginas de marketing de pricing se contrastaron con `docs.sentry.io/pricing` y `rollbar.com/pricing`.

---

## Alternativas

### Opción A — Sólo logging existente (Sprint 4.1 + Vercel Logs)

Usar `logServerError` y filtrar runtime logs.

Hechos verificados:

- El logger no incluye stack ni causa completa.
- Vercel Runtime Logs retiene **1 hora** en Hobby y **1 día** en Pro (`https://vercel.com/docs/logs/runtime`, 2026-08-03).
- No hay agrupación de issues ni source maps.
- No hay captura de errores de React en cliente.
- Alertas de anomalía de error en Vercel requieren Observability Plus (Pro/Enterprise, costo adicional).

Cumple Sprint 4.2: **no**.

Costo: USD 0. Operación: búsqueda manual, ventana corta, sin client errors.

### Opción B1 — Sentry (`@sentry/nextjs`) — **RECOMENDADA**

SDK oficial de Next.js. Wizard documentado, pero 4.2b **no debe usarlo a ciegas**: los ejemplos oficiales habilitan Session Replay, tracing y logs.

Hechos verificados:

- Soporte Next.js ≥ 13.2.0; `@sentry/nextjs` 10.70.0 publicado 2026-08-10.
- Next.js 16 usa Turbopack por defecto; el SDK lo soporta desde 15.4.1+ (blog oficial 2026-01-29).
- Init separado: client (`instrumentation-client.ts`), server (`sentry.server.config.ts`), edge (`sentry.edge.config.ts`).
- `onRequestError = Sentry.captureRequestError` en `instrumentation.ts`.
- `withSentryConfig` sube source maps; `SENTRY_AUTH_TOKEN` en CI.
- `global-error.tsx` para errores de layout raíz.
- Si `dsn` no está seteado, el SDK **no envía eventos**.
- `enabled: false` deja de enviar, pero no elimina todo el overhead; para apagar de verdad no llamar `Sentry.init`.
- Environments son tags case-sensitive; no se pueden borrar, sí ocultar.
- Plan Developer: **USD 0**, 1 usuario, 5k errors/mes, 5M spans, 50 replays, 5 GB logs, retención 30 días. Unlimited projects.
- Plan Team: **USD 26/mes** anual con volumen incluido; PAYG por overage en planes **pagos**.
- Data residency US (Iowa) o EU (Frankfurt) **al crear la organización**; no se puede cambiar después.
- DPA público: `https://sentry.io/legal/dpa/` (v5.1.0, 2024-05-29). SOC2/ISO 27001 aparecen en la tabla de planes; no se afirma cumplimiento corporativo Finning.
- Trial Business 14 días sin tarjeta (página de pricing). Developer es $0.

Costo de esta etapa: USD 0 (no se crea cuenta). Entrada futura en Developer: USD 0 si no se agrega tarjeta ni PAYG. Team/Business: **REQUIERE APROBACIÓN DE COSTO**.

Riesgo de costo: bajo en Developer si no hay tarjeta; alto si se pasa a Team con PAYG o se habilitan Replay/Tracing/Logs.

### Opción B2 — Rollbar (`rollbar` + `@rollbar/react`)

Guía oficial Next.js (App Router y Pages). Setup manual: tokens client/server, Provider en layout, reporte en `error.tsx` / `global-error.tsx`.

Hechos verificados:

- Soporte oficial “Supported” para Next.js App Router.
- No hay SDK de primer nivel equivalente a `@sentry/nextjs` (sin wizard Turbopack, sin `withSentryConfig`, sin `onRequestError` de framework).
- Plan Free: **USD 0**, 5k occurrences/mes, 1k session replays, retención 30 días, **unlimited users y projects**.
- Overages: por defecto **stop at plan limit** (sin cargo sorpresa). On-demand y overage budgets son opt-in.
- Session Replay viene en el free (1k/mes): para este proyecto debe permanecer **deshabilitado**.

Cumple los requisitos de producto con más trabajo de instrumentación y menos cobertura automática de RSC/Server Actions/edge.

Costo: USD 0 en Free si no se activa on-demand. Better que Sentry para acceso multi-usuario en plan gratis. Peor encaje con Next 16.

### Opción B3 — BugSnag / SmartBear Insight Hub

Docs oficiales: React (`@bugsnag/js` + `@bugsnag/plugin-react`) y Express (`@bugsnag/plugin-express`). Búsqueda en docs.bugsnag.com el 2026-08-22: **no hay guía Next.js App Router**.

Hechos verificados:

- Server en Next no es Express; el middleware Express no aplica.
- Source maps vía CLI/plugins de bundler, no first-class Turbopack.
- Alta de producto dirigida a trial de Insight Hub (`smartbear.com/insight-hub/pricing`).

No se recomienda: peor encaje con el stack actual y onboarding de pago/trial.

### Opción C — Sólo Vercel Observability / `@vercel/otel`

Hechos verificados:

- Observability en todos los planes, con límites. Mide Functions, Edge Requests, error **rate**, no issues agrupados de aplicación.
- Observability Plus: Pro/Enterprise, **USD 1.20 / 1M events**. **REQUIERE APROBACIÓN DE COSTO**.
- Alertas de anomalía: Pro/Enterprise + Observability Plus.
- `@vercel/otel` y `instrumentation.ts` son tracing/OpenTelemetry, no un producto de error tracking client+server con grouping.
- Next.js documenta `onRequestError` para **conectar un proveedor**; no sustituye al proveedor.

Cumple Sprint 4.2: **no**. Se conserva como complemento de infra (ya existe el dashboard). No se habilita Plus.

---

## Matriz comparativa

Leyenda: sí / parcial / no.

| Criterio | A Logs 4.1 | B1 Sentry **RECOMENDADA** | B2 Rollbar | B3 BugSnag | C Vercel O11y |
| --- | --- | --- | --- | --- | --- |
| Soporte Next.js 16 / App Router | n/a | sí (SDK oficial, Turbopack) | sí (guía manual) | no (React/Express) | parcial (OTel server) |
| Errores server | parcial (log sin stack) | sí | sí (manual) | parcial | parcial (5xx / logs) |
| Errores client | no | sí | sí | sí (React boundary) | no |
| Stack traces | no | sí | sí | sí | no |
| Source maps | no | sí (`withSentryConfig`) | sí (build extra) | sí (CLI) | no |
| Grouping | no | sí | sí | sí | no |
| Release tracking | no (sólo SHA en log si se agrega) | sí | sí | sí | deployments, no issues |
| Separación env | Vercel prod/preview | projects + `environment` | environment + tokens | releaseStage | prod/preview |
| Scrubbing | sí (logger local) | sí (`beforeSend`, server-side, dataCollection) | sí (payload transform) | sí (`onError`) | n/a hacia tercero |
| Sampling | n/a | sí (`sampleRate`, traces) | sí | sí | n/a |
| Plan gratuito | sí | sí (Developer) | sí (Free) | trial, no free forever claro | Observability base sí; Plus no |
| Límites free | logs 1 h Hobby | 5k errors, 1 user, 30 d | 5k events, unlimited users, 30 d | no verificado como free forever | 1 h logs Hobby |
| Riesgo de costo | bajo | medio si Team/PAYG/Replay | bajo si stop-at-limit | medio (trial→pago) | alto si Plus |
| Privacidad / datos externos | no salen | SaaS US o EU | SaaS | SaaS | se quedan en Vercel |
| Lock-in | nulo | medio (SDK + DSN) | medio | medio | nulo extra |
| Dificultad operativa | baja | media (init ×3 runtimes) | media-alta (cableado manual) | alta en Next 16 | baja |
| Facilidad de desactivación | n/a | alta (DSN vacío / no init) | alta (tokens vacíos) | alta | n/a |
| IT-aprobable | sí (ya está) | sí, con DPA; 1 user en free | sí; unlimited users en free | débil | ya usado |

---

## Decisión recomendada

**RECOMENDADA: Sentry (`@sentry/nextjs`) en plan Developer, deshabilitado por defecto, dos proyectos (staging y prod), residencia EU al crear la org, sin Replay, sin Tracing, sin Logs de Sentry, sin PII.**

Razones:

1. Única opción con SDK de primer nivel para Next.js 16 + Turbopack + `onRequestError` + source maps de build.
2. Cubre server, client y edge, grouping, stack traces, release y environments.
3. Kill switch oficial: DSN vacío = no envío.
4. Existe plan USD 0 suficiente para un app interno de bajo volumen **si** no se habilitan productos extra.
5. DPA y data residency EU están documentados. No implica que Finning los haya aprobado.
6. Rollbar es el **respaldo** si IT rechaza Sentry o exige varios usuarios en plan gratis. BugSnag no encaja. Logs solos y Vercel Observability no cumplen Sprint 4.2.

Esta recomendación es **técnica**. Crear la organización, aceptar el DPA y enviar eventos reales **requiere aprobación humana/IT**. Hasta esa aprobación, 4.2b puede dejar el código listo pero **apagado**.

---

## Costo

| Concepto | Valor | Notas |
| --- | --- | --- |
| Esta etapa (4.2a) | **USD 0** | Sólo documentación. |
| Cuenta Developer (futuro) | USD 0 | 5k errors/mes, 1 usuario. No contratar ahora. |
| Tarjeta | no requerida para Developer (trial Business sin tarjeta, página oficial) | No agregar método de pago. |
| Exceder 5k errors en Developer | no hay tabla PAYG para Developer en `docs.sentry.io/pricing` | PAYG está documentado para **paid plans**. No subir de plan. |
| Team | USD 26/mes anual | **REQUIERE APROBACIÓN DE COSTO**. Habilita unlimited users y PAYG. |
| Observability Plus / BugSnag pago | — | No. |
| Costo de desactivación | USD 0 | Quitar DSN, no llamar `init`, desinstalar el paquete. |
| Migración fuera de Sentry | media | Eventos históricos quedan en Sentry 30 días (Developer). |

Regla: **PAYG budget = 0**. Si algún día hay plan pago, el overage documentado se dropea al agotar reserved+PAYG; el riesgo es perder visibilidad, no una factura sorpresa, **siempre que PAYG esté en 0**.

---

## Política de datos

Alineada con el logger de 4.1. El SDK de Sentry, si se inicializa con `dataCollection` (disponible desde 10.57.0), **cambia los defaults a más permisivos**. 4.2b no debe pasar un objeto `dataCollection` a menos que opte **out** de cada categoría. Preferir no usar `dataCollection` y dejar `sendDefaultPii` unset/`false`.

### Permitidos por defecto

- `environment` (`development` / `staging` / `production`)
- `release` = git SHA (`VERCEL_GIT_COMMIT_SHA`)
- tipo de error, message redactado, stack trace
- route / action / operation
- código estable (`evidence.upload_failed`, etc.)
- `requestId` / `operationId` (ya validados como correlation ids seguros)
- `durationMs`
- metadata técnica mínima ya usada por el logger (MIME, sizeBytes, no contents)
- `actorId` como UUID interno **opcional**, nunca email

### Prohibidos por defecto

- passwords, access/refresh tokens, service-role, anon key innecesaria
- `Authorization`, cookies, headers completos
- request/response bodies, FormData, query strings con datos
- imágenes, evidencias, PDFs, ZIPs, URLs firmadas
- secretos y credenciales
- emails, nombres, teléfonos, CUIT, direcciones de cliente
- IP de usuario
- variables locales del stack
- contenido de evidencias o comentarios de negocio extensos

### Funciones sensibles — decisión para 4.2b

| Función | Decisión | Motivo |
| --- | --- | --- |
| Session Replay | **deshabilitar** | Graba UI; evidencias y datos de entrega visibles. Wizard lo prende. |
| Tracing / `tracesSampleRate` | **deshabilitar** (`0` / no setear) | No es Sprint 4.2; consume cuota de spans; puede llevar URLs/query. |
| Sentry Logs (`enableLogs`) | **deshabilitar** | El logger local ya existe; duplicar logs sale de la app. |
| Profiling | **deshabilitar** | PAYG en planes pagos. |
| Request capture / HTTP bodies | **deshabilitar** | Bodies de evidence upload son binarios. |
| Headers | **deshabilitar** envío (denylist si algo se filtra) | Cookies/Authorization. |
| Query strings | **deshabilitar** o scrub | Pueden llevar tokens. |
| User identity | **condicionar**: sólo `id` interno, nunca email | `setUser({ email })` se envía aunque `dataCollection.userInfo` sea false si se setea explícito. |
| IP addresses | **deshabilitar** | Default sin `dataCollection` no envía IP; no optar-in. |
| Attachments | **deshabilitar** | Fotos/PDF no salen. |
| Local variables | **deshabilitar** (`includeLocalVariables: false`) | Pueden contener keys y payloads. |
| Source context / context lines | **condicionar** | Source maps sí; no subir contexto si el source tiene secretos. El repo no debe tener secretos. |
| Breadcrumbs (console, clicks, XHR) | **condicionar** | Permitir navegación de rutas; filtrar console que pueda tener PII; no adjuntar bodies de fetch. |
| Seer / AI debugger | **deshabilitar** | Add-on pago; envía contexto de issue a un agente. |

Redacción obligatoria en 4.2b:

- reutilizar las reglas de `src/lib/observability.ts` (mismos regex de secretos);
- `beforeSend` / `beforeBreadcrumb` que dropeen eventos con keys sensibles o bodies;
- no pasar `FormData`, archivos ni evidencias al scope de Sentry.

---

## Privacidad y aprobación IT

Hechos verificados (no es un dictamen legal):

- Los eventos viven en Sentry SaaS (US o EU según org). Metadata de cuentas, tokens e integraciones puede residir en US aunque la org sea EU.
- Retención Developer: 30 días.
- DPA disponible para aceptación electrónica. Instrucciones: `https://www.sentry.help/en/articles/13965008-how-do-i-sign-your-data-processing-addendum`.
- SOC2 / ISO 27001 / data residency aparecen en la matriz de planes. SAML/SCIM son Business. MFA/SSO Google está en la tabla; no se verificó el detalle por plan más allá de la página de pricing.
- Exportación/eliminación: el DPA describe delete durante el término y al expirar; la UI permite borrar issues. No se probó.
- RBAC: 1 usuario en Developer. Acceso de un equipo IT **REQUIERE** plan Team u org compartida con 1 owner.
- Lock-in: medio. El código se puede extraer; el histórico de issues no se migra fácil.

No se inventan requisitos de Finning. `docs/IT_PENDING.md` ya exige ratificar Vercel/Supabase; Sentry es un **tercer** procesador y necesita la misma clase de ratificación.

Decisiones humanas/IT pendientes (bloquean el envío real, no el diseño):

1. ¿Se acepta un SaaS de error tracking?
2. ¿Sentry es el vendor, o se prefiere Rollbar por usuarios ilimitados en Free?
3. Residencia EU vs US al crear la org (irreversible).
4. ¿Se firma el DPA?
5. ¿Quién es el único usuario del plan Developer, o se aprueba Team (USD 26/mes)?
6. ¿STAGING primero, PROD después, con DSNs distintos?

---

## Separación STAGING / PROD

| Ambiente app | Envío | Proyecto Sentry | `environment` | DSN |
| --- | --- | --- | --- | --- |
| DEV local | no, salvo flag explícito | ninguno | `development` | vacío |
| CI | no | ninguno | n/a | vacío |
| Preview Vercel genérico | no | ninguno | n/a | vacío |
| STAGING (`staging` branch) | sí, después de aprobación y smoke | `trazabilidad-staging` | `staging` | DSN staging, sólo Preview de esa branch |
| PROD | sí, sólo después de validar staging | `trazabilidad-prod` | `production` | DSN prod, target Production |

Por qué dos proyectos y no un tag:

- cuotas aisladas (un loop de error en staging no apaga prod);
- alertas y releases no se mezclan;
- se puede demostrar en UI que el issue pertenece al proyecto staging.

Defensa en profundidad: tag `environment` + DSN distinto + kill switch. Un evento de staging no puede aterrizar en prod si el DSN de prod no está en el deployment de staging.

Vercel Preview de PRs no envía. Evita mezclar errores de feature branches con staging.

---

## Integración futura (Sprint 4.2b) — sólo diseño

No implementar ahora.

### Dependencia potencial

- `@sentry/nextjs` (versión actual al momento de 4.2b; hoy 10.70.0).
- No instalar Replay, ni wizard con features extra.

### Archivos probables

| Archivo | Rol |
| --- | --- |
| `src/instrumentation.ts` | `register()` importa server/edge **sólo si** el kill switch y el DSN están activos. `onRequestError` reporta sin bloquear. |
| `sentry.server.config.ts` | `Sentry.init` server. |
| `sentry.edge.config.ts` | `Sentry.init` edge (`src/proxy.ts`). |
| `src/instrumentation-client.ts` | `Sentry.init` browser. |
| `src/app/global-error.tsx` | captura errores del root layout. |
| `src/app/error.tsx` | además del UI actual, reportar `error` (no PII). |
| `next.config.ts` | `withSentryConfig` para source maps; `errorHandler` que **no falle el build** si el upload de maps falla. |
| `src/lib/observability.ts` | `logServerError` puede `captureException` best-effort si tracking está enabled; el log local sigue siendo la fuente operativa. |
| `.env.example` | placeholders vacíos, nunca DSN real. |
| `docs/ENVIRONMENT_VARIABLES.md` | documentar vars **cuando existan**. |

### Variables (futuras, vacías por defecto)

```text
ERROR_TRACKING_ENABLED=false
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_ENVIRONMENT=
SENTRY_RELEASE=          # en Vercel: VERCEL_GIT_COMMIT_SHA
SENTRY_AUTH_TOKEN=       # sólo build, nunca NEXT_PUBLIC_
```

Kill switch: `ERROR_TRACKING_ENABLED` distinto de `true` **o** DSN vacío → no llamar `Sentry.init`. Quitar las env en Vercel apaga el envío sin redeploy de código si el init es condicional; el redeploy es necesario para `NEXT_PUBLIC_*`.

### RequestId

Reutilizar `getRequestLogContext`. Setear tag `requestId` en el scope. No enviar headers crudos.

### Sampling

Errores: `sampleRate: 1.0` (volumen interno bajo; 5k/mes debería alcanzar). Tracing: no. Replay: 0.

### Source maps

Upload en build de Vercel Production y Preview `staging` únicamente, con `SENTRY_AUTH_TOKEN` de scope mínimo. El fallo de upload no debe romper el deploy (`errorHandler` que loguea y continúa).

### Comportamiento si Sentry está caído

El transport oficial **dropea** el evento si no hay conexión. 4.2b debe:

- no `await` de red en el camino de upload/login;
- envolver `captureException` en try/catch;
- no fallar `onRequestError` si el reporte falla;
- la app sigue sirviendo, logueando en JSON local.

---

## Rollout futuro

1. Código mergeado con tracking **off** (DSN vacío).
2. Local sin envío.
3. Aprobación IT + crear org EU + dos proyectos. **No en 4.2a.**
4. Encender FINSA Staging según `docs/ENVIRONMENTS.md`.
5. Setear DSN staging + `ERROR_TRACKING_ENABLED=true` sólo en Preview de `staging`.
6. Error controlado server (ruta de prueba temporal o acción documentada; borrar después).
7. Error controlado client (error boundary).
8. Validar grouping, stack/source maps, release SHA, redacción (el evento no contiene secrets/bodies/emails).
9. Validar que el issue está en el proyecto staging, environment `staging`.
10. Apagar STAGING (Supabase) según runbook. El DSN puede quedarse; no habrá tráfico.
11. Recién entonces considerar DSN de PROD, con el mismo checklist.
12. No dejar páginas `/sentry-example-*` en el árbol.

---

## Rollback / desactivación

Orden, del más barato al más estructural:

1. `ERROR_TRACKING_ENABLED=false` o borrar DSN en Vercel y redeploy.
2. Rotar/revocar DSN y `SENTRY_AUTH_TOKEN` en Sentry.
3. Dejar de llamar `Sentry.init`.
4. Quitar `@sentry/nextjs` y archivos de init.

El logger de 4.1 permanece. La app no depende de Sentry para login, picking ni evidencias.

---

## Riesgos y mitigaciones

| Riesgo | Mitigación |
| --- | --- |
| Wizard enciende Replay/Tracing/PII | 4.2b setup **manual**; features extra off. |
| `dataCollection` permisivo | No pasar el objeto, o optar-out total. |
| DSN de prod en staging | Projects separados; overrides de branch `staging`. |
| 1 usuario en Developer | Documentado; Team requiere costo. |
| Cuota 5k | Sampling 1.0 en errores, 0 en resto; ignore health noise. |
| Source maps auth token en repo | `.gitignore`; sólo env de build. |
| Build roto por upload de maps | `errorHandler` no relanza. |
| Sentry down | fire-and-forget; log local. |
| Lock-in | abstracción mínima vía `logServerError` + kill switch. |
| IT rechaza SaaS | Rollbar como plan B, o 4.2 incompleto hasta vendor interno. |

---

## Preguntas pendientes

- Aprobación de vendor (Sentry vs rechazo vs Rollbar).
- Residencia EU vs US.
- Firma de DPA.
- Dueño de la cuenta Developer.
- Si el único usuario es aceptable para IT.
- Cuándo (si alguna vez) encender PROD.

---

## Aprobación humana requerida

Esta ADR **no autoriza** crear la org, generar DSN, instalar el paquete ni setear variables remotas.

Para 4.2b (código apagado) no hace falta vendor live. Para el primer evento real sí.

---

## Modelo recomendado para Sprint 4.2b

**Grok 4.6 High.**

Justificación: hay que instrumentar tres runtimes (server, client, edge), cablear `onRequestError`, error boundaries, `observability.ts`, source maps y un kill switch, **sin** copiar el wizard (Replay/Tracing/PII). Un default incorrecto filtra evidencias, cookies o bodies a un SaaS. El proveedor no puede convertirse en dependencia de login/upload. Eso es más riesgo de privacidad e infra que de volumen de código; Medium tiende a seguir el wizard.

No iniciar 4.2b en este PR.

---

## Estado de implementación

**No implementado.** Sprint 4.2 sigue incompleto. Sprint 4.3 (Health) no forma parte de esta decisión.
