# Variables de entorno

Las siguientes variables deben configurarse en `development`, `preview` y `production`. Sus valores no se versionan.

| Variable | Uso | Exposición |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase para el cliente y servidor. | Pública para el navegador. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública de Supabase para el cliente. | Pública para el navegador; RLS sigue siendo obligatorio. |
| `SUPABASE_SERVICE_ROLE_KEY` | Operaciones de servidor sobre Storage y tareas administrativas. | Secreta; nunca usar con prefijo `NEXT_PUBLIC_`. |
| `EVIDENCE_STORAGE_PROVIDER` | Proveedor de almacenamiento de evidencias. | Sólo servidor. |

Las variables se administran en Vercel. Cualquier rotación debe actualizar todos los entornos y verificarse con build, health check y una carga autorizada de evidencia.

