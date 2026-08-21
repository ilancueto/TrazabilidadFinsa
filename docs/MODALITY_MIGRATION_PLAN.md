# Plan de migración — ANDREANI como modalidad → DESPACHO + transportista

Implementado en `20260821150000` (ADD VALUE DESPACHO), `20260821151000` (enum/columna carrier), `20260821152000` (`save_delivery` + trigger), `20260821153000` (backfill + check). El valor `ANDREANI` permanece en `delivery_modality` como legado de Postgres; no hay filas ni escrituras nuevas.

## 1. Estado actual

Tipo Postgres `public.delivery_modality` = `('ANDREANI', 'CUSTOMER_PICKUP')`. Columna `deliveries.modality` `NOT NULL`, índice `deliveries_modality_idx`. Sin default.

También usan el enum:

- `delivery_templates.modality` (unique: una plantilla por valor);
- `destination_presets.modality` (tabla sin filas y sin lecturas en `src/`).

Producción (`jbhbjazagiwyryujnenv`, lectura 2026-08-21):

| modality | filas | `deleted_at` null |
| --- | ---: | ---: |
| `ANDREANI` | 63 | 61 |
| `CUSTOMER_PICKUP` | 11 | 11 |

Plantillas: `ANDREANI` / «Despacho Andreani»; `CUSTOMER_PICKUP` / «Retira cliente».

TS: `DELIVERY_MODALITIES = ["ANDREANI", "CUSTOMER_PICKUP"]`. Zod: `z.enum(DELIVERY_MODALITIES)`.

La única RPC que **recibe** modalidad es `save_delivery` (`p_modality`). Las demás no filtran ni ramifican por ella. `duplicateDeliveryAction` reenvía `detail.modality`. `enforce_delivery_update` trata `modality` como dato maestro (PICKING no lo cambia).

`dashboard_kpis` / `day_report` no usan modalidad. El Excel y el PDF muestran `MODALITY_LABEL[modality]` («Despacho» / «Retira cliente»). El ZIP no incluye modalidad.

## 2. Inventario de `ANDREANI`

| Dónde | Uso | Capa | Significado |
| --- | --- | --- | --- |
| enum DB / `types.ts` / Zod | valor de modalidad | persistencia / API | Deuda: es despacho, no carrier |
| `MODALITY_LABEL` | `"Despacho"` | UI / reporte | A — tipo de operación |
| `delivery-form` default y plantilla inicial | `"ANDREANI"` | UI | A — alta en despacho |
| `/admin` (no `section=CUSTOMER_PICKUP`) | filtro `modality: ANDREANI` | UI / query | A — inbox despacho |
| `/picking` | id. | UI / query | A |
| `/admin/retiros`, `/picking/retiros` | `CUSTOMER_PICKUP` | UI / query | A — inbox retira |
| `TEMPLATE_SPECS.ANDREANI` + seed + migración de etapas | incluye `ETIQUETAS` | dominio / persistencia | B — etiquetas del carrier Andreani |
| plantilla DB `code=ANDREANI` | catálogo | persistencia | D + B |
| `REQUIREMENT_LABEL.ETIQUETAS` | «Etiquetas Andreani» | UI | B / C |
| `stages.ts` `ETIQUETAS_ANDREANI`, `ETIQUETA_ANDREANI` | códigos DISPATCH legado | dominio | B — tipo de foto, no modalidad |
| `save_delivery` / duplicate | copia `p_modality` | API/RPC | A/D — persistir el enum |
| seed, smoke, tests unitarios | fixture `"ANDREANI"` | test | D |
| `queries.ts` `empty.ANDREANI` | mapa de plantillas | API | D |
| `day_report` `t.code not in ('ETIQUETA_ANDREANI', …)` | lead time | reporte | B — código de tipo, no tocar en 2.1 |

No hay `if (modality === "ANDREANI")` de reglas de estado, evidencias FLOOR/DISPATCH, cierre ni permisos. El ramal de negocio real es la plantilla (con/sin `ETIQUETAS`) y el filtro de inbox.

## 3. Significado

Casi todos los usos de modalidad `ANDREANI` son **despacho** (A o C). El único uso **de transportista** (B) es exigir `ETIQUETAS` en esa plantilla. Hoy hay un solo carrier de despacho, así que plantilla DESPACHO + `ETIQUETAS` sigue siendo correcto. Un segundo carrier exigirá mover esa foto a `carrier`, en una unidad posterior.

## 4–6. Destino

Ver `docs/DOMAIN_MODEL.md`. Resumen: `modality ∈ {DESPACHO, CUSTOMER_PICKUP}`, `carrier` enum/`NULL`, sin tabla `carriers`, `CUSTOMER_PICKUP` se queda.

## 7. Histórico

`UPDATE` in-place, mismos IDs:

```text
modality = ANDREANI  →  modality = DESPACHO, carrier = ANDREANI
modality = CUSTOMER_PICKUP  →  sin cambio de modality, carrier NULL
```

No recrear entregas, evidencias, requisitos ni `audit_events`. Precheck: `modality` sólo en `{ANDREANI, CUSTOMER_PICKUP}`; abortar si aparece otro valor.

## 8. RPCs

| RPC | Cambio |
| --- | --- |
| `save_delivery` (firma actual, 14 args + defaults) | Añadir `p_carrier public.delivery_carrier default null`. Mapear `p_modality = ANDREANI` → `DESPACHO` + `carrier = ANDREANI`. Insert/update de `carrier`. Si `DESPACHO`, exigir carrier; si `CUSTOMER_PICKUP`, forzar `NULL`. |
| sobrecarga vieja de 12 args | No usarla para writes nuevos. Dejarla o mapear igual si aún existe. |
| `transition_delivery`, `record_observation`, `void_evidence`, `review_evidence`, `register_evidence(_v2)`, `assign_delivery`, `bulk_*`, `day_report`, `dashboard_kpis` | Sin cambio de firma. |

`enforce_delivery_update`: PICKING tampoco puede cambiar `carrier`.

## 9. Código / reportes (implementación posterior)

TS/Zod: `DESPACHO` + `DeliveryCarrier`. UI: etiqueta modalidad «Despacho» / «Retira cliente»; mostrar transportista sólo en despacho. Inboxes: filtrar `DESPACHO` en vez de `ANDREANI`. PDF: fila modalidad + fila transportista si aplica. Excel: columnas Modalidad y Transportista. Plantilla: `code`/`label`/`modality` de despacho. Tests y seed. No tocar códigos `ETIQUETA_ANDREANI` en `day_report` en esta migración.

## 10. SQL propuesto (no aplicar)

Orden en **una** migración, sin dejar filas inválidas:

1. Precheck: `select distinct modality from deliveries` ⊆ `{ANDREANI, CUSTOMER_PICKUP}`. Si no, `raise`.
2. `create type public.delivery_carrier as enum ('ANDREANI');`
3. `alter table public.deliveries add column carrier public.delivery_carrier;`
4. `alter type public.delivery_modality add value if not exists 'DESPACHO';` (Postgres 17 permite usarlo en el mismo script a continuación; si el entorno lo impide, partir en dos archivos).
5. Backfill:

```sql
update public.deliveries
set carrier = 'ANDREANI', modality = 'DESPACHO'
where modality = 'ANDREANI';

update public.delivery_templates
set code = 'DESPACHO', label = 'Despacho', modality = 'DESPACHO'
where modality = 'ANDREANI';
```

6. `alter table public.deliveries add constraint deliveries_carrier_by_modality check ( (modality = 'DESPACHO' and carrier is not null) or (modality = 'CUSTOMER_PICKUP' and carrier is null) );`
7. Assertions: cero filas `modality = 'ANDREANI'`; todo `DESPACHO` con `carrier = 'ANDREANI'`; todo `CUSTOMER_PICKUP` con `carrier is null`.
8. Reescribir `save_delivery` (firma vigente) con `p_carrier` y el mapeo de compatibilidad.
9. Ampliar `enforce_delivery_update` con `carrier`.

No borrar el valor de enum `ANDREANI` (Postgres no lo quita limpio). Queda sin filas; la RPC no lo persiste. `destination_presets` (0 filas): misma columna/check si se toca; si no, dejarla y documentar.

Índice extra de `carrier`: opcional, no hace falta para el corte.

## 11. Rollback

**Antes de producción:** revertir el PR de implementación / no aplicar la migración.

**Después del backfill:** reversible para el único carrier actual:

```sql
-- quitar check
update public.deliveries
set modality = 'ANDREANI', carrier = null
where modality = 'DESPACHO' and carrier = 'ANDREANI';
update public.delivery_templates
set code = 'ANDREANI', label = 'Despacho Andreani', modality = 'ANDREANI'
where modality = 'DESPACHO';
-- restaurar save_delivery / trigger
alter table public.deliveries drop column carrier;
```

El valor de enum `DESPACHO` quedaría huérfano (mismo límite que `ANDREANI` huérfano hacia adelante). No hay pérdida de IDs. Si en el futuro existiera `carrier = OTRO`, este rollback **no** sabría a qué modalidad histórica volver: hay que bloquear rollback ciego en ese momento.

## 12. Pruebas (unidad de implementación)

Integración:

- backfill: 63 (prod) / seeds ANDREANI → `DESPACHO` + `ANDREANI`; CUSTOMER_PICKUP intacta y `carrier` null;
- `save_delivery` DESPACHO con carrier; CUSTOMER_PICKUP sin carrier;
- `save_delivery` aún acepta `p_modality = ANDREANI` y persiste DESPACHO+ANDREANI;
- check: DESPACHO sin carrier falla; CUSTOMER_PICKUP con carrier falla;
- `transition_delivery` / evidencias / auditoría sobre una entrega backfilledeada.

Regresión: READY/CLOSED, PDF/Excel etiquetas, inboxes despacho vs retira, plantillas, duplicate.

E2E (más adelante): un flujo despacho y uno retira.

## 13. Riesgos

- Desplegar la migración **antes** de que la RPC mapee `ANDREANI` rompería altas viejas si el check ya no admite ese enum en la columna. La RPC de compatibilidad debe ir **en la misma migración**.
- El cliente TS viejo seguiría enviando `ANDREANI` hasta el PR de código: cubierto por el mapeo.
- `ADD VALUE` + uso inmediato: validar en `db reset` local.
- No mezclar esta migración con RLS, modalidad de reportes históricos de códigos `ETIQUETA_ANDREANI`, ni Sprint 2.4.

Implementación siguiente: migración versionada + RPC (sin UI) o el mismo PR con TS/UI si se mantiene acotado. No aplicar a producción hasta reset local, integración y Preview verdes.
