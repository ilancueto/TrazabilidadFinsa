# Decisiones pendientes de IT

La aplicación ya está publicada en Vercel y usa Supabase. Estas decisiones siguen necesitando un dueño operativo:

- [ ] Ratificar Vercel y el proyecto Supabase actuales como infraestructura autorizada
- [ ] Storage definitivo (Drive autorizado, S3 interno, o Supabase)
- [ ] Política de retención y backups de fotografías
- [ ] Confirmar autorización de los assets de marca incluidos
- [ ] Dominio interno y política de acceso
- [x] Revisión técnica de RLS, RPCs privilegiadas, grants y Storage en producción (Sprint 2.4)
- [ ] Habilitar Supabase Auth leaked-password protection si el plan/proyecto lo permite
- [ ] Evaluar mover `pg_trgm` fuera de `public` en una ventana de mantenimiento; hoy tres índices productivos dependen de la extensión
- [ ] Integración ERP/SAP o Andreani: fuera de alcance hasta API aprobada
- [ ] Error tracking: ratificar Sentry SaaS (residencia EU, DPA, plan Developer de un usuario) o elegir alternativa; no crear cuenta ni DSN hasta esa ratificación. Ver `docs/ADR_ERROR_TRACKING.md`
