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

## Uso

Usar `logServerEvent` para resultados operativos y `logServerError` dentro de `catch`. Ambos construyen JSON estructurado; no agregar `console.error` con objetos o errores crudos en código de servidor.
