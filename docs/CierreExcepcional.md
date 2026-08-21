# Cierre excepcional

La opción **Cerrar todas las activas** es una herramienta administrativa de contingencia. No es el cierre normal.

Autoridad: RPC `bulk_close_ready_deliveries`. Regla de cierre normal: `docs/BUSINESS_RULES.md`.

- Sólo `ADMIN`.
- Confirmación exacta `CERRAR TODAS`.
- Motivo de al menos 5 caracteres.
- Cierra **toda** entrega no archivada cuyo estado no sea `CLOSED` (`DRAFT`, `PUBLISHED`, `IN_PICKING`, `READY`).
- No exige evidencias completas ni observación resuelta.
- Cada cierre queda en auditoría `CLOSED` con `exceptional`, `bulk`, `forced`, `bypassedStatusRules`, `bypassedPendingRequirements`, `bypassedOpenObservations`, el motivo y el estado anterior.

No debe utilizarse para reemplazar la revisión operativa normal. El cierre de `/admin/revision` (marcadas listas) sigue la regla normal, entrega por entrega.
