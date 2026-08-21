# Reconciliación del historial de migraciones (1.1)

Causa: **mismas migraciones, timestamps distintos**. Las cuatro versiones remotas sin archivo coinciden por `name` con cuatro archivos locales que se habían commiteado con timestamps redondeados. No hay DDL productivo fuera de Git. No se usó `migration repair` ni se tocó producción.

## Mapping remoto ↔ local

| Remota | Nombre remoto | Archivo git (antes → ahora) | SQL | Resultado |
| --- | --- | --- | --- | --- |
| `20260820223232` | `allow_dispatch_uploads_in_ready` | `20260820223500_…` → `20260820223232_allow_dispatch_uploads_in_ready.sql` | `register_evidence` + `GRANT EXECUTE` a `authenticated`. El archivo git trae dos comentarios de cabecera que el remoto no guardó. | EQUIVALENTE |
| `20260820224306` | `admin_bulk_close_ready` | `20260820200000_…` → `20260820224306_admin_bulk_close_ready.sql` | `bulk_close_ready_deliveries` inicial (sólo `READY`, omite observación abierta y `status <> COMPLETE`). Whitespace distinto en `jsonb_build_object` / `SET`. | EQUIVALENTE |
| `20260820225315` | `fix_bulk_close_eligibility` | `20260820205500_…` → `20260820225315_fix_bulk_close_eligibility.sql` | Elegibilidad por evidencia activa no rechazada. | EXACTA |
| `20260820230305` | `force_close_all_active_deliveries` | `20260820212000_…` → `20260820230305_force_close_all_active_deliveries.sql` | Cierre forzado de no `CLOSED`. Whitespace distinto en `SET` / `WHERE`. | EQUIVALENTE |

`created_by` remoto: `ilaancueto@gmail.com`. Las versiones UTC caen ~2 min antes de los commits git (`b5301a7`, `82f4ba2`, `e820645`, `9758229`). Orden de aplicación productivo: despacho → cierre inicial → elegibilidad → cierre forzado. El nombre redondeado `20260820223500` dejaba el despacho *después* de los tres cierres; el rename restaura el orden remoto. Tocan funciones distintas, así que el estado final no cambia.

No hay otras filas en `supabase_migrations.schema_migrations` sin archivo. Las 19 versiones anteriores ya coincidían.

## Evidencia

- `npx supabase migration list --linked` (solo lectura).
- `statements` de las cuatro filas remotas vs SQL git, normalizado (comentarios y whitespace).
- Reset local con los nombres viejos y otra vez con los nombres alineados: las 23 migraciones aplican.
- Dump `public` local vs `supabase/schema-baselines/v0.9-baseline-public.sql`: tipos 6, tablas 10, constraints 34, índices 29, funciones 28 (cuerpo + `LANGUAGE`/`SECURITY DEFINER`/`search_path`), triggers 10, policies 23, RLS en las 10 tablas — sin diferencias.
- `npx supabase db lint --local --schema public`: sin errores.
- Tras el rename, `migration list --linked` muestra las 23 versiones alineadas. Un `db push` futuro no reaplicará esas cuatro.

## Grants de entorno (no son migraciones faltantes)

El baseline productivo tiene `GRANT ALL` a `anon` en funciones y tablas `public`, y `ALTER DEFAULT PRIVILEGES … GRANT ALL … TO anon`. El CLI local no auto-expone a `anon` (dump: funciones sin grant a `anon`; tablas `anon` sólo `REFERENCES, TRIGGER, TRUNCATE, MAINTAIN`). Es el default del proyecto hosted, ya registrado como `MEDIUM` en el registro de riesgos. No vive en `schema_migrations`. No se copió a Git para no reproducir ese over-grant. RLS sigue denegando a `anon` sin policy.

## Reconciliación aplicada

Sólo Git: `git mv` de los cuatro archivos al timestamp remoto. Misma SQL. Sin `db push`, sin `migration repair`, sin DDL/DML en `jbhbjazagiwyryujnenv`.

No hace falta repair. Si se hubiera preferido mutar el historial remoto en vez de los nombres git, habría sido `reverted` de las cuatro remotas + `applied` de los nombres redondeados, sin ejecutar SQL. Esa vía no se usa.

## Comandos

Diagnóstico (ya ejecutado, solo lectura):

```bash
npx supabase migration list --linked
npx supabase db reset          # local
npx supabase db lint --local --schema public
npx supabase db dump --local --schema public --file <tmp>
```

Ambiente local que todavía tenga las versiones redondeadas aplicadas:

```bash
npx supabase db reset
```

Futuras migraciones: `supabase migration new <slug>`, reset local, PR, y `db push` **después** del merge sin renombrar el archivo. El version es el prefijo del filename. No aplicar DDL por el SQL editor.

## Rollback

Revertir este PR / `git mv` de vuelta a los nombres redondeados. No hay cambio en `schema_migrations` productivo. Un `db reset` local vuelve a la cadena del checkout.

## Estado

Historial local y remoto alineados. `db push` no reaplicará las cuatro. Checkbox 1.1 cerrado. Sprint 2 y las remediaciones de `docs/RLS_REMEDIATION_PLAN.md` no se ejecutaron en este corte.
