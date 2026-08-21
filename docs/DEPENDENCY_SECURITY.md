# Supply-chain security — Sprint 2.5

## Controles automatizados

- Dependabot semanal para npm y GitHub Actions (`.github/dependabot.yml`).
- `npm audit --audit-level=high` en CI: bloquea HIGH/CRITICAL.
- SBOM CycloneDX generado en cada ejecución de CI y publicado como artifact por 30 días.
- Secret scanning con Gitleaks en PR, push a `main` y ejecución semanal.
- Code scanning con CodeQL para JavaScript/TypeScript en PR, push a `main` y ejecución semanal.

## Validación inicial

Ejecución de PR #43:

- `npm ci`: OK.
- `npm run verify`: OK.
- `npm audit --audit-level=high`: OK; no hay vulnerabilidades HIGH/CRITICAL.
- Resultado completo de `npm audit`: 2 vulnerabilidades MODERATE, ambas asociadas a `uuid < 11.1.1` a través de `exceljs`.
- Gitleaks: OK, sin secretos detectados en la ejecución validada.
- CodeQL: OK.
- SBOM CycloneDX: generado correctamente como artifact `sbom-cyclonedx`.

## Dependencias/deprecaciones revisadas

La instalación actual reporta paquetes transitivos obsoletos/deprecados (`inflight`, `rimraf@2`, `lodash.isequal`, `glob@7`, `fstream`, `uuid@8`). No son dependencias directas declaradas por la aplicación; llegan a través del árbol de dependencias existente.

El hallazgo accionable actual es `exceljs@4.4.0` → `uuid@8.3.2`, que mantiene dos avisos MODERATE. `npm audit` no ofrece una actualización no disruptiva: su sugerencia automática implica un cambio mayor/incompatible de `exceljs`. Por eso no se fuerza un downgrade/upgrade a ciegas en Sprint 2.5.

Tratamiento:

- HIGH/CRITICAL bloquean CI inmediatamente.
- MODERATE/LOW se registran y se revisan antes de releases importantes.
- El riesgo transitivo de `exceljs` queda documentado en `docs/RISK_REGISTER.md` para seguimiento y eventual reemplazo/actualización controlada.
- Dependabot mantendrá visibles actualizaciones disponibles de dependencias directas y de GitHub Actions.

## SBOM

Formato: CycloneDX JSON.

Generación reproducible:

```bash
npm ci
npm sbom --sbom-format=cyclonedx > sbom.cdx.json
```

El SBOM no se versiona porque cambia con el lockfile; CI genera el artifact correspondiente a cada commit y conserva su relación con el SHA de Git.

## Criterio de seguridad

Un PR no debe incorporarse si:

- `npm audit` detecta HIGH/CRITICAL;
- Gitleaks detecta un secreto;
- CodeQL falla en su análisis;
- no puede generarse el SBOM.

Los hallazgos no bloqueantes deben quedar documentados y no se deben resolver mediante cambios breaking automáticos sin prueba de regresión.