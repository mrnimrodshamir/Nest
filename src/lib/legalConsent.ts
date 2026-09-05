import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from '@/constants/legal';
import { supabase } from '@/lib/supabase';

export type LegalConsentStatus = 'loading' | 'required' | 'accepted';

export async function readCurrentLegalConsent(userId: string): Promise<boolean> {
  const { data, error } = await supabase.from('legal_acceptances')
    .select('terms_version, privacy_version').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data?.terms_version === CURRENT_TERMS_VERSION
    && data?.privacy_version === CURRENT_PRIVACY_VERSION;
}

export async function persistCurrentLegalConsent(): Promise<void> {
  const { error } = await supabase.rpc('record_legal_acceptance', {
    p_terms_version: CURRENT_TERMS_VERSION,
    p_privacy_version: CURRENT_PRIVACY_VERSION,
  });
  if (error) throw error;
}
