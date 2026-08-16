import { currentAppLocale, translate } from '@/i18n/core';

export type ActivityFormMode = 'create' | 'edit' | 'again';

export interface ActivityFormModeBehavior {
  showsReview: boolean;
  autoSelectsCurrentDefaultChild: boolean;
  requiresExplicitStartTime: boolean;
  createsNewActivity: boolean;
}

export function resolveActivityFormMode(mode: ActivityFormMode): ActivityFormModeBehavior {
  switch (mode) {
    case 'create':
      return {
        showsReview: true,
        autoSelectsCurrentDefaultChild: true,
        requiresExplicitStartTime: false,
        createsNewActivity: true,
      };
    case 'edit':
      return {
        showsReview: false,
        autoSelectsCurrentDefaultChild: false,
        requiresExplicitStartTime: false,
        createsNewActivity: false,
      };
    case 'again':
      return {
        showsReview: true,
        autoSelectsCurrentDefaultChild: true,
        requiresExplicitStartTime: true,
        createsNewActivity: true,
      };
  }
}

export function startTimeValidationMessage(
  mode: ActivityFormMode,
  hasSelectedStartTime: boolean,
): string | null {
  return resolveActivityFormMode(mode).requiresExplicitStartTime && !hasSelectedStartTime
    ? translate(currentAppLocale(), 'activityForm.newDateTimeRequired')
    : null;
}
