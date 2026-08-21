# Modelo de dominio — modalidad y transportista

Semántica de Sprint 2.1. Implementado: migraciones `20260821150000`–`20260821153000`. El valor de enum `ANDREANI` en `delivery_modality` queda huérfano (Postgres no lo elimina limpio); no se escribe ni se filtra.

## Modalidad (tipo de operación)

Valores internos:

| Código | Etiqueta UI | Significado |
| --- | --- | --- |
| `DESPACHO` | Despacho | Sale de bodega con transportista. |
| `CUSTOMER_PICKUP` | Retira cliente | El cliente retira en planta. |

Se conserva `CUSTOMER_PICKUP` (no se renombra a `RETIRA_CLIENTE`). Ya es el identificador en enum, TS, rutas (`/admin/retiros`, `/picking/retiros`) y plantilla. La etiqueta de negocio ya es «Retira cliente».

TS y Zod usan `DESPACHO` | `CUSTOMER_PICKUP`. La UI muestra «Despacho» / «Retira cliente».

## Transportista (`carrier`)

No hay tabla `carriers`. Con un solo transportista real, basta una columna controlada en `deliveries`.

| Código | Etiqueta UI |
| --- | --- |
| `ANDREANI` | Andreani |

Otros transportistas se agregan más adelante al enum `delivery_carrier` (p. ej. `OTRO`), no a la modalidad.

Regla:

| Modalidad | `carrier` |
| --- | --- |
| `DESPACHO` | obligatorio (`ANDREANI` hoy) |
| `CUSTOMER_PICKUP` | `NULL` |

## Plantillas y requisitos

Una plantilla por modalidad (`delivery_templates.modality` único).

- Despacho: incluye `ETIQUETAS` (etapa DISPATCH, etiquetas Andreani). Con un solo carrier, esa foto sigue atada a la plantilla de despacho.
- Retira cliente: no incluye `ETIQUETAS` de Andreani. Sí puede llevar `ETIQUETAS_TECPETROL` / `ETIQUETAS_PLUSPETROL` según cliente.

Cuando exista un segundo transportista de despacho, `ETIQUETAS` (Andreani) deberá depender de `carrier`, no de la modalidad. No se implementa ahora.

Los códigos históricos `ETIQUETAS_ANDREANI` / `ETIQUETA_ANDREANI` son tipos de requisito DISPATCH, no valores de modalidad.

## Qué no cambia

IDs de entregas, evidencias, requisitos, auditoría, timestamps, estados, responsables, observaciones y relaciones. Sólo se reinterpretan `modality` y se rellena `carrier`.
