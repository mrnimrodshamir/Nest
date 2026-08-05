import { buildWhatsAppUrl } from '@/utils/contentSharing';

export interface ShareDependencies {
  canOpenURL: (url: string) => Promise<boolean>;
  openURL: (url: string) => Promise<unknown>;
  share: (payload: { message: string }) => Promise<unknown>;
}

async function resolveDependencies(dependencies?: ShareDependencies): Promise<ShareDependencies> {
  if (dependencies) return dependencies;
  const { Linking, Share } = await import('react-native');
  return { canOpenURL: Linking.canOpenURL, openURL: Linking.openURL, share: Share.share };
}

export async function openNativeShare(
  message: string,
  dependencies?: ShareDependencies,
): Promise<'opened' | 'dismissed'> {
  try {
    await (await resolveDependencies(dependencies)).share({ message });
    return 'opened';
  } catch {
    return 'dismissed';
  }
}

export async function openWhatsAppShare(
  message: string,
  dependencies?: ShareDependencies,
): Promise<'whatsapp' | 'native' | 'dismissed'> {
  const resolved = await resolveDependencies(dependencies);
  const url = buildWhatsAppUrl(message);
  try {
    if (await resolved.canOpenURL(url)) {
      await resolved.openURL(url);
      return 'whatsapp';
    }
  } catch {
    // Fall through to the native share sheet when WhatsApp cannot open.
  }
  return (await openNativeShare(message, resolved)) === 'opened' ? 'native' : 'dismissed';
}
