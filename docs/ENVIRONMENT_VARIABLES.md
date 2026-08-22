# Variables de entorno

Los valores no se versionan. DEV se carga desde `.env.local`/`.env.development.local`; Vercel usa registros separados por target y overrides Preview exclusivos para la branch `staging`.

| Variable | Uso | Exposición |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase para el cliente y servidor. | Pública para el navegador. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública de Supabase para el cliente. | Pública para el navegador; RLS sigue siendo obligatorio. |
| `SUPABASE_SERVICE_ROLE_KEY` | Operaciones de servidor sobre Storage y tareas administrativas. | Secreta; nunca usar con prefijo `NEXT_PUBLIC_`. |
| `EVIDENCE_STORAGE_PROVIDER` | Proveedor de almacenamiento de evidencias. | Sólo servidor. |

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

