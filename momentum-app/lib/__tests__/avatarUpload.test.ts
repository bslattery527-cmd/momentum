import { resolveAvatarMimeType, uploadAvatar } from '../avatarUpload';

const mockPost = jest.fn();
const mockUploadImageToS3 = jest.fn();
const mockIsDemoMode = jest.fn();

jest.mock('@/lib/api', () => ({
  api: {
    post: (...args: unknown[]) => mockPost(...args),
  },
}));

jest.mock('@/lib/imageUpload', () => ({
  uploadImageToS3: (...args: unknown[]) => mockUploadImageToS3(...args),
}));

jest.mock('@/lib/demoApi', () => ({
  isDemoMode: () => mockIsDemoMode(),
}));

describe('avatarUpload', () => {
  beforeEach(() => {
    mockPost.mockReset();
    mockUploadImageToS3.mockReset();
    mockIsDemoMode.mockReset();
    mockIsDemoMode.mockReturnValue(false);
  });

  it('prefers a supported MIME type from the picker asset', () => {
    expect(resolveAvatarMimeType({ uri: 'file:///avatar.png', mimeType: 'image/webp' })).toBe(
      'image/webp',
    );
  });

  it('falls back to the file extension when MIME type is missing or unsupported', () => {
    expect(resolveAvatarMimeType({ uri: 'file:///avatar.png', mimeType: 'image/heic' })).toBe(
      'image/png',
    );
    expect(resolveAvatarMimeType({ uri: 'file:///avatar.jpg' })).toBe('image/jpeg');
  });

  it('requests a presigned upload URL and uploads the selected avatar', async () => {
    mockPost.mockResolvedValue({
      data: {
        upload_url: 'https://signed.example/avatar',
        public_url: 'https://cdn.example/avatar.webp',
      },
    });
    mockUploadImageToS3.mockResolvedValue(undefined);

    await expect(
      uploadAvatar({
        uri: 'file:///avatar.webp',
        mimeType: 'image/webp',
        fileSize: 4096,
      }),
    ).resolves.toBe('https://cdn.example/avatar.webp');

    expect(mockPost).toHaveBeenCalledWith('/users/me/avatar-upload', {
      mime_type: 'image/webp',
      file_size: 4096,
    });
    expect(mockUploadImageToS3).toHaveBeenCalledWith(
      'https://signed.example/avatar',
      'file:///avatar.webp',
      'image/webp',
    );
  });

  it('skips network upload in demo mode', async () => {
    mockIsDemoMode.mockReturnValue(true);

    await expect(
      uploadAvatar({
        uri: 'file:///avatar.png',
        mimeType: 'image/png',
        fileSize: 2048,
      }),
    ).resolves.toBe('file:///avatar.png');

    expect(mockPost).not.toHaveBeenCalled();
    expect(mockUploadImageToS3).not.toHaveBeenCalled();
  });
});
