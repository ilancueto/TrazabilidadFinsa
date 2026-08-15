# Estado de mejoras

## Implementado en el workspace

- Pruebas unitarias separadas de integración y comando `verify`.
- Matriz funcional coherente para Supervisor; Picking no se ofrece a ese rol.
- Alta normal simplificada, sin el módulo descartado de destinos frecuentes ni altas rápidas.
- Usuarios activos/inactivos, exclusión de Picking y reactivación.
- Creación/edición, transiciones, asignación, revisión, uploads y plantillas mediante RPC transaccionales.
- Rechazo de foto con motivo visible y devolución auditada a Picking.
- Reporte diario histórico basado en eventos.
- Fechas y representación horaria de Argentina centralizadas.
- Límites tempranos de upload, validación posterior a HEIC y limpieza de Storage en integración.
- Descarga PDF con concurrencia limitada y valores largos con wrapping.
- Mejoras de foco en diálogos, etiquetas accesibles y objetivos táctiles móviles.
- CI para tipos, lint, unit tests y build.

## Requiere despliegue coordinado

1. Ejecutar y revisar las migraciones `20260815180000` a `20260815200000` en staging.
2. Correr pruebas de integración con Supabase local o staging descartable.
3. Probar los roles ADMIN, PICKING y SUPERVISOR en escritorio y un teléfono real.
4. Aplicar migraciones en producción antes de desplegar este código.

## Siguiente ciclo

- Miniaturas persistidas para listados de fotos.
- Programar externamente la ejecución periódica del reconciliador de Storage (el script ya está disponible en modo seguro).
- Prueba documentada de restauración de backup.
