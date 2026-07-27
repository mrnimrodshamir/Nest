import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { supabase } from '@/lib/supabase';

/** Uploads a local image URI (from expo-image-picker) to the user's avatar
 *  slot in Supabase Storage and returns its public URL. RN's fetch().blob()
 *  is unreliable against Supabase Storage (frequently uploads 0 bytes), so
 *  we read as base64 and decode to an ArrayBuffer instead. */
export async function uploadAvatar(userId: string, localUri: string): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const extension = localUri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const path = `${userId}/avatar.${extension}`;
  const contentType = extension === 'png' ? 'image/png' : 'image/jpeg';

  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, decode(base64), { contentType, upsert: true });
  if (error) throw error;

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  // Cache-bust so the new photo shows immediately after re-upload.
  return `${data.publicUrl}?t=${Date.now()}`;
}
