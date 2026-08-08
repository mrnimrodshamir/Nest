import { buildWhatsAppUrl } from '@/utils/contentSharing';

export interface ShareDependencies {
  canOpenURL: (url: string) => Promise<boolean>;
  openURL: (url: string) => Promise<unknown>;
  share: (payload: { message: string }) => Promise<unknown>;
}

/** Resolves React Native's Linking/Share.
 *
 *  THE METHODS MUST BE WRAPPED, NEVER PASSED BY REFERENCE.
 *
 *  `{ canOpenURL: Linking.canOpenURL }` detaches the function from its object.
 *  RN's Linking is a class instance (LinkingImpl extends NativeEventEmitter)
 *  and Share's statics reference themselves, so both use `this` internally.
 *  Called detached, `this` is the plain deps object and the call throws — which
 *  is how WhatsApp and native share both broke on device while every unit test
 *  passed, because the tests inject plain-function mocks that need no receiver.
 *
 *  Arrow wrappers keep the correct receiver. Do not "simplify" them back. */
async function resolveDependencies(dependencies?: ShareDependencies): Promise<ShareDependencies> {
  if (dependencies) return dependencies;
  const { Linking, Share } = await import('react-native');
  return {
    canOpenURL: (url) => Linking.canOpenURL(url),
    openURL: (url) => Linking.openURL(url),
    share: (payload) => Share.share(payload),
  };
}

/** Guards against a double tap opening two share sheets. iOS will reject the
 *  second presentation, which previously surfaced as an unhandled rejection. */
let inFlight = false;

export type NativeShareResult = 'opened' | 'dismissed' | 'unavailable';

/** Opens the iOS share sheet.
 *
 *  NEVER REJECTS. Every caller uses `void openNativeShare(...)`, so a rejection
 *  here is an unhandled promise rejection — fatal in a release build. Cancelling
 *  the sheet is a normal outcome, not an error. */
export async function openNativeShare(
  message: string,
  dependencies?: ShareDependencies,
): Promise<NativeShareResult> {
  if (!message || !message.trim()) return 'unavailable';
  if (inFlight) return 'dismissed';
  inFlight = true;
  try {
    const resolved = await resolveDependencies(dependencies);
    await resolved.share({ message });
    return 'opened';
  } catch (error) {
    // Covers user cancellation and any native failure. Logged, never thrown.
    console.log('[Share] native share unavailable', error instanceof Error ? error.message : error);
    return 'dismissed';
  } finally {
    inFlight = false;
  }
}

export type WhatsAppShareResult = 'whatsapp' | 'native' | 'dismissed' | 'unavailable';

/** Shares general content to WhatsApp, falling back to the native sheet.
 *
 *  NEVER REJECTS, for the same reason as above. Sends a message only — never a
 *  recipient — so this can never become direct contact with a venue or an
 *  organiser. */
export async function openWhatsAppShare(
  message: string,
  dependencies?: ShareDependencies,
): Promise<WhatsAppShareResult> {
  if (!message || !message.trim()) return 'unavailable';

  let resolved: ShareDependencies;
  try {
    // Previously outside the try: a failure resolving the native modules
    // escaped as an unhandled rejection instead of falling back.
    resolved = await resolveDependencies(dependencies);
  } catch (error) {
    console.log('[Share] could not resolve share modules', error instanceof Error ? error.message : error);
    return 'unavailable';
  }

  try {
    const url = buildWhatsAppUrl(message);
    // canOpenURL returns false (not throws) when the scheme is undeclared in
    // LSApplicationQueriesSchemes, so the fallback below is the normal path on
    // a device without WhatsApp.
    if (await resolved.canOpenURL(url)) {
      await resolved.openURL(url);
      return 'whatsapp';
    }
  } catch (error) {
    console.log('[Share] WhatsApp unavailable, falling back', error instanceof Error ? error.message : error);
  }

  const native = await openNativeShare(message, resolved);
  return native === 'opened' ? 'native' : native === 'unavailable' ? 'unavailable' : 'dismissed';
}

/** Test-only: clears the double-tap guard between cases. */
export function __resetShareGuard(): void {
  inFlight = false;
}
