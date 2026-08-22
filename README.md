# Trazabilidad de Entregas — Finning CAT

Aplicación interna para que **Admin** cree entregas desde PC y **Picking** documente cada requisito con fotos desde el celular.

Principio: **Entrega → Requisitos → Evidencias → Auditoría → Cierre**.

`localStorage` no es fuente de verdad. En producción los datos viven en Supabase cloud.

**Producción:** [https://finningcat.vercel.app](https://finningcat.vercel.app)

## Requisitos

- Node 24+
- Docker Desktop en ejecución
- Supabase CLI (`npx supabase` alcanza)

## Arranque local

```bash
# 1. Docker Desktop abierto
npm install
npm run setup
npm run dev
```

`setup` levanta Supabase local, aplica migraciones, genera íconos PWA y carga seeds.

- App local: [http://localhost:3000](http://localhost:3000) (`npm run dev:http`)
- Studio local: [http://127.0.0.1:55323](http://127.0.0.1:55323)

Para el celular usá la URL de Vercel, no la IP de la PC.

### Usuarios de desarrollo

| Nombre          | Rol     | Email              | Contraseña    |
| --------------- | ------- | ------------------ | ------------- |
| Admin FINSA Demo   | ADMIN   | ilan@cat.local     | CatLocal123!  |
| Picking FINSA Demo | PICKING | emilio@cat.local   | CatLocal123!  |

## Scripts

| Script            | Qué hace                          |
| ----------------- | --------------------------------- |
| `npm run dev`     | Next.js                           |
| `npm run setup`   | Supabase + íconos + seed          |
| `npm run db:seed` | Recrea usuarios y entregas demo   |
| `npm run typecheck` | `tsc --noEmit`                  |
| `npm run lint`    | ESLint                            |
| `npm run test` / `test:unit` | Vitest unitario, sin depender de Docker |
| `npm run test:integration` | Persistencia real contra Supabase local |
| `npm run test:upload` | POST/GET HTTP de una foto contra `/api/evidence` |
| `npm run build`   | Build de producción               |
| `npm run verify`  | Tipos + lint + unit tests + build |
| `npm run db:lint` | Verifica las migraciones contra Supabase local |

## Circuito MVP

1. Admin inicia sesión y crea `806042590` (Andreani).
2. Publica. Aparece en `/picking`.
3. Picking carga fotos (se comprimen en el celular).
4. READY queda bloqueado si falta un obligatorio.
5. Al completar, Picking marca lista.
6. Admin revisa, descarga el PDF y cierra.

## Stack

- Next.js 16 App Router + TypeScript strict
- Tailwind 4
- Supabase local (Postgres + Auth + Storage + RLS)
- Zod, Server Actions, pdf-lib
- PWA instalable (sin cola offline; eso es fase 2)

## Variables

Copiá `.env.example` a `.env.local`. Las claves locales de `supabase start` son las de demo y ya están en `.env.local` de este repo de desarrollo.

Cuando exista el proyecto cloud, reemplazá URL y keys. No commitees secretos reales.

## Documentación

- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/IT_PENDING.md`
- `docs/RUNBOOK.md`
- `docs/IMPROVEMENT_STATUS.md` — estado de las mejoras y despliegue pendiente
- `PLAN.md` — trazabilidad de entregas del desarrollo
