# NestUp City Expansion Agent System (Level 1–2)

This control plane coordinates six explicit responsibilities without adding a third-party agent framework. The persisted database model is proposed in `20260821120000_city_expansion_agent_control_plane.sql`; it is local only and has not been applied.

## Execution model

`city_profile` and `source_discovery` may run in parallel. All later stages follow dependency edges in the workflow artifact. A blocked or failed task stops downstream work. The final automated stage is `awaiting_human_approval`.

Production enablement is intentionally absent from the migration's allowed stages. Service-role agents can insert pending approval requests but cannot update or delete them. A future separately approved human-admin path is required to record a decision.

## Agent permissions

- Orchestrator: schedules tasks, reads artifacts, creates pending approval requests.
- Source Discovery: read-only public research and source scoring.
- Provider Integration: proposals, fixture parsing, dry-run only.
- Event Quality: classification and recommendations, never publication.
- Localization: safe mappings; preserves user/provider content.
- City Expansion: city profile and readiness score.

No agent has a production-write capability. Connector activation, cron, city enablement, global dedupe changes, privacy/security changes, releases, and App Store changes require separate explicit approval.

## Ramat Gan MVP

Run `npm run city-expansion:dry-run` to regenerate the structured artifacts in `docs/city-expansion/ramat-gan`. It performs zero network calls and zero production writes; the sample is a captured, read-only research fixture. The current result is `CONDITIONAL_GO` and stops at Gate A for a new source.

The contracts in `supabase/functions/_shared/cityExpansion/types.ts` and `artifact-schemas.json` are the stable schema sources for version 1.0.
