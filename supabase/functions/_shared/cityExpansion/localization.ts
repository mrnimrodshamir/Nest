export interface LocalizationEntry { source: string; localized: Record<string, string>; confidence: number; requiresReview: boolean }
export interface LocalizationPlan {
  schemaVersion: '1.0'; cityId: string; cityDisplayNames: Record<string, string>;
  placeNames: LocalizationEntry[]; neighborhoodNames: LocalizationEntry[];
  sourceDisplayNames: LocalizationEntry[]; categoryLabels: Record<string, Record<string, string>>;
  preservedContentKinds: string[]; unresolvedNames: string[];
}

export function shouldPreserveVerbatim(kind: 'user_content' | 'user_name' | 'child_name' | 'provider_title' | 'provider_description' | 'system_label' | 'known_place'): boolean {
  return kind === 'user_content' || kind === 'user_name' || kind === 'child_name' || kind === 'provider_title' || kind === 'provider_description';
}

export function validateLocalizationPlan(plan: LocalizationPlan): string[] {
  const errors: string[] = [];
  for (const locale of ['en', 'he', 'fr', 'ru', 'ar', 'es']) if (!plan.cityDisplayNames[locale]) errors.push(`missing_city_locale_${locale}`);
  if (!plan.preservedContentKinds.includes('user_generated')) errors.push('user_content_not_explicitly_preserved');
  if (!plan.preservedContentKinds.includes('provider_titles_and_descriptions')) errors.push('provider_content_not_explicitly_preserved');
  return errors;
}
