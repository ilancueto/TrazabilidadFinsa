# FINSA Trazabilidad — Regla de workspace Antigravity

Esta regla es un adaptador de Antigravity; no reemplaza ni contradice las fuentes comunes del repositorio. La autoridad sigue este orden: `ENTERPRISE_PLAN.md`, `AGENTS.md`, ADRs/documentación aprobada, estado Git/PRs y `AI_HANDOFF.md`.

@../../ENTERPRISE_PLAN.md
@../../AGENTS.md
@../../AI_HANDOFF.md

## Pre-flight

Antes de actuar, verificá `git status`, `HEAD`, `main` y `origin/main`; leé las fuentes anteriores y los ADRs relevantes. Inspeccioná ramas y PRs cuando el trabajo pueda solaparse. No asumas que sos el único agente.

## Rutas, estado y handoff

- Usá rutas relativas al repositorio en Markdown. Nunca versiones `file:///`, rutas absolutas locales ni enlaces no portables.
- Antes de cerrar una unidad, verificá el PR, su estado, merge SHA, checks requeridos y el `main` real. Diferenciá hitos históricos del estado actual.
- Leé y mantené `AI_HANDOFF.md` según `AGENTS.md`; no dejes placeholders obsoletos ni lo conviertas en un changelog.
- No crees planes, walkthroughs, notas o reportes temporales salvo que sean solicitados explícitamente y estén dentro del alcance.

## Concurrencia y alcance

- Aplicá `single writer per file set`. Si aparece trabajo ajeno inesperado, no lo sobrescribas ni descartes; detené la parte conflictiva y reportala.
- Nunca uses `git reset --hard`, `git clean -fd` o force push para resolver concurrencia.
- Ejecutá sólo la unidad solicitada: sin refactors oportunistas, warnings ajenos, cambios fuera de alcance ni inicio automático de la siguiente subetapa. No renumeres `ENTERPRISE_PLAN.md`.

## Git, seguridad e infraestructura

- Para cerrar una unidad: PR real, diff dentro de alcance y checks verdes `quality`, `integration`, `e2e`, `dependency-security`, `CodeQL` y `Secret scan`; nunca bypass.
- FinningCAT nunca se pausa. No generes costo ni hagas mutaciones remotas sin autorización, target, ref, environment y costo verificados. PROD no es un entorno de experimentos.
- No expongas secretos, tokens, keys, cookies, passwords, PII ni evidencias; respetá RBAC/RLS y validá acciones críticas del lado servidor. Los proveedores externos no deben convertirse en dependencias críticas accidentales.
