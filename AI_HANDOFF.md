# AI Engineering Handoff

## Current program state

- Sprint 1: COMPLETE
- Sprint 2: COMPLETE
- Sprint 3: COMPLETE
- Sprint 4: IN PROGRESS (Sprint 4.1 complete, Sprint 4.2a complete, Sprint 4.2b-1 implemented in an open PR pending merge, Sprint 4.2b-2 not started, Sprint 4.3 not started)

Governing roadmap: `ENTERPRISE_PLAN.md`.
Operating protocol: `AGENTS.md`.

## Last verified functional milestone

Sprint 4.2a — Error tracking decision

- Status: COMPLETE
- Executor role: RESEARCHER / IMPLEMENTER-DOCS
- Model: Grok 4.6 High
- PR: #57
- Merge: `a4315c5ce090a9dd8e8a17e0fe052c786b500315`
- Decision: Sentry recommended (`@sentry/nextjs`)
- Implementation: None (no SDK, account, DSN, or event sending created)
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

## Current gate

Sprint 4.2 remains **INCOMPLETE**.

`Sprint 4.2b-1` is implemented technically but is **not complete**: PR #61 remains open and pending final audit and merge. `Sprint 4.2b-2` has not started.

Sentry remains OFF: zero real DSN, zero external events and zero cost. Neither STAGING nor PROD was modified or enabled. `withSentryConfig` is deliberately omitted because the installed SDK version injects tracing metadata; source-map upload is deferred to a future unit with its own authorization and guardrail review.

Human / IT sign-offs required prior to live event emission:
1. SaaS acceptance for error tracking;
2. Sentry vs alternative confirmation;
3. Data residency (EU);
4. DPA signature;
5. Account ownership / plan selection (Developer 1-user vs Team);
6. Future production activation authorization.

## Current handoff — Sprint 4.2b-1

- Unit: Sprint 4.2b-1 — technical error-tracking implementation OFF by default
- Status: PR [#61](https://github.com/ilancueto/TrazabilidadFinsa/pull/61) OPEN / pending merge; do not declare Sprint 4.2b complete
- Branch: `codex/feat/sprint-4-2b-error-tracking-off`
- Head SHA: `8a3ecd09556c4f1522b65163a85c733d4fdc7f16`
- Roles: Sol (Lead/Architect), Terra (Implementer), Claude Sonnet (Security Reviewer)
- Security review final: **APPROVE**; F-01 CLOSED, F-02 INVALID ACCEPTED, F-03 INVALID ACCEPTED; no MEDIUM/HIGH findings remain open
- Sentry state: OFF by default; zero DSN, zero events, zero cost
- Environments: STAGING and PROD were not modified; PROD remains blocked in code
- Build integration: `withSentryConfig` deliberately omitted; source maps are pending for a future unit
- F-01 mitigation: `SENTRYCLI_SKIP_DOWNLOAD=1` is fixed in CI dependency-install contexts and documented for local installation
- Validations executed: `npm run verify` (112 unit tests and build passed; 3 pre-existing ESLint warnings), `npm run test:integration` (43 tests passed), `git diff --check` passed, and the six required PR checks passed before this handoff-only update
- DB / infrastructure changes: None. No Vercel, Supabase, STAGING or PROD changes; no live event was emitted
- Cost incurred: USD 0
- Next step: final audit and merge of PR #61; then a human gate before starting Sprint 4.2b-2

> [!NOTE]
> Do NOT start Sprint 4.2b-2 in this unit. It requires a separate human gate, scope, approval and execution.

## Subsequent unit

`Sprint 4.3 — Health`

> [!IMPORTANT]
> Health is Sprint 4.3 and CANNOT be renumbered as 4.2.

## Operational rules & SHA verification

- Rule: Every agent must verify the actual `HEAD` SHA of `main` at startup (`git rev-parse HEAD`).
- Last verified functional milestone merge SHA: `a4315c5ce090a9dd8e8a17e0fe052c786b500315`.
- Last verified multi-agent protocol merge: [PR #58](https://github.com/ilancueto/TrazabilidadFinsa/pull/58), `927329ecf4f2f108b877077b55cedfbfeb16e589`.
- `main` at this handoff correction: `a3d78778de21ca758209d41e44d6b03a35b58143`.
