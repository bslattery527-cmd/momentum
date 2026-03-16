import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

import { PrismaClient } from '../../generated/prisma/index.js';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const PRESIGNED_URL_EXPIRY = 600; // 10 minutes in seconds
const MAX_IMAGES_PER_LOG = 4;

function getS3Client(): S3Client {
  const config: any = {
    region: process.env.S3_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
  };

  // Support Cloudflare R2 or other S3-compatible endpoints
  if (process.env.S3_ENDPOINT) {
    config.endpoint = process.env.S3_ENDPOINT;
    config.forcePathStyle = true;
  }

  return new S3Client(config);
}

function getMimeExtension(mimeType: string): string {
  switch (mimeType) {
    case 'image/jpeg': return 'jpg';
    case 'image/png': return 'png';
    case 'image/webp': return 'webp';
    default: return 'jpg';
  }
}

export function getPublicObjectUrl(s3Key: string): string {
  const bucket = process.env.S3_BUCKET_NAME || 'momentum-uploads';
  const cdnBase = process.env.CDN_BASE_URL || `https://${bucket}.s3.amazonaws.com`;
  return `${cdnBase.replace(/\/$/, '')}/${s3Key}`;
}

export interface ImageUploadRequest {
  mime_type: string;
  file_size: number;
}

export interface ImageUploadResult {
  image_id: string;
  upload_url: string;
  public_url: string;
}

/**
 * Validate image upload constraints.
 */
export function validateImageUploads(images: ImageUploadRequest[]): string | null {
  if (images.length > MAX_IMAGES_PER_LOG) {
    return `Maximum ${MAX_IMAGES_PER_LOG} images per log`;
  }

  for (const img of images) {
    if (!ALLOWED_MIME_TYPES.includes(img.mime_type)) {
      return `Invalid MIME type: ${img.mime_type}. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`;
    }
    if (img.file_size > MAX_FILE_SIZE) {
      return `File size exceeds maximum of 10 MB`;
    }
    if (img.file_size <= 0) {
      return `File size must be greater than 0`;
    }
  }

  return null; // valid
}

/**
 * Phase 1: Reserve image upload slots and generate pre-signed S3 PUT URLs.
 * Creates pending LogImage records (logId = null) that will be associated
 * with a log in Phase 3 (POST /logs with image_ids).
 */
export async function reserveImageUploads(
  prisma: PrismaClient,
  userId: string,
  images: ImageUploadRequest[],
): Promise<ImageUploadResult[]> {
  const s3 = getS3Client();
  const bucket = process.env.S3_BUCKET_NAME || 'momentum-uploads';

  const results: ImageUploadResult[] = [];

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const imageId = randomUUID();
    const ext = getMimeExtension(img.mime_type);
    const s3Key = `log-images/${imageId}.${ext}`;
    const publicUrl = getPublicObjectUrl(s3Key);

    // Create pending LogImage record (logId = null means pending)
    await prisma.logImage.create({
      data: {
        id: imageId,
        logId: null, // pending — will be associated when log is created
        s3Key,
        publicUrl,
        mimeType: img.mime_type,
        fileSize: img.file_size,
        sortOrder: i,
      },
    });

    // Generate pre-signed PUT URL
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: s3Key,
      ContentType: img.mime_type,
      ContentLength: img.file_size,
    });

    const uploadUrl = await getSignedUrl(s3, command, {
      expiresIn: PRESIGNED_URL_EXPIRY,
    });

    results.push({
      image_id: imageId,
      upload_url: uploadUrl,
      public_url: publicUrl,
    });
  }

  return results;
}

/**
 * Phase 3: Commit pending images to a log.
 * Associates LogImage records with the given logId.
 */
export async function commitImagesToLog(
  prisma: PrismaClient,
  logId: string,
  imageIds: string[],
): Promise<void> {
  if (imageIds.length === 0) return;

  if (imageIds.length > MAX_IMAGES_PER_LOG) {
    throw new Error(`Maximum ${MAX_IMAGES_PER_LOG} images per log`);
  }

  // Verify all images exist and are pending (logId = null)
  const pendingImages = await prisma.logImage.findMany({
    where: {
      id: { in: imageIds },
      logId: null,
    },
  });

  if (pendingImages.length !== imageIds.length) {
    throw new Error('One or more image IDs are invalid or already committed');
  }

  // Associate images with the log
  for (let i = 0; i < imageIds.length; i++) {
    await prisma.logImage.update({
      where: { id: imageIds[i] },
      data: {
        logId,
        sortOrder: i,
      },
    });
  }
}

/**
 * Generate a pre-signed URL for avatar upload.
 */
export async function getAvatarUploadUrl(
  userId: string,
  mimeType: string,
  fileSize: number,
): Promise<{ upload_url: string; public_url: string }> {
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new Error(`Invalid MIME type: ${mimeType}`);
  }
  if (fileSize > MAX_FILE_SIZE) {
    throw new Error('File size exceeds maximum of 10 MB');
  }

  const s3 = getS3Client();
  const bucket = process.env.S3_BUCKET_NAME || 'momentum-uploads';
  const ext = getMimeExtension(mimeType);
  const s3Key = `avatars/${userId}/${randomUUID()}.${ext}`;
  const publicUrl = getPublicObjectUrl(s3Key);

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: s3Key,
    ContentType: mimeType,
    ContentLength: fileSize,
  });

  const uploadUrl = await getSignedUrl(s3, command, {
    expiresIn: PRESIGNED_URL_EXPIRY,
  });

  return { upload_url: uploadUrl, public_url: publicUrl };
}

/**
 * Delete S3 objects for given keys.
 */
export async function deleteS3Objects(keys: string[]): Promise<void> {
  if (keys.length === 0) return;

  const s3 = getS3Client();
  const bucket = process.env.S3_BUCKET_NAME || 'momentum-uploads';

  await Promise.allSettled(
    keys.map((key) =>
      s3.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: key,
        })
      )
    )
  );
}
