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

## Verificación antes de desplegar

```bash
npm ci
npm run verify
npm run db:start
npm run db:reset
npm run db:lint
npm run test:integration
```

Las migraciones se aplican antes del código. Las versiones `20260815180000` a `20260815210000` son necesarias para usuarios activos, archivado recuperable, transacciones, reportes históricos y miniaturas.

## Logs

No loguear documentos, fotos ni secretos. Los errores de upload van a la consola del server sin el binario.

## Fallo de upload

La UI permite reintentar. Si el archivo quedó en Storage y no en DB, no se muestra: no hay evidencia confirmada. Volver a subir.

## Reconciliar Storage

`npm run storage:reconcile` sólo informa objetos sin fila de evidencia. Revisá la lista y, únicamente si corresponde eliminarlos, ejecutá `npm run storage:reconcile -- --delete`. Programar primero el modo informativo; no automatizar el borrado sin revisar al menos una corrida.

## Backup y restauración

- Confirmar diariamente que existe un backup reciente de Postgres y una copia o política de recuperación de Storage.
- Una vez por mes, restaurar ambos en un proyecto aislado y ejecutar `/api/health`, `npm run smoke` y una descarga de evidencia.
- Registrar fecha, responsable, backup usado y resultado. Un backup sin restauración probada no se considera operativo.

## Despliegue y rollback

1. Guardar el SHA desplegado y la última migración aplicada.
2. Aplicar migraciones en orden y ejecutar health/smoke.
3. Desplegar la aplicación y probar creación → foto → revisión → cierre.
4. Si el smoke falla, volver al SHA anterior. No revertir migraciones destructivamente; desplegar una migración correctiva.

## Usuarios

Cambiar contraseñas locales desde Studio → Authentication. No usar estas claves en un entorno expuesto.
