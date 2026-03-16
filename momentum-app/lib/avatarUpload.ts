import { api } from '@/lib/api';
import { isDemoMode } from '@/lib/demoApi';
import { uploadImageToS3 } from '@/lib/imageUpload';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

type SupportedMimeType = 'image/jpeg' | 'image/png' | 'image/webp';

export interface AvatarUploadAsset {
  uri: string;
  mimeType?: string | null;
  fileSize?: number | null;
}

interface AvatarUploadResponse {
  upload_url: string;
  public_url: string;
}

function getMimeTypeFromUri(uri: string): SupportedMimeType {
  const normalizedUri = uri.toLowerCase().split('?')[0];

  if (normalizedUri.endsWith('.png')) {
    return 'image/png';
  }
  if (normalizedUri.endsWith('.webp')) {
    return 'image/webp';
  }

  return 'image/jpeg';
}

export function resolveAvatarMimeType(asset: AvatarUploadAsset): SupportedMimeType {
  if (asset.mimeType && ALLOWED_MIME_TYPES.has(asset.mimeType)) {
    return asset.mimeType as SupportedMimeType;
  }

  return getMimeTypeFromUri(asset.uri);
}

async function resolveAvatarFileSize(asset: AvatarUploadAsset): Promise<number> {
  if (typeof asset.fileSize === 'number' && asset.fileSize > 0) {
    return asset.fileSize;
  }

  const response = await fetch(asset.uri);
  const blob = await response.blob();
  return blob.size;
}

export async function uploadAvatar(asset: AvatarUploadAsset): Promise<string> {
  if (isDemoMode()) {
    return asset.uri;
  }

  const mimeType = resolveAvatarMimeType(asset);
  const fileSize = await resolveAvatarFileSize(asset);

  const response = await api.post('/users/me/avatar-upload', {
    mime_type: mimeType,
    file_size: fileSize,
  });

  const { upload_url, public_url } = response.data as AvatarUploadResponse;

  await uploadImageToS3(upload_url, asset.uri, mimeType);

  return public_url;
}
