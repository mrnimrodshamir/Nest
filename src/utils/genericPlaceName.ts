/** "The parent dropped a pin and there is no place name for it."
 *
 *  This is a UI placeholder, NOT a place name, and conflating the two is what
 *  produced "טיול עגלות ב־Meeting point" on a Hebrew device: the English words
 *  were being stored as the location's name and then interpolated straight into
 *  a generated Hebrew title.
 *
 *  The token stays English and stays stable because it is already persisted in
 *  existing rows, and rewriting stored data is a migration this release does not
 *  need. What changes is that it is now written from exactly one place, and no
 *  display path is ever allowed to render it raw — every one resolves it through
 *  the `locationPicker.meetingPoint` key, which exists in all six languages.
 *
 *  Treat it the way you would treat an enum value that happens to be spelled in
 *  English: fine in the database, never on screen.
 */
export const GENERIC_PLACE_NAME = 'Meeting point';

/** True when a stored name carries no real place information and should be
 *  displayed as the localized placeholder.
 *
 *  Accepts the empty string as well as the token, and compares case- and
 *  whitespace-insensitively against `en-US` so a legacy row written as
 *  "meeting point" or " Meeting Point " is still recognised. Locale-independent
 *  lowercasing matters here: `toLocaleLowerCase()` under a Turkish device
 *  locale would not match. */
export function isGenericPlaceName(value: string | null | undefined): boolean {
  const normalized = value?.trim().toLocaleLowerCase('en-US') ?? '';
  return normalized === '' || normalized === GENERIC_PLACE_NAME.toLocaleLowerCase('en-US');
}
