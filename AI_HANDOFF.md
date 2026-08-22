# AI Engineering Handoff

## Current program state

- Sprint 1: COMPLETE
- Sprint 2: COMPLETE
- Sprint 3: COMPLETE
- Sprint 4: IN PROGRESS (Sprint 4.1 complete, Sprint 4.2a complete, Sprint 4.2b not started, Sprint 4.3 not started)

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
- Data policy: Session Replay OFF, Tracing OFF, Sentry Logs OFF, Profiling OFF, PII OFF, source maps on build only.
- Inactive environments: Local development, CI, and generic Vercel Previews run without DSN (no event sending).
- Kill switch: Required (`ERROR_TRACKING_ENABLED` and empty DSN handling).
- Gate: Human and IT authorization required before creating organization, signing DPA, or emitting the first real event.

## Current gate

Sprint 4.2 remains **INCOMPLETE**.

Pending: `Sprint 4.2b — Error tracking integration`.

Human / IT sign-offs required prior to live event emission:
1. SaaS acceptance for error tracking;
2. Sentry vs alternative confirmation;
3. Data residency (EU);
4. DPA signature;
5. Account ownership / plan selection (Developer 1-user vs Team);
6. Future production activation authorization.

## Next unit

`Sprint 4.2b — Error tracking integration`

> [!NOTE]
> Do NOT start in this unit. Requires separate scope, approval, and execution.

## Subsequent unit

`Sprint 4.3 — Health`

> [!IMPORTANT]
> Health is Sprint 4.3 and CANNOT be renumbered as 4.2.

## Operational rules & SHA verification

- Rule: Every agent must verify the actual `HEAD` SHA of `main` at startup (`git rev-parse HEAD`).
- Last verified functional milestone merge SHA: `a4315c5ce090a9dd8e8a17e0fe052c786b500315`.
- Last verified multi-agent protocol merge: [PR #58](https://github.com/ilancueto/TrazabilidadFinsa/pull/58), `927329ecf4f2f108b877077b55cedfbfeb16e589`.
- `main` at this handoff correction: `927329ecf4f2f108b877077b55cedfbfeb16e589`.

## Current handoff

- Unit: Establish role-based multi-agent protocol and update operational handoff
- Status: COMPLETE
- Roles: LEAD / ARCHITECT & IMPLEMENTER
- Model: Gemini 3.7 Flash
- Initial SHA: `a4315c5ce090a9dd8e8a17e0fe052c786b500315`
- Branch used: `docs/multi-agent-protocol` (merged; not active)
- PR: [#58](https://github.com/ilancueto/TrazabilidadFinsa/pull/58)
- Merge SHA: `927329ecf4f2f108b877077b55cedfbfeb16e589`
- Files: `AGENTS.md`, `AI_HANDOFF.md` only
- Decisions: Established abstract permanent roles, independence rules, concurrency protocols, and non-binding model guidance; synchronized handoff with merged Sprint 4.2a state.
- Tests/checks: `npm run verify` passed; 6 required GitHub Actions checks.
- DB / infra changes: None. Supabase and Vercel untouched. FinningCAT active.
- Cost incurred: USD 0.
- Explicitly not done: Sprint 4.2b (integration), Sprint 4.3 (health), application code, test suite modifications.
- Next recommended unit: `Sprint 4.2b — Error tracking integration` (once human approval is granted).
