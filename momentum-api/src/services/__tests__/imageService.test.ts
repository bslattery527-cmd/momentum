import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSend, mockGetSignedUrl } = vi.hoisted(() => ({
  mockSend: vi.fn(),
  mockGetSignedUrl: vi.fn(),
}));

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class {
    send = mockSend;
  },
  PutObjectCommand: class {
    input: any;
    constructor(input: any) {
      this.input = input;
    }
  },
  DeleteObjectCommand: class {
    input: any;
    constructor(input: any) {
      this.input = input;
    }
  },
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: mockGetSignedUrl,
}));

import {
  commitImagesToLog,
  deleteS3Objects,
  getAvatarUploadUrl,
  reserveImageUploads,
  validateImageUploads,
} from '../imageService.js';

describe('imageService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.S3_BUCKET_NAME = 'momentum-test';
    process.env.CDN_BASE_URL = 'https://cdn.test';
    mockGetSignedUrl.mockResolvedValue('https://signed.example/upload');
  });

  it('validates max count, mime types, and file size bounds', () => {
    expect(validateImageUploads(Array.from({ length: 5 }, () => ({ mime_type: 'image/jpeg', file_size: 10 })))).toContain('Maximum 4 images');
    expect(validateImageUploads([{ mime_type: 'image/gif', file_size: 10 }])).toContain('Invalid MIME type');
    expect(validateImageUploads([{ mime_type: 'image/jpeg', file_size: 0 }])).toContain('greater than 0');
    expect(validateImageUploads([{ mime_type: 'image/jpeg', file_size: 11 * 1024 * 1024 }])).toContain('10 MB');
    expect(validateImageUploads([{ mime_type: 'image/png', file_size: 1024 }])).toBeNull();
  });

  it('reserves image uploads and creates pending records with signed urls', async () => {
    const create = vi.fn().mockResolvedValue(undefined);
    const prisma = {
      logImage: { create },
    } as any;

    const results = await reserveImageUploads(prisma, 'user-1', [
      { mime_type: 'image/jpeg', file_size: 1024 },
      { mime_type: 'image/png', file_size: 2048 },
    ]);

    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0][0].data).toMatchObject({
      logId: null,
      publicUrl: expect.stringMatching(/^https:\/\/cdn\.test\/log-images\//),
      mimeType: 'image/jpeg',
      fileSize: 1024,
      sortOrder: 0,
    });
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      upload_url: 'https://signed.example/upload',
      public_url: expect.stringMatching(/^https:\/\/cdn\.test\/log-images\//),
    });
  });

  it('commits pending images to a log in the requested order', async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const prisma = {
      logImage: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'img-1' },
          { id: 'img-2' },
        ]),
        update,
      },
    } as any;

    await commitImagesToLog(prisma, 'log-1', ['img-2', 'img-1']);

    expect(update).toHaveBeenNthCalledWith(1, {
      where: { id: 'img-2' },
      data: { logId: 'log-1', sortOrder: 0 },
    });
    expect(update).toHaveBeenNthCalledWith(2, {
      where: { id: 'img-1' },
      data: { logId: 'log-1', sortOrder: 1 },
    });
  });

  it('throws when any image id is invalid or already committed', async () => {
    const prisma = {
      logImage: {
        findMany: vi.fn().mockResolvedValue([{ id: 'img-1' }]),
      },
    } as any;

    await expect(commitImagesToLog(prisma, 'log-1', ['img-1', 'img-2'])).rejects.toThrow(
      'One or more image IDs are invalid or already committed',
    );
  });

  it('generates avatar upload urls with validation', async () => {
    await expect(getAvatarUploadUrl('user-1', 'image/gif', 200)).rejects.toThrow('Invalid MIME type');
    await expect(getAvatarUploadUrl('user-1', 'image/jpeg', 12 * 1024 * 1024)).rejects.toThrow('10 MB');

    await expect(getAvatarUploadUrl('user-1', 'image/webp', 2048)).resolves.toEqual({
      upload_url: 'https://signed.example/upload',
      public_url: 'https://cdn.test/avatars/user-1.webp',
    });
  });

  it('skips S3 deletion work when there are no keys', async () => {
    await deleteS3Objects([]);
    expect(mockSend).not.toHaveBeenCalled();
  });
});
