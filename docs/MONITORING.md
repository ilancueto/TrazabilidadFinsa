# Monitoreo — Sprint 4.1

Sprint 4.1 define el contrato local de logging estructurado del servidor. No incorpora un proveedor externo de error tracking, métricas ni tracing distribuido.

## Contrato de log

Cada evento se emite como una única línea JSON. Los campos base son:

- `timestamp`: fecha ISO-8601 UTC de emisión.
- `level`: `debug`, `info`, `warn` o `error`.
- `environment`: `VERCEL_ENV`, `NODE_ENV` o `development`.
- `code`: código estable del evento o error, por ejemplo `evidence.upload_failed`.
- `message`: descripción segura para diagnóstico.

Cuando aplican, se incluyen `requestId`, `operationId`, `route`, `action`, `operation`, `actorId`, `deliveryId`, `durationMs`, `result` (`success` o `failure`) y `metadata`. Los errores conocidos se reducen a `error.name`, `error.message` y, si existe, `error.code`; nunca se incluye el stack ni la causa completa.

Ejemplo seguro:

```json
{"timestamp":"2026-08-22T12:00:00.000Z","level":"info","environment":"production","code":"evidence.upload_completed","message":"Evidence upload completed","requestId":"incoming-123","route":"/api/evidence","operation":"evidence.upload","deliveryId":"delivery-123","durationMs":184,"result":"success","metadata":{"mimeType":"image/jpeg","sizeBytes":1234}}
```

## Correlación

Los Route Handlers y Proxy construyen su contexto con `getRequestLogContext(request)`. Se reutiliza `x-request-id` sólo si contiene entre 8 y 128 caracteres seguros (`A-Z`, `a-z`, números, `.`, `_`, `:`, `-`); en cualquier otro caso se crea un `req_…` nuevo. Para ejecuciones que no provienen de HTTP se puede usar `createOperationId()` y registrar `operationId`.

## Redacción y límites

Antes de serializar, el logger:

- Redacta valores de passwords, tokens de acceso o refresh, Authorization, cookies, API keys, service-role keys, secrets y credenciales, incluso dentro de objetos anidados.
- Omite imágenes, fotos, archivos, evidencias, payloads y cuerpos; no serializa binarios.
- Trata objetos de clase, funciones, símbolos, `bigint` y valores no finitos como no serializables.
- Limita profundidad, colecciones y textos, y elimina secretos con formato `clave=valor` o `Bearer valor` de los mensajes de error.

No se deben pasar al logger request bodies, FormData completos, headers completos, cookies, URLs firmadas, claves de Supabase, secretos, buffers ni contenido de evidencias. La metadata debe ser mínima y operativa, por ejemplo IDs ya autorizados, MIME type, tamaño o estado.

## Error tracking

Sprint 4.2b-1 incorpora `@sentry/nextjs@10.70.0` como preparación técnica, pero permanece **OFF por defecto**: no hay cuenta, DSN, evento, source-map upload, cambio en Vercel/Supabase ni costo. La decisión de herramienta, política de datos, separación STAGING/PROD y aprobación humana sigue en `docs/ADR_ERROR_TRACKING.md`.

El gate de servidor exige en simultáneo `ERROR_TRACKING_ENABLED === "true"`, DSN server no vacío, `CI !== "true"`, `VERCEL_ENV === "preview"` y `VERCEL_GIT_COMMIT_REF === "staging"`. El cliente sólo puede inicializar con la constante derivada en build `NEXT_PUBLIC_ERROR_TRACKING_ACTIVE === "true"` y DSN público no vacío. Production está bloqueado en código.

La API instalada no expone `autoSessionTracking` en 10.70.0. No se inventó un reemplazo: se usan las opciones reales `defaultIntegrations: false` e `integrations: []`, que impiden instalar las integraciones por defecto del SDK (incluidas `RequestData`, `LocalVariablesAsync`, `Breadcrumbs`, HTTP/tracing y sesiones). Además se desactivan tracing, profiling, replay, logs, client reports, hooks ESM y setup OpenTelemetry. `beforeSend` reconstruye cada evento desde una allowlist y elimina request, user, breadcrumbs, extra, contexts, variables locales, queries, fragmentos y datos no previstos.

Los source maps quedan explícitamente fuera de 4.2b-1. La implementación real de `withSentryConfig` en `@sentry/nextjs@10.70.0` añade `experimental.clientTraceMetadata` con `baggage` y `sentry-trace`, además de tocar la configuración de build. No existe una opción documentada del wrapper para evitar esa mutación; por eso `next.config.ts` no lo importa ni lo ejecuta, incluso con placeholders completos de staging. Una futura unidad deberá reevaluar el SDK y demostrar que no habilita tracing, route metadata ni request metadata antes de autorizar uploads.

Los errores manejados primero emiten el JSON local de Sprint 4.1 y después intentan una captura fire-and-forget aislada. Los no manejados pasan por un adaptador propio de `onRequestError`, que sólo extrae ruta sin query, método, tipo de ruta, digest y `x-request-id` previamente validado; no entrega headers completos, cookies ni el objeto request. Un fallo de inicialización, captura o transporte no cambia login, uploads, actions o renderizado.

## Health Check — Sprint 4.3

`GET /api/health` es público, read-only y no requiere autenticación. La ejecución del Route Handler confirma el proceso web; además verifica en paralelo una consulta mínima a `requirement_types` (Supabase/PostgREST/DB), `GET /auth/v1/health` de Supabase Auth y acceso server-side de sólo lectura al bucket privado `evidences` de Storage.

Responde `200` únicamente si las tres dependencias están `reachable`; cualquier configuración requerida ausente, error, status Auth no-2xx o timeout devuelve `503`. El payload público sólo incluye `ok`, los estados binarios `database`/`auth`/`storage`, servicio, región, `databaseLatencyMs` y hora. No contiene errores, cuerpos del proveedor, URLs, refs de proyecto, claves, metadata del bucket ni datos de negocio.

Cada check queda limitado a 5 s y la respuesta siempre incluye `Cache-Control: no-store, no-cache, must-revalidate`. PostgREST y Auth reciben cancelación real mediante `AbortSignal`; la versión instalada de `storage-js` no expone `AbortSignal` por operación, por lo que el request público se acota a 5 s mientras su lectura no mutante termina en segundo plano.

No se emite un log en el camino healthy. Un fallo registra sólo `health.check_failed`, el contexto de request existente, duración y una dependencia controlada; nunca URL, keys, body o stack en la respuesta. Este endpoint no comprueba uploads/downloads binarios, métricas, dashboards, alertas, tracing ni Sentry. Sentry sigue fail-open y **DISABLED**; no se hizo ninguna mutación de infraestructura ni se incurre en costo adicional (USD 0).

## Uso

Usar `logServerEvent` para resultados operativos y `logServerError` dentro de `catch`. Ambos construyen JSON estructurado; no agregar `console.error` con objetos o errores crudos en código de servidor.
