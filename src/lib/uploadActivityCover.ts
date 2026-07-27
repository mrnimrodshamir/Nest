import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { decode } from 'base64-arraybuffer';
import { supabase } from '@/lib/supabase';

export type CoverUploadStage = 'compressing' | 'uploading';

/** Uploads an activity cover photo: compresses/resizes first (keeps the
 *  file small and consistent regardless of the source camera resolution),
 *  then uploads. Mirrors uploadAvatar's base64->ArrayBuffer approach since
 *  RN's fetch().blob() is unreliable against Supabase Storage. */
export async function uploadActivityCover(
  activityId: string,
  localUri: string,
  onStage?: (stage: CoverUploadStage) => void,
): Promise<string> {
  onStage?.('compressing');
  const manipulated = await ImageManipulator.manipulateAsync(
    localUri,
    [{ resize: { width: 1200 } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
  );

  onStage?.('uploading');
  const base64 = await FileSystem.readAsStringAsync(manipulated.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const path = `${activityId}/cover.jpg`;

  const { error } = await supabase.storage
    .from('activity-covers')
    .upload(path, decode(base64), { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;

  const { data } = supabase.storage.from('activity-covers').getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}
