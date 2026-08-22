# Ambientes — FINSA Trazabilidad

## TEMPORARY ZERO-COST STAGING STRATEGY

> FINSA Staging utiliza temporalmente una estrategia zero-cost on-demand. El proyecto Supabase de staging permanece pausado fuera de las ventanas de validación y comparte el segundo slot Free mediante rotación temporal con `ilara-app`. `FinningCAT` productivo nunca se pausa. Esta estrategia debe revisarse si el sistema pasa a operación comercial/corporativa o dispone de presupuesto para staging permanente.

No es la arquitectura corporativa definitiva. Su costo mensual adicional confirmado es **USD 0** y no habilita planes Pro, Custom Environments, branching pago, compute pago, add-ons ni trials facturables.

## Inventario

| Entorno | Aplicación | Backend | Datos | Reset |
| --- | --- | --- | --- | --- |
| DEV | Next.js local | Supabase local (`127.0.0.1:55321`) | Sintéticos | Permitido sólo con `supabase db reset --local` / `npm run db:reset`. |
| CI | GitHub Actions | Supabase local efímero | Sintéticos | El job destruye el stack al terminar. |
| STAGING | Vercel Preview, branch permanente `staging` | `FINSA Staging` (`wbvilfeswdbredgnucjv`, `sa-east-1`) | Sintéticos | No usar `db reset`; se puede recrear mediante este runbook. |
| PROD | Vercel Production | `FinningCAT` (`jbhbjazagiwyryujnenv`, `sa-east-1`) | Reales | **Nunca** resetear ni pausar. |

`FINSA Staging` tiene DB, Auth y Storage independientes. Su esquema surge exclusivamente de `supabase/migrations/`; no contiene dumps, usuarios ni evidencias de producción.

## Estado normal y rotación Free

```text
FinningCAT    ACTIVE_HEALTHY
ilara-app     ACTIVE_HEALTHY
FINSA Staging INACTIVE/PAUSED
```

Durante una ventana de staging:

```text
FinningCAT    ACTIVE_HEALTHY
ilara-app     INACTIVE/PAUSED
FINSA Staging ACTIVE_HEALTHY
```

La pausa de `ilara-app` produce una ventana temporal sin backend para Ilara. No se permite borrar el proyecto, cambiar sus datos/esquema ni migrarlo.

## Guardrail de target remoto

Antes de cualquier operación remota se deben registrar los tres datos siguientes:

```text
Proyecto: FINSA Staging
Project ref: wbvilfeswdbredgnucjv
Entorno: STAGING
```

No ejecutar una mutación basándose sólo en el proyecto linkeado. `FinningCAT` tiene ref `jbhbjazagiwyryujnenv` y está expresamente bloqueado por `scripts/seed-guard.ts`.

El seed remoto requiere:

```text
NEXT_PUBLIC_SUPABASE_URL=https://wbvilfeswdbredgnucjv.supabase.co
ALLOWED_SEED_PROJECT_REFS=wbvilfeswdbredgnucjv
PRODUCTION_SUPABASE_PROJECT_REF=jbhbjazagiwyryujnenv
```

Las claves se inyectan desde el gestor de secretos; nunca se imprimen ni versionan. Localhost siempre está permitido. Cualquier otro host, ref no allowlisted, HTTP remoto o ref productivo aborta antes de crear el cliente Supabase.

## Encender FINSA Staging (ON)

1. Confirmar que la organización continúa en plan Free y que el costo calculado es USD 0.
2. Verificar `/api/health` y `FinningCAT / jbhbjazagiwyryujnenv / ACTIVE_HEALTHY`.
3. Avisar que Ilara tendrá una ventana temporal sin backend.
4. Verificar `ilara-app / qbbnvdmadgomfmrsfxlo / ACTIVE_HEALTHY` y pausarlo.
5. Esperar el estado `INACTIVE` antes de continuar.
6. Restaurar `FINSA Staging / wbvilfeswdbredgnucjv`; esperar `ACTIVE_HEALTHY`.
7. Volver a comprobar que `FinningCAT` sigue saludable.
8. Verificar que los overrides Preview de la branch `staging` existen para las cuatro variables requeridas.
9. Comparar el historial remoto de migraciones con los nombres/versiones de `supabase/migrations/`.
10. Aplicar sólo las migraciones pendientes, en orden, desde Git. No usar `migration repair` salvo discrepancia entendida y documentada.
11. Ejecutar el seed sintético con allowlist explícita cuando corresponda.
12. Actualizar la branch `staging`, esperar el deployment Preview `READY` y ejecutar el smoke remoto dedicado.

Si una pantalla o API informa costo, upgrade, tarjeta, compute pago o add-on, detenerse antes de aceptar.

## Apagar FINSA Staging (OFF)

1. Finalizar las pruebas y registrar deployment, SHA y resultado del smoke.
2. Verificar que el target sea `FINSA Staging / wbvilfeswdbredgnucjv / STAGING`.
3. Pausar `FINSA Staging` y esperar `INACTIVE`.
4. Restaurar `ilara-app / qbbnvdmadgomfmrsfxlo` y esperar `ACTIVE_HEALTHY`.
5. Confirmar nuevamente `FinningCAT / jbhbjazagiwyryujnenv / ACTIVE_HEALTHY` y `/api/health`.
6. Confirmar el estado normal de los tres proyectos.

No dejar una rotación a medias. Si falla la restauración de Ilara, conservar producción activa, no reactivar staging y escalar el incidente hasta recuperar `ilara-app`.

## Vercel Hobby y política Preview

Se reutiliza el proyecto Vercel `finningcat`; no existe otro proyecto ni Custom Environment pago.

- `main` → Production → `FinningCAT`.
- `staging` → Preview branch-specific → `FINSA Staging`.
- cualquier otra branch/PR → Preview con URL y claves inertes; sirve como señal de build/UI y no puede mutar PROD.
- CI funcional sigue en Supabase local efímero; staging remoto no se comparte con cada PR.

Las variables `NEXT_PUBLIC_*` quedan fijadas en build time por Next.js, por lo que cada cambio de target requiere un deployment nuevo. Las variables secretas son server-only.

## Smoke remoto on-demand

El smoke remoto no forma parte de CI. Requiere staging activo, deployment Preview de la branch `staging` y opt-in doble:

```powershell
$env:STAGING_SMOKE = '1'
$env:STAGING_BASE_URL = 'https://<preview-staging>'
$env:STAGING_SUPABASE_PROJECT_REF = 'wbvilfeswdbredgnucjv'
$env:ALLOWED_STAGING_PROJECT_REFS = 'wbvilfeswdbredgnucjv'
npm run smoke:staging
```

`playwright.staging.config.ts` ejecuta sólo los flujos críticos DESPACHO y CUSTOMER_PICKUP. El segundo valida en UI el transportista vacío (`carrier = NULL`). El config rechaza PROD y cualquier ref no allowlisted. Los E2E normales conservan su guardrail local.

## Promoción a PROD

```text
feature branch
→ PR a main
→ quality + integration + e2e + dependency-security + CodeQL + Secret scan
→ merge main (Vercel auto-deploya producción)
→ validación STAGING cuando corresponda, antes del merge/release coordinado
→ review de migraciones PROD + backup/rollback
→ deployment PROD
→ smoke no destructivo: /api/health, /login y estado READY/SUCCESS
```

Vercel auto-deploya `main`; no existe un gate manual real. Por eso los cambios de DB/aplicación deben diseñarse como `EXPAND → COMPATIBLE APP → MIGRATE/BACKFILL → CONTRACT`, en PRs/deployments compatibles con la versión todavía activa. Nunca desplegar una app que requiera un schema aún inexistente.

## Rollback

- **APP:** reasignar producción al deployment/SHA anterior mediante Vercel rollback; verificar health y login.
- **DB:** decidir por migración entre rollback SQL explícito, forward fix o restore. Evaluar reversibilidad antes de aplicar; no existe rollback universal.
- **STAGING:** puede pausarse y recrearse porque contiene sólo datos sintéticos.
- **PROD:** nunca `db reset`. Un restore requiere el procedimiento de backup y una decisión de incidente.

Referencias: `docs/BACKUP.md`, `docs/ENVIRONMENT_VARIABLES.md`, `docs/TESTING.md` y `docs/SECURITY_MODEL.md`.
