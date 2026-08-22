# Variables de entorno

Los valores no se versionan. DEV se carga desde `.env.local`/`.env.development.local`; Vercel usa registros separados por target y overrides Preview exclusivos para la branch `staging`.

| Variable | Uso | Exposición |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase para el cliente y servidor. | Pública para el navegador. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública de Supabase para el cliente. | Pública para el navegador; RLS sigue siendo obligatorio. |
| `SUPABASE_SERVICE_ROLE_KEY` | Operaciones de servidor sobre Storage y tareas administrativas. | Secreta; nunca usar con prefijo `NEXT_PUBLIC_`. |
| `EVIDENCE_STORAGE_PROVIDER` | Proveedor de almacenamiento de evidencias. | Sólo servidor. |
| `ERROR_TRACKING_ENABLED` | Kill switch canónico de Sentry; sólo la cadena exacta `true` puede habilitarlo. | Sólo servidor. |
| `SENTRY_DSN` | DSN de Sentry para el servidor. Vacío por defecto. | Secreta operacional; no versionar. |
| `NEXT_PUBLIC_SENTRY_DSN` | DSN público de navegador, congelado en el build. Vacío por defecto. | Pública por diseño, pero nunca versionar un valor real. |
| `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` | Reservadas para una futura unidad de source maps aprobada; no tienen efecto en 4.2b-1. | Sólo build; `SENTRY_AUTH_TOKEN` nunca usa prefijo `NEXT_PUBLIC_`. |
| `SENTRY_RELEASE` | SHA hexadecimal validado para una futura release. | Sólo build/servidor. |

| Scope | Backend esperado | Política |
| --- | --- | --- |
| DEV / Vercel Development | Supabase local (`127.0.0.1:55321`) | Datos sintéticos; reset permitido sólo local. |
| Preview general | Credenciales inertes | Build/UI únicamente; no puede mutar PROD. |
| Preview branch `staging` | `FINSA Staging` (`wbvilfeswdbredgnucjv`) | Overrides branch-specific; smoke on-demand. |
| Production | `FinningCAT` (`jbhbjazagiwyryujnenv`) | Datos reales; smoke no destructivo. |

Para el seed existen dos variables operativas adicionales:

| Variable | Uso |
| --- | --- |
| `ALLOWED_SEED_PROJECT_REFS` | Allowlist CSV. Vacía en DEV; en una ventana remota contiene sólo el ref explícito de staging. |
| `PRODUCTION_SUPABASE_PROJECT_REF` | Ref productivo adicionalmente bloqueado. El ref vigente también está fijado en el guardrail como defensa en profundidad. |

Las variables se administran en Vercel. No actualizar un registro multi-target sin auditar sus targets: primero se separa por ambiente y después se rota. Toda rotación requiere un deployment nuevo para `NEXT_PUBLIC_*`, health check y una carga autorizada de evidencia sólo en DEV/STAGING. Ver `docs/ENVIRONMENTS.md`.

## Error tracking (Sprint 4.2b-1)

La integración técnica queda apagada por defecto: sin DSN, sin flag exacto y fuera de Preview de la branch `staging` no se llama a `Sentry.init`, no se crea transport y no se envían eventos. Local, CI, previews genéricos y Production permanecen bloqueados aunque tengan DSN. `NEXT_PUBLIC_ERROR_TRACKING_ACTIVE` se deriva durante el build de `ERROR_TRACKING_ENABLED`, el target staging y `NEXT_PUBLIC_SENTRY_DSN`; no se administra por separado. Por ello, desactivar cliente exige redeploy.

`SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` y `SENTRY_RELEASE` no activan source maps en 4.2b-1: `next.config.ts` no importa ni ejecuta `withSentryConfig`. Esa integración queda deliberadamente omitida hasta una unidad posterior que pueda demostrar tracing, route metadata y request metadata completamente desactivados. No hay valores remotos, cuenta, DSN ni upload autorizados por este cambio.

