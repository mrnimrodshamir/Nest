# Places migration reconciliation

Production migration history uses timestamp versions, while the reviewed Places
foundation was developed in numbered migrations `0006` through `0008`. Those
numbered files remain in the repository as design history and must not be marked
as remotely applied.

The production migration is:

`20260805141002_create_family_friendly_places.sql`

It consolidates only the concepts required by the current release:

- `0006`: the permanent `places` entity, provider-neutral metadata, coordinate
  and age validation, geography, indexes, and authenticated read-only RLS.
- `0007`: only the visibility/search/editorial columns and search function used
  by current client/query contracts. Collections and the quality view are not
  included in this release.
- `0008`: the approved category set plus source/external identity and import
  batch metadata required by the controlled importer.

Remote history is not repaired or rewritten. The timestamp migration is a new,
forward-only production event after the latest existing remote migration.

Rollback is intentionally explicit and destructive, so it is documented but
never automatic:

```sql
drop function if exists public.search_curated_places(text, integer);
drop table if exists public.places;
```

Rollback is safe only before other production objects depend on `places`, and
only after any imported rows have been exported or intentionally discarded.
