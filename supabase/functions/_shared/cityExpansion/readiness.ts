export interface ReadinessDimensions {
  contentCoverage: number; providerQuality: number; technicalComplexity: number;
  localizationReadiness: number; geographicDataQuality: number; expectedFamilyDemand: number; operationalRisk: number;
}
export interface ReadinessResult { score: number; recommendation: 'GO' | 'CONDITIONAL_GO' | 'NO_GO'; reasons: string[] }

export function scoreExpansionReadiness(input: ReadinessDimensions): ReadinessResult {
  const positive = input.contentCoverage * .2 + input.providerQuality * .18 + input.technicalComplexity * .13
    + input.localizationReadiness * .14 + input.geographicDataQuality * .12 + input.expectedFamilyDemand * .13;
  const score = Math.max(0, Math.min(100, Math.round(positive + (100 - input.operationalRisk) * .1)));
  const reasons: string[] = [];
  if (input.contentCoverage < 60) reasons.push('content_coverage_incomplete');
  if (input.providerQuality < 60) reasons.push('provider_quality_needs_validation');
  if (input.localizationReadiness < 70) reasons.push('localization_requires_review');
  if (input.geographicDataQuality < 70) reasons.push('geographic_bounds_require_validation');
  if (input.operationalRisk > 60) reasons.push('operational_risk_high');
  return { score, recommendation: score >= 80 && reasons.length === 0 ? 'GO' : score >= 55 ? 'CONDITIONAL_GO' : 'NO_GO', reasons };
}
