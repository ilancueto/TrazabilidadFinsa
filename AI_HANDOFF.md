# AI Engineering Handoff

## Current program state

- Sprint 1: COMPLETE
- Sprint 2: COMPLETE
- Sprint 3: COMPLETE
- Sprint 4: IN PROGRESS (Sprint 4.1 COMPLETE; Sprint 4.2 CLOSED — COMPLETE WITH PROVIDER PRIVACY BLOCKER; Sprint 4.3 CLOSED; Sprint 4.4 CLOSED; Sprint 4.5 NOT STARTED; Sprint 4.6 NOT STARTED)

Governing roadmap: `ENTERPRISE_PLAN.md`.
Operating protocol: `AGENTS.md`.

## Historical functional milestone — Sprint 4.2b-1

Sprint 4.2b-1 — Error tracking technical integration OFF by default

- Status: COMPLETE
- Roles: Sol (Lead/Architect), Terra (Implementer), Claude Sonnet (Security Reviewer), Final Auditor: ChatGPT
- PR: #61
- Merge: `9c5e9371a95244bfdf7c7535879b5356a183da5f`
- Security review final: **APPROVE**; F-01 CLOSED, F-02 INVALID ACCEPTED, F-03 INVALID ACCEPTED; no MEDIUM/HIGH findings remain open
- Sentry state: OFF by default; zero real DSN, zero external events, zero cost
- Environments: STAGING and PROD were not modified; PROD remains blocked in code
- Build integration: `withSentryConfig` deliberately omitted; source maps are pending for a future unit
- F-01 mitigation: `SENTRYCLI_SKIP_DOWNLOAD=1` is fixed in CI dependency-install contexts and documented for local installation
- Validations: `npm run verify` passed (112 unit tests, build OK, 3 pre-existing ESLint warnings), `npm run test:integration` passed (43 tests), `git diff --check` passed, and all six required PR checks passed
- DB / infrastructure changes: None. No Vercel, Supabase, STAGING or PROD changes; no live event was emitted
- Cost incurred: USD 0

## Active decision — Error tracking

Technical decision summary (see [ADR_ERROR_TRACKING.md](docs/ADR_ERROR_TRACKING.md) for full context):
- Tool: Sentry (`@sentry/nextjs`) recommended in Developer tier (USD 0).
- Isolation: Independent projects for STAGING (`trazabilidad-staging`) and PROD (`trazabilidad-prod`).
- Data residency: EU (Frankfurt) proposed at organization creation time.
- Data policy: Session Replay OFF, Tracing OFF, Sentry Logs OFF, Profiling OFF and PII OFF. Source maps remain pending for a future, separately authorized unit.
- Inactive environments: Local development, CI, and generic Vercel Previews run without DSN (no event sending).
- Kill switch: Required (`ERROR_TRACKING_ENABLED` and empty DSN handling).
- Gate: Human and IT authorization required before creating organization, signing DPA, or emitting the first real event.
- Provider privacy finding: a controlled server-side validation proved that `sdk.settings.infer_ip="never"` reaches the real event, but Relay/SaaS still derives `user.geo` from the ingestion connection IP. The observed `São Paulo, Brazil` is, with high confidence, Vercel `gru1` egress rather than end-user geography.
- Direct Sentry is disabled in STAGING and PROD while the zero-Geography privacy requirement remains in force. There is no supported `@sentry/nextjs@10.70.0` mitigation that guarantees zero Geography for server-side events.
- Trace ID / Span ID / Trace Preview in the validated error are synthetic Relay/Sentry metadata, not evidence of application performance tracing, real spans, or real transactions.

## Current gate

Sprint 4.2 is **CLOSED / COMPLETE WITH PROVIDER PRIVACY BLOCKER**. `Sprint 4.2b-2` is closed as **BLOCKED BY PROVIDER PRIVACY BEHAVIOR**; the technical integration is complete, and direct Sentry remains disabled because the provider cannot guarantee zero server-side Geography.

`Sprint 4.2b-1` is COMPLETE and merged in PR #61 at `9c5e9371a95244bfdf7c7535879b5356a183da5f`.

Sentry direct remains OFF in STAGING and PROD. During the authorized controlled validation, one artificial server-side event was emitted and then the temporary STAGING variables and Client Key were removed/disabled; no additional events are authorized. `withSentryConfig` is deliberately omitted because the installed SDK version injects tracing metadata; source-map upload is deferred to a future unit with its own authorization and guardrail review.

Human / IT sign-offs required prior to live event emission:
1. SaaS acceptance for error tracking;
2. Sentry vs alternative confirmation;
3. Data residency (EU);
4. DPA signature;
5. Account ownership / plan selection (Developer 1-user vs Team);
6. Future production activation authorization.

## Current handoff — Sprint 4.2b

- Completed unit: Sprint 4.2b-1 — technical error-tracking implementation OFF by default
- PR: [#61](https://github.com/ilancueto/TrazabilidadFinsa/pull/61) MERGED
- Merge SHA: `9c5e9371a95244bfdf7c7535879b5356a183da5f`
- Historical `main` verification at the 4.2b-1 handoff: `9c5e9371a95244bfdf7c7535879b5356a183da5f`
- Sprint 4.2b-2: **CLOSED — BLOCKED BY PROVIDER PRIVACY BEHAVIOR**
- Finding: `sdk.settings.infer_ip="never"` is present in the real server event, but Relay/SaaS derives `user.geo` from the ingestion connection IP. `São Paulo, Brazil` matches Vercel `gru1` egress with high confidence, not end-user location.
- Trace UI: Trace ID / Span ID / Trace Preview are synthetic Relay/Sentry metadata only; no performance tracing, spans, or transactions were enabled by the application.
- Sentry state: direct send disabled in STAGING and PROD; temporary STAGING variables and Client Key removed/disabled after the single controlled artificial event; cost USD 0
- Environments: PROD was never enabled or modified; STAGING was temporarily and narrowly activated for the authorized validation, then returned OFF
- Build integration: `withSentryConfig` deliberately omitted; source maps remain pending for a future unit
- Sprint 4.3 — Health CLOSED in PR #64 at `ee7e3fdf18d5868d704576683b4c82728172fefb`. Do not resume direct Sentry without a provider correction verified against the zero-Geography contract, or an approved alternative provider/architecture.

> [!WARNING]
> Do NOT reactivate direct Sentry in STAGING or PROD while the zero-Geography privacy requirement is active. `Sprint 4.2b-2` is not an implementation failure; it is blocked by verified provider privacy behavior.

## Subsequent unit

`Sprint 4.5 — Auditoría visible` — NEXT / NOT STARTED

> [!IMPORTANT]
> Sprint 4.3 remains Health and is CLOSED. Sprint 4.4 is CLOSED after the documented review, re-review, final audit, merge and CI gates. Sprint 4.5 remains NOT STARTED.

## Current handoff — Sprint 4.3

- **Unit / Sprint:** Sprint 4.3 — Health
- **Status:** CLOSED
- **Roles:** Implementer
- **Model assignment:** Codex (GPT-5)
- **Initial SHA:** `a596300392c175dfe9e7283dfecfc33ad15a992b`
- **Branch:** `codex/feat/sprint-4-3-health`
- **PR / Merge SHA:** [#64](https://github.com/ilancueto/TrazabilidadFinsa/pull/64) MERGED; `ee7e3fdf18d5868d704576683b4c82728172fefb`
- **Files:** `src/app/api/health/route.ts`, `src/lib/health.ts`, dedicated unit/integration tests, `docs/MONITORING.md`, `ENTERPRISE_PLAN.md`, this handoff
- **Decisions:** public read-only `/api/health`; web process plus PostgREST/DB, Auth and private `evidences` bucket checks run in parallel; 5 s bound; real abort for PostgREST/Auth and a bounded read-only Storage wait because the installed Storage SDK has no operation AbortSignal; 200 only when all are reachable, otherwise 503; no-cache and no raw provider detail in payloads/logs
- **Tests / checks:** health unit tests PASS (10); health integration PASS (1); `npm run verify` PASS (138 unit tests, build OK; 3 pre-existing lint warnings); `npm run test:integration` PASS (44); `git diff --check` PASS; `quality`, `integration`, `e2e`, `dependency-security`, `CodeQL` and `Secret scan` PASS; independent review APPROVED
- **DB / infra changes:** None. No migrations, Vercel, remote Supabase, STAGING or PROD changes
- **Cost:** USD 0
- **Risks / findings:** Sentry remains DISABLED because of the existing provider privacy blocker; no Sprint 4.3 findings remain open.
- **Explicitly not done:** Sentry activation, metrics, dashboards, alerts, tracing, visible audit, backup/restore and Sprint 4.4
- **Next recommended unit:** Histórico al cierre de 4.3: Sprint 4.4 — Métricas técnicas; posteriormente CLOSED.

## Current handoff — Sprint 4.4

- **Unit / Sprint:** Sprint 4.4 — Métricas técnicas
- **Status:** CLOSED
- **Roles:** Implementer (single writer)
- **Model assignment:** Codex (GPT-5)
- **Initial SHA:** `52f186e91bdfd21b2e598e9c6f520aa916995ec3`
- **Branch:** `codex/feat/sprint-4-4-technical-metrics` (merged)
- **PR / Merge SHA:** [#66](https://github.com/ilancueto/TrazabilidadFinsa/pull/66) MERGED; audited head `d30ac448108ef788edca572a145cd0c0e71e5059`; merge SHA `5d66f60d2958fb08f251dfb37ebd96454f881ea0`; `main` verified at closure: `5d66f60d2958fb08f251dfb37ebd96454f881ea0`.
- **Files:** structured observability, six scoped Route Handlers, evidence retry/persistence, RPC failure branches for exceptional close/reopen, offline aggregator and tests, monitoring docs, plan and handoff.
- **Decisions:** no metric persistence, DB migration, metric RPC, SaaS, tracing, OpenTelemetry, dashboard or endpoint; durable successes derive only from `audit_events`, while failures/latency/retries derive from JSON logs; p50/p95 are offline `percentile_cont` equivalents and require 20 samples. The reconciliation uses Next 16 public `unstable_rethrow` so navigation control flow has no synthetic 500 metric; logs and audit availability are explicitly independent and default to `UNKNOWN`; best-effort logging cannot abort thumbnail, ZIP, or report partial recovery; one wrapper request context is shared with evidence persistence.
- **Tests / checks:** independent initial review: **CHANGES REQUIRED**; reconciliation COMPLETE; authorized fixes COMPLETE; independent re-review: **APPROVE DELTA**; final pre-merge audit: **APPROVED FOR MERGE**. `npm run verify` PASS (159 unit tests, build OK; 3 pre-existing lint warnings); `npm run test:integration` PASS (44); local Playwright E2E PASS (8); `git diff --check` PASS. All six required CI checks PASS on the audited head: `quality`, `integration`, `e2e`, `dependency-security`, `CodeQL`, `Secret scan`.
- **DB / infra changes:** None. No migration, Vercel, Supabase, STAGING or PROD changes.
- **Cost:** USD 0.
- **Risks / findings:** logs are not durable metric storage; retry remains non-idempotent and still retries some non-transient HTTP responses; `X-Upload-Attempt` is client-attested best-effort observability only; HTML form `303` failures remain excluded from the metric denominator pending unambiguous semantics; API/RPC/HTTP categories can overlap and do not represent unique incidents. Sentry remains DISABLED under the existing provider privacy blocker.
- **Explicitly not done:** visible audit, dashboard/KPI, idempotency, new persistence, provider, tracing, endpoint, alerting, backup/restore, Sprint 4.5 or Sprint 5 work.
- **Next recommended unit:** Sprint 4.5 — Auditoría visible — NOT STARTED. Do not begin its design or implementation in this unit.

## Operational rules & SHA verification

- Rule: Every agent must verify the actual `HEAD` SHA of `main` at startup (`git rev-parse HEAD`).
- Last verified functional milestone merge SHA: `5d66f60d2958fb08f251dfb37ebd96454f881ea0`.
- Last verified multi-agent protocol merge: [PR #58](https://github.com/ilancueto/TrazabilidadFinsa/pull/58), `927329ecf4f2f108b877077b55cedfbfeb16e589`.
- `main` verified at Sprint 4.4 closure: `5d66f60d2958fb08f251dfb37ebd96454f881ea0`.
