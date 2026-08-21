# Storage

## Producción

| Bucket | Público | Límite | MIME permitidos |
| --- | --- | --- | --- |
| `evidences` | No | 8 MiB | `image/jpeg`, `image/png`, `image/webp` |

No hay policies en el esquema `storage`. El navegador no accede directamente al bucket: las cargas y descargas autorizadas pasan por el servidor, que valida sesión y permisos antes de usar el cliente de Storage con service role.

