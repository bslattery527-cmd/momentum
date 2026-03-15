import { api } from '@/lib/api';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ImageAsset {
  uri: string;
  mimeType: string;
  fileSize: number;
}

export interface PresignedUploadResult {
  image_id: string;
  upload_url: string;
  public_url: string;
}

export interface UploadProgress {
  /** Index of the image currently being uploaded (0-based) */
  index: number;
  /** Fraction 0-1 for the current image */
  fraction: number;
}

// ── Phase 1: Request pre-signed URLs from the API ────────────────────────────

export async function requestPresignedUrls(
  images: { mime_type: string; file_size: number }[],
): Promise<PresignedUploadResult[]> {
  const response = await api.post('/logs/image-upload', { images });
  return response.data as PresignedUploadResult[];
}

// ── Phase 2: Upload a single image directly to S3 ───────────────────────────

export async function uploadImageToS3(
  uploadUrl: string,
  imageUri: string,
  mimeType: string,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  // Fetch the image as a blob from the local file URI
  const response = await fetch(imageUri);
  const blob = await response.blob();

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl, true);
    xhr.setRequestHeader('Content-Type', mimeType);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(event.loaded / event.total);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`S3 upload failed with status ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error('S3 upload network error'));
    xhr.ontimeout = () => reject(new Error('S3 upload timed out'));

    xhr.send(blob);
  });
}

// ── Full flow: request URLs → upload all → return image IDs ─────────────────

export async function uploadImages(
  imageAssets: ImageAsset[],
  onProgress?: (progress: UploadProgress) => void,
): Promise<string[]> {
  if (imageAssets.length === 0) return [];
  if (imageAssets.length > 4) {
    throw new Error('Maximum 4 images allowed per log');
  }

  // Phase 1: get pre-signed URLs
  const presignedResults = await requestPresignedUrls(
    imageAssets.map((img) => ({
      mime_type: img.mimeType,
      file_size: img.fileSize,
    })),
  );

  // Phase 2: upload each image to S3 in parallel
  await Promise.all(
    presignedResults.map((result, index) =>
      uploadImageToS3(
        result.upload_url,
        imageAssets[index].uri,
        imageAssets[index].mimeType,
        (fraction) => onProgress?.({ index, fraction }),
      ),
    ),
  );

  // Return the image IDs for use in POST /logs
  return presignedResults.map((r) => r.image_id);
}
