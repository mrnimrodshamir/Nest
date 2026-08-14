import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import type { TranslationKey } from './en';
import { identify, setAnalyticsContext, track } from '@/lib/analytics';
import {
  coerceLocalePreference,
  isRtlLocale,
  resolveLocale,
  setActiveDateLocale,
  translate,
  type AppLocale,
  type LocalePreference,
  type TranslateParams,
} from './core';

const STORAGE_KEY = 'nestup.locale.preference';

interface I18nContextValue {
  locale: AppLocale;
  preference: LocalePreference;
  isRTL: boolean;
  /** True once a chosen language needs a relaunch to fully mirror layout.
   *  `I18nManager.forceRTL` only takes effect on the NEXT launch, so the
   *  selector has to say so rather than silently half-applying. */
  needsRestart: boolean;
  t: (key: TranslationKey, params?: TranslateParams) => string;
  setPreference: (next: LocalePreference) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function deviceLanguageTags(): string[] {
  try {
    return Localization.getLocales().map((entry) => entry.languageTag);
  } catch {
    // Never let locale detection be the thing that stops the app booting.
    return [];
  }
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<LocalePreference>('system');
  const [deviceTags] = useState<string[]>(deviceLanguageTags);
  // The layout direction the *native* side is currently running with. Compared
  // against the resolved locale to decide whether a relaunch is still pending.
  const [nativeRTL] = useState<boolean>(() => I18nManager.isRTL);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        const parsed = coerceLocalePreference(stored);
        if (!cancelled && parsed) setPreferenceState(parsed);
      })
      .catch(() => {
        // A read failure just means "no preference yet" — fall back to device.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const locale = useMemo(() => resolveLocale(deviceTags, preference), [deviceTags, preference]);
  const isRTL = isRtlLocale(locale);

  // Set this before children render so even their first mount event (including
  // app_opened) receives the resolved language. This only mutates the local,
  // in-memory analytics context; it performs no I/O during render.
  setAnalyticsContext({ language: locale });

  // Set synchronously during render, not in an effect: the date formatters are
  // called by children on this same pass, and an effect would leave the first
  // render formatting dates in the previous language.
  setActiveDateLocale(locale);

  useEffect(() => {
    // Allow RTL always; force it to match the resolved locale. Both are no-ops
    // when already correct, and neither re-lays-out the current session.
    I18nManager.allowRTL(true);
    if (I18nManager.isRTL !== isRTL) I18nManager.forceRTL(isRTL);
  }, [isRTL]);

  const setPreference = useCallback((next: LocalePreference) => {
    setPreferenceState(next);
    track('language_changed', { language: next });
    identify({ language: next });
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {
      // Persisting is best-effort: the choice still applies to this session.
    });
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      preference,
      isRTL,
      needsRestart: nativeRTL !== isRTL,
      t: (key, params) => translate(locale, key, params),
      setPreference,
    }),
    [locale, preference, isRTL, nativeRTL, setPreference],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used inside <I18nProvider>');
  return context;
}

/** Convenience for the common case of only needing the translate function. */
export function useTranslation() {
  return useI18n().t;
}

export { STORAGE_KEY as LOCALE_STORAGE_KEY };
