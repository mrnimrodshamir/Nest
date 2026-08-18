/** Beit Ariela / Tel Aviv Libraries branch → coordinates.
 *
 *  ariela.today publishes a venue NAME and a text address per event, but no
 *  latitude/longitude anywhere on the page — confirmed by fetching and
 *  inspecting the live listing and detail markup directly, not assumed.
 *  events.latitude/longitude are NOT NULL, so something has to supply them.
 *
 *  The values below are NOT geocoded, estimated or invented. They are read
 *  directly from NestUp's own already-curated `public.places` table, where
 *  these library branches already exist with verified coordinates (queried
 *  2026-08-18). Reusing that is the honest option: it is real, previously
 *  vetted data already living inside this product, rather than a fabricated
 *  GPS pin or a new, uncontrolled geocoding dependency.
 *
 *  A branch name that appears on ariela.today but has no entry here is NOT
 *  filled in with a guess. mapping.ts excludes it — reason
 *  'coordinates_unresolved' — and that shows up honestly in sync/dry-run
 *  reporting rather than silently placing an event in the wrong
 *  neighborhood. Expanding this table (matching a new branch name to a real,
 *  verified coordinate) is exactly how that gap closes over time. */
export interface BeitArielaBranch {
  latitude: number;
  longitude: number;
  formattedAddress: string;
}

export const BEIT_ARIELA_BRANCHES: Readonly<Record<string, BeitArielaBranch>> = {
  'בית אריאלה': { latitude: 32.076704, longitude: 34.786295, formattedAddress: 'Shaul HaMelech Boulevard 25, Tel Aviv-Yafo, Israel' },
  'ספריית שרמן': { latitude: 32.050212, longitude: 34.776313, formattedAddress: 'Mesilat Yesharim Street 27, Tel Aviv-Yafo, Israel' },
  'ספריית הדר יוסף': { latitude: 32.107983, longitude: 34.822131, formattedAddress: 'Yosef Kitzis Street 23, Tel Aviv-Yafo, Israel' },
  'ספריית בת ציון': { latitude: 32.062301, longitude: 34.796758, formattedAddress: 'Bat Zion Street 10, Tel Aviv-Yafo, Israel' },
  'ספריית בית דני': { latitude: 32.050661, longitude: 34.789228, formattedAddress: 'Kabir Lane 4, Tel Aviv-Yafo, Israel' },
  // The site's own card text ("בית יד לבנים") differs slightly from the
  // curated place name ("Yad Lebanim Library") — matched on meaning, not
  // string equality, and verified against the real address on both sides.
  'בית יד לבנים': { latitude: 32.091669, longitude: 34.793026, formattedAddress: 'David Zvi Pinkas Street 63, Tel Aviv-Yafo, Israel' },
  'ספריית יד לבנים': { latitude: 32.091669, longitude: 34.793026, formattedAddress: 'David Zvi Pinkas Street 63, Tel Aviv-Yafo, Israel' },
  'ספריית רמת אביב ג׳': { latitude: 32.127003, longitude: 34.805001, formattedAddress: 'Yehiel Dov Drezner Street 2, Tel Aviv-Yafo, Israel' },
  'ספריית יפו ג׳': { latitude: 32.033169, longitude: 34.748052, formattedAddress: 'Isaac Harif Street 21, Tel Aviv-Yafo, Israel' },
  'ספריית נווה אליעזר': { latitude: 32.0459871, longitude: 34.8095674, formattedAddress: 'Sheshet HaYamim Street 6, Tel Aviv-Yafo, Israel' },
  'מרכז המוזיקה והספרייה ע״ש פליציה בלומנטל': { latitude: 32.0732474, longitude: 34.7712028, formattedAddress: 'Haim Nahman Bialik Street 26, Tel Aviv-Yafo, Israel' },
  'מרכז השחמט וספריית סיסי ומארק סול': { latitude: 32.115777, longitude: 34.796976, formattedAddress: 'Tagore Street 26, Tel Aviv-Yafo, Israel' },
  'ספריית ומרכז תרבות מנדל': { latitude: 32.051194, longitude: 34.760256, formattedAddress: 'HaTchiya Street 2, Tel Aviv-Yafo, Israel' },
  'ספריית אנה לורה פטליק פישר': { latitude: 32.0411612, longitude: 34.7471627, formattedAddress: 'Kedem Street 109, Tel Aviv-Yafo, Israel' },
};

/** Loose match: strips the generic "ספריית" (library) prefix and trims, so a
 *  card that reads "ספריית שרמן" and one that reads "שרמן" both resolve —
 *  the venue text on listing cards and detail pages is not always phrased
 *  identically for the same branch. */
export function resolveBranchCoordinates(venueName: string): BeitArielaBranch | null {
  const trimmed = venueName.trim();
  if (BEIT_ARIELA_BRANCHES[trimmed]) return BEIT_ARIELA_BRANCHES[trimmed];
  const withoutPrefix = trimmed.replace(/^ספריית\s+/, '').trim();
  const match = Object.entries(BEIT_ARIELA_BRANCHES).find(
    ([name]) => name.replace(/^ספריית\s+/, '').trim() === withoutPrefix,
  );
  return match ? match[1] : null;
}
