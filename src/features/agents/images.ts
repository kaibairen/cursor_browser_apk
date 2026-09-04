import * as ImagePicker from 'expo-image-picker';
import { EncodingType, readAsStringAsync } from 'expo-file-system/legacy';
import type { PromptImage } from '../../lib/cursor/types';

export type PickedImage = {
  uri: string;
  mimeType: string;
  fileName: string;
};

const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
export const MAX_PROMPT_IMAGES = 5;
const MAX_BYTES = 15 * 1024 * 1024;

function inferMime(uri: string, fallback?: string | null): string {
  if (fallback && ALLOWED.has(fallback)) return fallback;
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

export async function pickImages(existingCount: number): Promise<PickedImage[]> {
  const remain = MAX_PROMPT_IMAGES - existingCount;
  if (remain <= 0) {
    throw new Error('最多附加 5 张图片');
  }
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('需要相册权限才能附加图片');
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: remain,
    quality: 0.85,
  });
  if (result.canceled) return [];
  return result.assets.map((asset, index) => ({
    uri: asset.uri,
    mimeType: inferMime(asset.uri, asset.mimeType),
    fileName: asset.fileName ?? `image-${index + 1}`,
  }));
}

export async function toPromptImages(picked: PickedImage[]): Promise<PromptImage[]> {
  if (picked.length > MAX_PROMPT_IMAGES) {
    throw new Error('最多附加 5 张图片');
  }
  const images: PromptImage[] = [];
  for (const item of picked) {
    if (!ALLOWED.has(item.mimeType)) {
      throw new Error(`不支持的图片类型：${item.mimeType}`);
    }
    const data = await readAsStringAsync(item.uri, { encoding: EncodingType.Base64 });
    if (data.length * 0.75 > MAX_BYTES) {
      throw new Error(`${item.fileName} 超过 15MB`);
    }
    images.push({ data, mimeType: item.mimeType });
  }
  return images;
}
