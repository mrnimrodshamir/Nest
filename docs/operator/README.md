# NestUp Unified Operator

The operator is one deterministic orchestration layer over the existing city expansion, source discovery, provider integration, event quality, localization, and approval capabilities. Modes configure the same capabilities; they do not create separate agents.

## Operating loop

`OBSERVE → DETECT → PRIORITIZE → INVESTIGATE → PLAN → EXECUTE SAFE ACTIONS → VERIFY → REPORT → WAIT / CONTINUE`

## Scores

Content Health is a weighted score: source completeness 15, freshness 15, validity 10, uniqueness 10, family relevance 15, age coverage 7.5, price coverage 5, location coverage 10, registration/source-link coverage 5, and category confidence 7.5. Each input is an observed 0–1 ratio. Reports retain every deduction; a score is not claimed more precisely than the underlying signals.

Product Health is a weighted score: tests 20, TypeScript 15, Expo Doctor 10, iOS export 15, critical flows 15, Edge Functions 10, cron health 5, and security checks 10. A green suite alone therefore cannot produce 100.

Priorities use `severity × user impact × confidence × reach ÷ implementation risk`, with P0–P3 as a hard first ordering and the formula as ordering within a priority.

## Autonomy

The executable policy lives in `src/operator/policy.ts`.

- GREEN: diagnostics, tests, documentation, reports, research, connector dry-run proposals, and isolated deterministic parser/normalization fixes.
- YELLOW: prepare only; production requires explicit approval. This includes cities, providers, crons, production corrections, meaningful UI or notification changes, and localization policy.
- RED: never autonomous. Destructive migrations, weaker RLS, constraint removal, user/RSVP deletion, global dedupe changes, mass mutation, force push, releases, App Store submission, or bypassing source protection.

## Run modes

- `quick_check`: product health
- `daily`: product/content/provider health
- `deep_audit`: full product/content/provider/security pass
- `city_expansion`: existing supervised workflow
- `source_hunt`: source discovery and net-new-value ranking
- `bug_hunt`: reproduce/root-cause/regression workflow

Example: `npm run operator -- --mode deep_audit --persist`. Persistence is limited to the existing agent control-plane tables.

## Supervised automation

The scheduled Edge Function accepts only `daily` and `source_hunt`. Daily runs at `03:15 UTC`; weekly Tel Aviv Source Hunt runs Mondays at `03:30 UTC`. These are operational UTC schedules rather than user-facing delivery times. Scheduled runs may execute Green diagnostics and create pending Yellow approval requests only. They cannot update approval decisions, providers, Events, cities, notification behavior, builds, or releases.

Owner requests use the existing `approval_requests` table plus an explicit `operator_owners` allow-list. Agents retain insert-only approval access. An authenticated allow-listed owner may select the inbox and update only `status`, `decided_by`, and `decided_at`; silence never changes a request from `PENDING`.

Every health run also emits the compact `NESTUP OPERATOR REPORT` in its artifact. It includes overall scores, critical/product/content/provider/city sections, three opportunities at most, completed Green work, Yellow approvals, and one next-best action so it can be read in under two minutes.
