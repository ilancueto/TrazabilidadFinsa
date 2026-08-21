# Auditoría del repositorio

## Rutas y Server Actions

Revisado el árbol `src/app`: concentra las superficies de administración, picking, cuenta, manual, tablero y APIs de health, evidencias, exportación y reportes. Las rutas protegidas delegan la autenticación/autorización a layouts, Server Components o handlers según la superficie.

Las mutaciones del dominio están centralizadas en `src/lib/actions`: entregas, evidencias, catálogos, clientes, usuarios y autenticación. Las operaciones críticas pasan a RPCs transaccionales; la auditoría de permisos, RLS y RPCs se realiza en cortes posteriores.

Alcance pendiente de este informe: APIs en detalle, permisos, estados, evidencias, exportaciones, PWA, consultas, RLS, migraciones y dependencias.

