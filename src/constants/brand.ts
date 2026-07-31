/** The single source of truth for the product's visible name. The app is
 *  expected to be renamed later (after checking iOS App Store name
 *  availability) — every user-facing string that mentions the product by
 *  name should import APP_NAME from here rather than hard-coding "Momzi",
 *  so that rename touches one file instead of grepping the whole app.
 *
 *  Deliberately NOT used for: app.json's expo.name/scheme (native config,
 *  read at build time, can't reference a JS constant), the bundle
 *  identifier, database/table names, or the momzi:// deep link scheme —
 *  all of those are real technical identifiers a rename may or may not
 *  touch, and changing them is a separate, more careful migration. See
 *  the rename checklist in the project docs for the full list. */
export const APP_NAME = 'Momzi';
