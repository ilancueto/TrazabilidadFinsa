# Monitoreo — Sprints 4.1 a 4.4

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

## Métricas técnicas — Sprint 4.4

Sprint 4.4 no agrega tablas, migraciones, endpoints, dashboards, proveedores, tracing ni almacenamiento de métricas. El cálculo es offline, reproducible y de costo adicional USD 0. Sentry continúa **DISABLED**.

### Fuentes y semántica

`audit_events` es la única fuente durable de éxitos comprometidos:

- upload OK: `EVIDENCE_UPLOADED`;
- cierre excepcional: `CLOSED` con `metadata.exceptional = true`;
- reapertura: `REOPENED` únicamente. `RETURNED` no es una reapertura.

Los logs JSON son la fuente de fallos de intento de upload, errores `api`/`rpc`/`http`, latencia de API y reintentos. Un upload exitoso no se suma desde el log técnico: así se evita contar dos veces la auditoría y la observabilidad de la misma evidencia.

El perímetro de latencia server-side es exclusivamente: `POST /api/evidence`, `GET /api/evidence/[id]/file`, `GET /api/deliveries/check-number`, `GET /api/deliveries/export-zip`, `GET /admin/deliveries/[id]/report` y `GET /admin/dia/export`. Cada request terminal emite una sola muestra con operación y ruta normalizadas, `durationMs`, `statusCode` y resultado. Los controles de flujo de Next (`redirect`, `permanentRedirect`, `notFound`) se re-lanzan para que Next los procese y no generan error ni muestra técnica. No incluye páginas, Server Actions, `/api/health`, Sentry ni la posterior descarga directa navegador → Storage.

### Percentiles, disponibilidad y reintentos

El agregador usa el equivalente a `percentile_cont`: ordena las duraciones y aplica interpolación lineal. Cada operación devuelve `n` y:

- `NO_DATA` si no hay muestras válidas en `[start, end)` UTC;
- `INSUFFICIENT_SAMPLE` si `1 <= n < 20`; no publica p50 ni p95;
- p50 y p95 solamente con `n >= 20`.

El intervalo es siempre `[start, end)` UTC. La disponibilidad se declara de forma independiente para `logs` y `audit_events`: el valor seguro por defecto es `UNKNOWN`, nunca cero. Con logs `UNKNOWN`, los fallos de intento, reintentos y errores son `null`, y la latencia de cada API queda `UNKNOWN` (no `NO_DATA`). Con auditoría `UNKNOWN`, los éxitos, cierres excepcionales y reaperturas son `null`. Sólo una fuente exportada y consultada correctamente sin eventos permite informar cero o `NO_DATA`. El informe expone `discardedRecords` para líneas NDJSON malformadas o muestras técnicas inválidas sin detener toda la corrida.

Un retry es sólo el intento automático 2 o 3 de `uploadPhotoWithRetry`: máximo tres intentos totales, con esperas de 1 s y 2 s; no existe una espera de 4 s. El cliente incluye `X-Upload-Attempt: 1|2|3` y un identificador aleatorio de operación para correlación de logs. `X-Upload-Attempt` es información atestiguada por el cliente: puede falsificarse y sólo se usa en modalidad best-effort de observabilidad; no es una garantía de seguridad, idempotencia ni una dimensión de métrica. El identificador de operación tampoco se persiste, no se usa como dimensión y no implementa idempotencia. El comportamiento sigue reintentando respuestas HTTP no transitorias, incluidos 400, 401 y 413; se mide, no se altera.

La carga sigue sin idempotencia: si el servidor registra una evidencia y la respuesta se pierde, un retry puede crear una evidencia adicional. Este riesgo queda fuera de Sprint 4.4 y no debe inferirse que un identificador de correlación lo resuelve.

### Privacidad y ejecución offline

Las dimensiones son cerradas: `operation`, `code`, `statusCode` y categoría de error (`api`, `rpc`, `http`). Nunca se agrupa por actor, entrega, request, identificador de operación, nombre, motivo libre, URL, URL firmada, mensaje de error, archivo ni body. Los conteos por categoría/código son dimensiones potencialmente superpuestas, no incidentes únicos. Los errores conservan las reglas de sanitización de Sprint 4.1.

Exportá únicamente los NDJSON de logs y los eventos de auditoría necesarios, combinados en un archivo local. Cada log conserva `timestamp`; cada fila de auditoría conserva `created_at`, `action` y `metadata`. La operación no escribe ni transmite datos:

```bash
npm run metrics:technical -- --input ./technical-metrics.ndjson --start 2026-08-01T00:00:00.000Z --end 2026-08-02T00:00:00.000Z --logs AVAILABLE --audit-events AVAILABLE
```

`--logs` y `--audit-events` son obligatorios e independientes; cada uno acepta `AVAILABLE` o `UNKNOWN`. Por ejemplo, si sólo falta la exportación de logs, usá `--logs UNKNOWN --audit-events AVAILABLE`. La disponibilidad y retención de logs dependen de una exportación válida: stdout no es un historial durable y no se debe interpretar ausencia de logs como ausencia de errores.

Los fallos de la carga JSON son la fuente canónica de errores de upload. Los POST de formulario HTML que terminan en redirect `303` quedan fuera del denominador de fallo hasta que exista una semántica de resultado no ambigua; esta exclusión no cambia su comportamiento funcional.

## Uso

Usar `logServerEvent` para resultados operativos y `logServerError` dentro de `catch`. Ambos construyen JSON estructurado; no agregar `console.error` con objetos o errores crudos en código de servidor.
