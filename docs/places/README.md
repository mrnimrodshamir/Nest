# Internal Places import

The CSV and JSON files in this folder document the provider-neutral curation format. They contain fictional development data only.

`dryRunPlaceImport` validates every row, reports row-numbered errors, and detects duplicate provider IDs or the same normalized name within 50 metres. It returns a summary and valid normalized rows but performs no database writes. A future authenticated internal tool may review that output and write with service-role credentials kept outside the mobile app.

Production curation must verify every place and its family-friendly attributes before setting `verification_status = 'verified'`. Never import these sample rows into production.
