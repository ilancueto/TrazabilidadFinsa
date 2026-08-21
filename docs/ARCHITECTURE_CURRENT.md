# Arquitectura actual

```mermaid
flowchart LR
  U["Usuarios"] --> N["Next.js / Vercel"]
  N --> A["Server Actions y Route Handlers"]
  A --> S["Supabase Auth / Postgres"]
  A --> T["Supabase Storage privado"]
  S --> R["RLS, RPCs, triggers y audit_events"]
```

El navegador usa Supabase sólo con claves públicas. Las mutaciones críticas pasan por Server Actions o handlers y RPCs; el servicio conserva el acceso privilegiado a Storage.

