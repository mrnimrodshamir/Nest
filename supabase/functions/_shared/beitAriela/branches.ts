/** Beit Ariela / Tel Aviv Libraries branch → coordinates.
 *
 *  ariela.today publishes a venue NAME and a text address per event, but no
 *  latitude/longitude anywhere on the page — confirmed by fetching and
 *  inspecting the live listing and detail markup directly, not assumed.
 *  events.latitude/longitude are NOT NULL, so something has to supply them.
 *
 *  Every entry below is one of three provenance levels, and each row says
 *  which:
 *
 *   PLACES  — read from NestUp's own already-curated `public.places` table,
 *             where these branches already exist with verified coordinates
 *             (queried 2026-08-18). Nothing to verify further; it is real,
 *             previously-vetted product data.
 *
 *   ALIAS   — the branch's own event page gives an address that is IDENTICAL
 *             to an existing PLACES entry's address (e.g. "הסלון העירוני"
 *             publishes the exact same street address as the main Beit
 *             Ariela building). No new coordinate, just recognising the same
 *             building under a second name.
 *
 *   GEOCODE — the branch's own event page gives a real street address (e.g.
 *             "דם המכבים 22" for Ramat Israel-Bitzaron) that does not match
 *             anything already known, resolved via OpenStreetMap's public
 *             Nominatim geocoder on 2026-08-18. This is standard address
 *             resolution of text the source itself published, not an
 *             estimate — each result was checked against Nominatim's own
 *             returned neighbourhood name matching the expected one before
 *             being accepted (e.g. the "אבא קובנר 16" query independently
 *             confirmed "כוכב הצפון" as the neighbourhood, matching the
 *             branch name). One low-confidence result (a supermarket POI for
 *             "אחד העם 9") was discarded and re-queried by landmark name
 *             instead of accepted as-is.
 *
 *  A branch name that appears on ariela.today but has no entry here is NOT
 *  filled in with a guess. mapping.ts excludes it — reason
 *  'coordinates_unresolved' — and that shows up honestly in sync/dry-run
 *  reporting rather than silently placing an event in the wrong
 *  neighborhood. */
export interface BeitArielaBranch {
  latitude: number;
  longitude: number;
  formattedAddress: string;
}

export const BEIT_ARIELA_BRANCHES: Readonly<Record<string, BeitArielaBranch>> = {
  // --- PLACES: from NestUp's own curated places table ----------------------
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

  // --- ALIAS: identical address to a row above ------------------------------
  // "הסלון העירוני" (The Municipal Salon) publishes the exact same address
  // as the main Beit Ariela building on its own event detail pages — it is
  // co-located, not a separate coordinate.
  'הסלון העירוני': { latitude: 32.076704, longitude: 34.786295, formattedAddress: 'Shaul HaMelech Boulevard 25, Tel Aviv-Yafo, Israel' },
  // "ספריית בית השחמט" publishes "טאגור 26" — the same address as the Chess
  // Center / Sissy and Marc Sol Library entry above.
  'ספריית בית השחמט': { latitude: 32.115777, longitude: 34.796976, formattedAddress: 'Tagore Street 26, Tel Aviv-Yafo, Israel' },

  // --- GEOCODE: real source-published address, resolved 2026-08-18 --------
  // Nominatim independently returned "כוכב הצפון" as the neighbourhood for
  // this address, confirming the match to the branch name.
  'ספריית כוכב הצפון': { latitude: 32.101355, longitude: 34.785668, formattedAddress: "Abba Kovner Street 16, Tel Aviv-Yafo, Israel" },
  // Nominatim independently returned "ביצרון ורמת ישראל" as the
  // neighbourhood — an exact match to the branch name.
  'ספריית רמת ישראל — ביצרון': { latitude: 32.068639, longitude: 34.800462, formattedAddress: 'Dam HaMakabim Street 22, Tel Aviv-Yafo, Israel' },
  // Resolved by landmark name after the street-address query returned a
  // low-confidence supermarket POI, which was discarded rather than kept.
  'ספריית מגדל שלום': { latitude: 32.064242, longitude: 34.769704, formattedAddress: 'Migdal Shalom Meir, Tel Aviv-Yafo, Israel' },
  'ספריית ניסטור': { latitude: 32.085916, longitude: 34.771511, formattedAddress: 'Lasal Street 7, Tel Aviv-Yafo, Israel' },
  // Nominatim independently returned "צהלה" as the neighbourhood — an exact
  // match to the branch name.
  'ספריית צהלה': { latitude: 32.124794, longitude: 34.831915, formattedAddress: 'Avner Street 1, Tel Aviv-Yafo, Israel' },
  // Nominatim independently returned "יפו" (Jaffa) — matching "מנדל ביפו"
  // ("Mandel in Jaffa"), distinct from the Mandel Library entry above.
  'ספריית מנדל ביפו': { latitude: 32.05126, longitude: 34.759937, formattedAddress: 'HaTkuma Street 1, Tel Aviv-Yafo, Israel' },
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
