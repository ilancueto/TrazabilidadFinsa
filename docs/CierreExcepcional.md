# Cierre excepcional

La opción **Cerrar todas las listas** es una herramienta administrativa de contingencia.

- Sólo está disponible para usuarios `ADMIN`.
- Sólo considera entregas en estado `READY`.
- Omite entregas con observaciones abiertas.
- Omite entregas con requisitos obligatorios pendientes.
- Exige un motivo de al menos 5 caracteres.
- Exige escribir exactamente `CERRAR TODAS`.
- Cada entrega cerrada genera auditoría `CLOSED` con `exceptional: true`, `bulk: true` y el motivo indicado.

No debe utilizarse para reemplazar la revisión operativa normal ni para saltear evidencias pendientes.
