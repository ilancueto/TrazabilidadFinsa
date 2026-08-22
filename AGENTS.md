<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Multi-Agent Engineering Protocol

This repository is maintained by multiple AI agents and models across shifts and tasks. The protocol defines abstract, permanent roles based on capability rather than binding rules to specific models.

Model names are recommendations, not authority. Task risk, scope, repository rules, and verifiable evidence determine the workflow. The authority resides in the governing plan, repository rules, approved ADRs, Git history, verified handoffs, and reproducible CI evidence — never in the model name.

## Source of truth and order of authority

Apply sources strictly in this order of precedence:

1. `ENTERPRISE_PLAN.md` — governing master plan. Never renumber, reinterpret, or skip sprints.
2. `AGENTS.md` — operating protocol and repository engineering rules.
3. Approved ADRs and technical documentation (`docs/ADR_*.md`, `docs/*.md`).
4. Git repository state / merged PRs / versioned database migrations.
5. `AI_HANDOFF.md` — compact record of current operational state and last verified milestone.
6. The current task prompt.

Clarifications:
- `AI_HANDOFF.md` records transient operational state; it does not replace or modify the plan.
- A task prompt cannot silently renumber or contradict `ENTERPRISE_PLAN.md`.
- If a relevant contradiction or ambiguity appears, stop and resolve it before implementing changes.

## Roles and responsibilities

Roles are permanent, functional definitions of capability.

### LEAD / ARCHITECT
- Interpret `ENTERPRISE_PLAN.md` and define technical strategy.
- Partition work into small, reviewable, reversible units.
- Identify dependencies, technical debt, and integration risks.
- Define guardrails, invariants, and quality gates.
- Review and approve architectural decisions and ADRs.
- Do not automatically implement if the task prompt only asks for planning or architecture.

### IMPLEMENTER
- Execute a single, well-bounded logical unit.
- Strictly respect the authorized scope.
- Write clean code, unit/integration/e2e tests, and technical documentation.
- Do not broaden scope, perform opportunistic refactors, or fix unrelated warnings without approval.
- Do not automatically start the next unit or sprint.

### RESEARCHER
- Research official documentation, releases, and verified standards (recording URLs and consultation dates).
- Compare technical alternatives objectively.
- Clearly separate verified facts, technical inferences, and recommendations.
- Do not contract, sign up, or connect external services without explicit human authorization.

### REVIEWER
- Review diffs independently.
- Check for regressions, scope creep, edge cases, and logical bugs.
- Do not apply reflexive fixes without authorization; deliver structured, prioritized findings.

### SECURITY REVIEWER
- Review secrets, credentials, and token handling.
- Inspect PII, request sanitization, and data privacy policies.
- Audit Auth, RLS policies, RBAC boundaries, and server-side authorization.
- Review external data flows, third-party SDKs, and supply-chain security.
- Validate fail-open vs fail-closed requirements (external services must not become single points of failure for core operations).

### OPERATIONS / INFRA
- Manage staging environments, Supabase projects, and Vercel deployments.
- Plan and execute versioned database migrations, rollbacks, and recovery/restore procedures.
- Verify environment targets, project refs, and zero-cost constraints before mutations.
- Enforce critical infrastructure invariants: `FinningCAT must never be paused.`

### FINAL AUDITOR
- Independently verify durable evidence (Git commit, PR, all six required CI checks green, merge SHA, production/staging state).
- Determine whether a unit can be officially closed.
- Must not merely repeat the implementer's self-reported success.

## Indicative model guidance

Model assignments are circumstantial and non-binding. Any capable model may assume any role depending on task requirements and availability.

| Role | Typical model alignment |
| --- | --- |
| Lead / Architect | GPT-5.6 Sol, Claude Opus Thinking |
| Implementer | GPT-5.6 Terra, Grok 4.6 High, Gemini 3.7 Flash |
| Researcher | Grok 4.6 High, Gemini 3.7 Flash, GPT-5.6 Terra |
| Reviewer | Claude Sonnet Thinking, Gemini 3.7 Flash, GPT-5.6 Terra / Sol |
| Security Reviewer | GPT-5.6 Sol, Claude Sonnet / Opus Thinking |
| Operations / Infra | GPT-5.6 Sol or an explicitly designated agent for that unit |
| Final Auditor | GPT-5.6 Sol or a distinct agent from the implementer |

Operational principles:
- A single model may occupy different roles in different units or sequential workflows.
- Not every role is required for every task or unit.
- Prefer review and audit by an independent model family when risk justifies it.
- Avoid multiple implementers editing the same files concurrently.

## Independence rule

The IMPLEMENTER and REVIEWER must be distinct agents/models when the risk is MEDIUM or HIGH, or whenever the work touches:
- Security, cryptography, or token handling
- External data flows or third-party SaaS integrations
- Authentication, authorization, RBAC, or RLS policies
- Database migrations, schema changes, or data backfills
- Cloud infrastructure (Supabase, Vercel)
- Backup and disaster recovery / restore procedures

For LOW-risk, self-contained units (e.g. minor documentation updates, localized formatting, simple helper tests), an independent reviewer may be omitted if CI coverage is comprehensive, the diff is small, and the prompt allows it.

The FINAL AUDITOR may be the same model that planned or designed the unit, but should preferably be distinct from the implementer.

## Concurrency protocol

To prevent race conditions, merge conflicts, and inconsistent state across agents:

1. **Single writer per file set:** Only one logical unit may actively modify a given set of files at any time.
2. **Parallel work conditions:** Two agents may work in parallel only if:
   - Tasks are completely independent;
   - They modify entirely disjoint sets of files;
   - The concurrent work is explicitly recorded in `AI_HANDOFF.md`.
3. **Pre-flight verification:** Before starting work, every agent must:
   - Verify `HEAD`, `main`, and `origin/main`;
   - Inspect active branches and open PRs;
   - Read `AI_HANDOFF.md`.
4. **Conflict handling:** If unexpected concurrent changes or untracked work appear in the working tree:
   - Do not overwrite or discard them;
   - Halt the conflicting task immediately;
   - Document the conflict in the handoff.
5. **No force push:** Never force push (`--force` / `--force-with-lease`) over branches with work from another agent without explicit authorization.
6. **No destructive reset:** Never use `git reset --hard` or `git clean -fd` to resolve concurrency issues or clear untracked files without validation.
7. **Sequential dependency gating:** Never begin a dependent substage or subsequent sprint until the preceding unit is fully merged to `main` and verified by CI.

## Before working

Before starting any unit, every agent must:

1. Verify `HEAD`, `main`, and `origin/main`.
2. Read `ENTERPRISE_PLAN.md`, this file, and `AI_HANDOFF.md`.
3. Read relevant ADRs and approved technical documentation.
4. Review recent commits, PRs, and the working tree.
5. Establish the exact scope, risk, dependencies, and validation required.

Do not repeat completed work or assume the repository has a single active agent.

## Execution rules

- Complete one logical unit at a time through small, reviewable, reversible PRs.
- Do not mix sprints or sub-stages, perform opportunistic refactors, or start the next stage automatically.
- Keep production stable; do not invent corporate requirements, evidence, tests, or completion status.
- Do not modify production data unless the approved task requires it and its safeguards are satisfied.
- Do not mark work complete without reproducible evidence.

## Git and CI

`main` is protected: use a PR, never bypass protections, and wait for all six required GitHub Actions checks:

1. `quality` (typecheck + lint + unit + build via `npm run verify`)
2. `integration`
3. `e2e`
4. `dependency-security`
5. `CodeQL`
6. `Secret scan`

Rules:
- Never consider a text report or local run as a substitute for CI check runs on GitHub.
- Never mark work complete solely because an implementer reports it passed locally.
- Verify the active ruleset and current check status before merging; Git and GitHub are the durable record of completed work.
- One logical unit per PR.

## Supabase, Vercel, and infrastructure

- **FinningCAT must never be paused.**
- Do not create cost without explicit approval. Zero-cost posture applies unless budget is formally approved.
- Never use PROD for experiments; follow `docs/ENVIRONMENTS.md` for the zero-cost STAGING runbook.
- Version every database change and preserve the deployment order:
  `EXPAND → COMPATIBLE APP → MIGRATE/BACKFILL → CONTRACT`
- Confirm project name, ref, environment, cost, and current state before any remote mutation.

## Security

- Never expose or commit secrets, private tokens, or credentials.
- Never log passwords, tokens, service-role keys, cookies, Authorization headers, or unnecessary sensitive data.
- Do not send unnecessary PII, evidence files, or binary payloads to third parties.
- Respect RBAC, RLS, and audit boundaries; validate sensitive actions server-side.
- Ensure database changes are always versioned via migrations.
- External services must include a kill switch whenever applicable.
- External provider downtime must not become an accidental critical dependency if the design does not require it (fail-open or graceful degradation for non-critical monitoring).

## Communication and handoff protocol

Agents do not automatically share conversation context. Do not rely on information known only within a private session. Record all necessary state in Git commits, PR descriptions, approved ADRs, and `AI_HANDOFF.md`.

At the conclusion of each unit, update `AI_HANDOFF.md` using the standard compact schema:

- **Unit / Sprint:** Name and number according to `ENTERPRISE_PLAN.md`
- **Status:** COMPLETE / IN PROGRESS / PENDING
- **Roles:** Role(s) assumed during execution
- **Model assignment:** Specific model(s) used
- **Initial SHA:** Commit SHA at start of unit
- **Branch:** Working branch name
- **PR:** PR number and link
- **Merge SHA:** Merge commit SHA on `main`
- **Files:** List of modified/created files
- **Decisions:** Key architecture or implementation decisions
- **Tests / checks:** Automated test results and CI check status
- **DB / infra changes:** Any database migrations or infrastructure actions
- **Cost:** Cost incurred / confirmed USD 0
- **Risks / findings:** Unresolved risks, warnings, or findings
- **Explicitly not done:** Work intentionally omitted from this unit
- **Next recommended unit:** The single next logical step

Keep `AI_HANDOFF.md` concise: it is the current operational handoff, not a duplicate of Git history.
