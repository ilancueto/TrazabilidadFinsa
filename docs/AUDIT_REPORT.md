# Auditoría del repositorio

## Rutas y Server Actions

Revisado el árbol `src/app`: concentra las superficies de administración, picking, cuenta, manual, tablero y APIs de health, evidencias, exportación y reportes. Las rutas protegidas delegan la autenticación/autorización a layouts, Server Components o handlers según la superficie.

Las mutaciones del dominio están centralizadas en `src/lib/actions`: entregas, evidencias, catálogos, clientes, usuarios y autenticación. Las operaciones críticas pasan a RPCs transaccionales; la auditoría de permisos, RLS y RPCs se realiza en cortes posteriores.

Alcance pendiente de este informe: APIs en detalle, cálculo de progreso, evidencias, exportaciones, consultas, RPCs, RLS, migraciones, índices y constraints, y actualización de pruebas.

## Permisos y estados

`getSessionUser` exige un usuario autenticado con perfil `active`; `requireSession` también desvía a cambio de clave cuando corresponde. Las decisiones de dominio se concentran en `src/lib/deliveries/permissions.ts`: ADMIN opera administración, cierres y catálogo; PICKING sólo puede trabajar entregas activas y tomar/liberar las asignadas según la regla; SUPERVISOR conserva acceso de consulta/reportes.

La máquina `src/lib/deliveries/state.ts` permite `DRAFT → PUBLISHED`, `PUBLISHED → IN_PICKING`, `IN_PICKING → READY`, `READY → CLOSED` y las devoluciones administrativas `READY/CLOSED → IN_PICKING`; las acciones de entrega auditadas validan rol, estado y, cuando aplica, la precondición de progreso antes de invocar las RPCs transaccionales. Las pruebas unitarias cubren las transiciones y denegaciones principales.

## Progreso y cierre

`computeProgress` toma sólo requisitos aplicables y separa las etapas `FLOOR` y `DISPATCH`. Una evidencia activa —no anulada ni rechazada— satisface el requisito; los requisitos obligatorios de piso bloquean `READY`, mientras que los de despacho bloquean únicamente el cierre. La misma función alimenta las consultas, acciones de marcar lista/cerrar y la interfaz de picking, con pruebas para requisitos no aplicables, evidencia activa y etiquetas de despacho.

## Evidencias

La carga requiere sesión activa, valida tamaño máximo de 8 MiB, requisito aplicable, estado permitido y contenido de imagen antes de almacenar. Registra checksum y metadatos mediante `register_evidence_v2`; si el registro falla, intenta compensar el objeto subido. Las evidencias anuladas se marcan primero en base y luego se mueven a `voided/`; la revisión está limitada a ADMIN y la descarga exige autenticación, rechaza IDs inválidos y no entrega evidencias anuladas. Hay pruebas de MIME, rutas de almacenamiento y persistencia contra Supabase local; esta última no forma parte de la suite unitaria estándar.

## Hallazgos de cierre

- No se detectaron `TODO`, `FIXME`, `@ts-ignore` ni casts `as any` en el alcance revisado.
- El snapshot productivo y el inventario de Storage permiten continuar la auditoría de seguridad sin depender de producción.
- La divergencia de migraciones y la falta de PITR se registran como riesgos HIGH.

