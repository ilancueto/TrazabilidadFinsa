# Registro de riesgos

| Nivel | Riesgo | Estado / mitigación |
| --- | --- | --- |
| HIGH | Historial de migraciones local y productivo divergente. | Bloquea confirmar equivalencia; reconciliar en un PR específico y no aplicar migraciones a ciegas. |
| HIGH | No hay PITR ni backup físico de Supabase disponible. | Backup lógico local creado; pendiente cifrado y retención. |
| MEDIUM | Backup local sin cifrar. | Cifrar antes de moverlo o compartirlo. |
| MEDIUM | CI no ejecuta integración, E2E ni escaneo de seguridad. | Abordar en Sprint 3. |

