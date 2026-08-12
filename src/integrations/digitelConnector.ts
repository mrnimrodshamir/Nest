/** DigiTel connector — re-export shim.
 *
 *  The implementation moved to supabase/functions/_shared/digitel/connector.ts
 *  so the scheduled Edge Function and the app-side tooling run the SAME parsing,
 *  validation, normalization and fingerprint code. Edge Functions bundle only
 *  what lives under supabase/functions/, which is why the shared copy is the one
 *  that moved rather than the one that stayed.
 *
 *  This file exists so every existing `@/integrations/digitelConnector` import
 *  and its tests keep working unchanged. Do not add logic here. */
export * from '../../supabase/functions/_shared/digitel/connector.ts';
