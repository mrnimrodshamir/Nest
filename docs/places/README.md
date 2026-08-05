# Internal Places import

The CSV and JSON files in this folder document the provider-neutral curation format. They contain fictional development data only.

`dryRunPlaceImport` validates every row, reports row-numbered errors, checks coordinate and age ranges, validates HTTPS image URLs, and detects duplicate provider IDs or the same normalized name within 50 metres. It returns a preview summary and valid normalized rows but performs no database writes. Indexed provider/name lookup keeps duplicate checks practical for thousands of rows.

`exportPlacesCsv` and `exportPlacesJson` produce reviewable backups using the same provider-neutral format. Arrays use `|` separators in CSV. A future authenticated internal tool may review dry-run output and write with service-role credentials kept outside the mobile app.

Phase 2 optional columns include `cover_image_url`, `gallery_image_urls`, `place_origin`, and `partner_tags`. Image validation is deliberately syntactic; the platform does not download remote files during dry runs.

Production curation must verify every place and its family-friendly attributes before setting `verification_status = 'verified'`. Never import these sample rows into production.
