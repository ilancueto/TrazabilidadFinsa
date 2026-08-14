# Runbook local

## Supabase no arranca

1. Abrir Docker Desktop y esperar a que esté healthy.
2. `npx supabase stop --no-backup` y `npx supabase start`.
3. Si el puerto 54321 está ocupado, cerrar otro stack local.

## Reset limpio

```bash
npx supabase db reset
npm run db:seed
```

## Health

`GET /api/health` debe devolver `{ ok: true }`.

## Logs

No loguear documentos, fotos ni secretos. Los errores de upload van a la consola del server sin el binario.

## Fallo de upload

La UI permite reintentar. Si el archivo quedó en Storage y no en DB, no se muestra: no hay evidencia confirmada. Volver a subir.

## Usuarios

Cambiar contraseñas locales desde Studio → Authentication. No usar estas claves en un entorno expuesto.
