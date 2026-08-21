export type CityId = 'tel_aviv' | 'ramat_gan' | 'givatayim';
export type CityLocale = 'en' | 'he' | 'fr' | 'ru' | 'ar' | 'es';

export interface CityConfig {
  id: CityId;
  canonicalName: string;
  displayNames: Record<CityLocale, string>;
  timezone: 'Asia/Jerusalem';
  currency: 'ILS';
  center: { latitude: number; longitude: number };
  defaultRadiusMeters: number;
  digestEnabled: boolean;
  boundary: { sourceUrl: string; sourceCode: string; polygon: readonly (readonly [number, number])[] };
}

const IPLAN_BOUNDARY_SOURCE = 'https://ags.iplan.gov.il/arcgisiplan/rest/services/PlanningPublic/gvulot_retzef/MapServer/1';

// Deterministically simplified (roughly 30 m tolerance) from the official
// Planning Administration CR_LAMAS=8600 boundary. Coordinates are [lon, lat].
const RAMAT_GAN_POLYGON = [[34.843271,32.072819],[34.844336,32.072502],[34.845462,32.07427],[34.846354,32.074122],[34.846884,32.075024],[34.85121,32.073208],[34.850288,32.069334],[34.848072,32.069491],[34.847125,32.070141],[34.847477,32.070861],[34.845534,32.071254],[34.845043,32.065311],[34.839308,32.064798],[34.836653,32.061072],[34.84082,32.060216],[34.84143,32.06234],[34.845683,32.061441],[34.845853,32.062035],[34.846713,32.06201],[34.854749,32.050422],[34.854264,32.050455],[34.845898,32.039538],[34.845487,32.038228],[34.84588,32.038171],[34.845827,32.036082],[34.835738,32.036904],[34.826332,32.038834],[34.824101,32.039741],[34.817971,32.043566],[34.813255,32.044683],[34.813919,32.047633],[34.813812,32.050846],[34.812464,32.053055],[34.81044,32.054849],[34.811809,32.058621],[34.815579,32.058485],[34.8188,32.059312],[34.819699,32.06245],[34.818018,32.063742],[34.814994,32.064855],[34.816249,32.066589],[34.818103,32.071381],[34.819395,32.078324],[34.820699,32.078244],[34.820751,32.078939],[34.819605,32.078985],[34.820057,32.080498],[34.813193,32.078023],[34.812567,32.079866],[34.812062,32.07993],[34.811364,32.079454],[34.808525,32.079944],[34.80498,32.079721],[34.805004,32.079209],[34.801419,32.078912],[34.801706,32.081139],[34.800986,32.081799],[34.800063,32.081491],[34.799136,32.084382],[34.801154,32.089352],[34.801799,32.092918],[34.802227,32.093394],[34.804233,32.090996],[34.8059,32.091391],[34.807067,32.091154],[34.807016,32.089774],[34.809337,32.090965],[34.808574,32.094383],[34.808716,32.094089],[34.809754,32.095082],[34.809719,32.096308],[34.812898,32.095732],[34.81447,32.09652],[34.815728,32.098166],[34.818229,32.097783],[34.819006,32.096238],[34.819968,32.096262],[34.822635,32.099136],[34.821256,32.101301],[34.824375,32.102493],[34.823014,32.103284],[34.823049,32.103719],[34.825192,32.104929],[34.827661,32.105566],[34.828529,32.09897],[34.821442,32.096743],[34.822667,32.090914],[34.822095,32.084932],[34.825071,32.084727],[34.827685,32.075425],[34.832354,32.075981],[34.83312,32.074872],[34.83289,32.071908],[34.839435,32.069981],[34.839137,32.06954],[34.841039,32.068995],[34.843271,32.072819]] as const;

// Deterministically simplified at approximately 30 m from the official
// Planning Administration CR_LAMAS=6300 jurisdiction boundary.
const GIVATAYIM_POLYGON = [[34.811809,32.058621],[34.815579,32.058485],[34.8188,32.059312],[34.818637,32.059749],[34.819699,32.06245],[34.818018,32.063742],[34.814994,32.064855],[34.816249,32.066589],[34.818103,32.071381],[34.819395,32.078324],[34.820699,32.078244],[34.820751,32.078939],[34.819605,32.078985],[34.820057,32.080498],[34.813193,32.078023],[34.812567,32.079866],[34.811364,32.079454],[34.808525,32.079944],[34.80498,32.079721],[34.805004,32.079209],[34.801419,32.078912],[34.801706,32.081139],[34.800986,32.081799],[34.798131,32.080785],[34.797873,32.0802],[34.801682,32.077924],[34.802114,32.077219],[34.800623,32.072902],[34.80258,32.070445],[34.802135,32.069967],[34.802824,32.066036],[34.803798,32.066118],[34.803873,32.065566],[34.804506,32.065617],[34.80577,32.062898],[34.805609,32.062154],[34.806154,32.061616],[34.808069,32.06044],[34.810727,32.059697],[34.810587,32.058832],[34.811809,32.058621]] as const;

export const CITIES: Record<CityId, CityConfig> = {
  tel_aviv: {
    id: 'tel_aviv', canonicalName: 'Tel Aviv-Yafo',
    displayNames: { en: 'Tel Aviv-Yafo', he: 'תל אביב-יפו', fr: 'Tel-Aviv-Jaffa', ru: 'Тель-Авив-Яффо', ar: 'تل أبيب-يافا', es: 'Tel Aviv-Yafo' },
    timezone: 'Asia/Jerusalem', currency: 'ILS', center: { latitude: 32.0853, longitude: 34.7818 },
    defaultRadiusMeters: 12_000, digestEnabled: true,
    boundary: { sourceUrl: 'https://gisn.tel-aviv.gov.il/', sourceCode: 'tel_aviv_yafo', polygon: [] },
  },
  ramat_gan: {
    id: 'ramat_gan', canonicalName: 'Ramat Gan',
    displayNames: { en: 'Ramat Gan', he: 'רמת גן', fr: 'Ramat Gan', ru: 'Рамат-Ган', ar: 'رمات غان', es: 'Ramat Gan' },
    timezone: 'Asia/Jerusalem', currency: 'ILS', center: { latitude: 32.0821, longitude: 34.8148 },
    defaultRadiusMeters: 6_000, digestEnabled: false,
    boundary: { sourceUrl: IPLAN_BOUNDARY_SOURCE, sourceCode: '8600', polygon: RAMAT_GAN_POLYGON },
  },
  givatayim: {
    id: 'givatayim', canonicalName: 'Givatayim',
    displayNames: { en: 'Givatayim', he: 'גבעתיים', fr: 'Givatayim', ru: 'Гиватаим', ar: 'جفعاتايم', es: 'Givatayim' },
    timezone: 'Asia/Jerusalem', currency: 'ILS', center: { latitude: 32.0714, longitude: 34.81 },
    defaultRadiusMeters: 5_000, digestEnabled: false,
    boundary: { sourceUrl: IPLAN_BOUNDARY_SOURCE, sourceCode: '6300', polygon: GIVATAYIM_POLYGON },
  },
};

export function resolveCityForCoordinate(latitude: number, longitude: number): CityId | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  // Check the precise Ramat Gan boundary first. Tel Aviv is the legacy
  // fallback because its metropolitan viewport intentionally overlaps.
  if (pointInPolygon(longitude, latitude, GIVATAYIM_POLYGON)) return 'givatayim';
  if (pointInPolygon(longitude, latitude, RAMAT_GAN_POLYGON)) return 'ramat_gan';
  if (latitude >= 32.02 && latitude <= 32.15 && longitude >= 34.73 && longitude < 34.84) return 'tel_aviv';
  return null;
}

function pointInPolygon(x: number, y: number, polygon: readonly (readonly [number, number])[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]; const [xj, yj] = polygon[j];
    const intersects = (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}
