# Internal Places import

The CSV and JSON files in this folder document the provider-neutral curation format. They contain fictional development data only.

`dryRunPlaceImport` validates every row, reports row-numbered errors, checks coordinate and age ranges, validates HTTPS image URLs, and detects duplicate provider IDs or the same normalized name within 50 metres. It returns a preview summary and valid normalized rows but performs no database writes. Indexed provider/name lookup keeps duplicate checks practical for thousands of rows.

`exportPlacesCsv` and `exportPlacesJson` produce reviewable backups using the same provider-neutral format. Arrays use `|` separators in CSV. A future authenticated internal tool may review dry-run output and write with service-role credentials kept outside the mobile app.

Phase 2 optional columns include `cover_image_url`, `gallery_image_urls`, `place_origin`, and `partner_tags`. Image validation is deliberately syntactic; the platform does not download remote files during dry runs.

Production curation must verify every place and its family-friendly attributes before setting `verification_status = 'verified'`. Never import these sample rows into production.

## Tel Aviv dataset command

The exact input contract is [tel-aviv-places.schema.json](./tel-aviv-places.schema.json), with the matching CSV header in [sample-places.csv](./sample-places.csv). Every required key must be present; use `null` for an unknown value rather than omitting it.

Dry run only (the default):

```sh
npm run places:import -- path/to/tel-aviv-places.json --report places-dry-run-report.json
```

An offline export of existing candidates can be supplied with `--existing existing-places.json`. If server-only `SUPABASE_SERVICE_ROLE_KEY` and the project URL are present locally, the command reads existing candidates directly without printing credentials.

Apply mode is intentionally gated and must not be used without explicit production approval:

```sh
npm run places:import -- path/to/tel-aviv-places.json --apply --confirm APPLY_PLACES
```

Apply is blocked when any row fails or needs review. Exact source/provider identities may update only with `--allow-updates`; before-state JSON is written before updates. Every inserted/updated row receives a batch UUID. New rows can be cleaned up by `import_batch_id`; updates use the generated before-state backup for rollback.
