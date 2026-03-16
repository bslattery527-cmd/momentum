import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  chunkPushNotifications,
  sendPushNotificationsAsync,
  isExpoPushToken,
} = vi.hoisted(() => ({
  chunkPushNotifications: vi.fn(),
  sendPushNotificationsAsync: vi.fn(),
  isExpoPushToken: vi.fn(),
}));

vi.mock('expo-server-sdk', () => {
  class Expo {
    constructor(_config?: any) {}
    chunkPushNotifications = chunkPushNotifications;
    sendPushNotificationsAsync = sendPushNotificationsAsync;
    static isExpoPushToken = isExpoPushToken;
  }

  return {
    default: Expo,
    ExpoPushMessage: class {},
  };
});

import { sendNotification } from '../pushService.js';

describe('pushService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    chunkPushNotifications.mockImplementation((messages) => [messages]);
    sendPushNotificationsAsync.mockResolvedValue([]);
    isExpoPushToken.mockImplementation((token) => token.startsWith('ExponentPushToken'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does nothing for self-notifications', async () => {
    const prisma = {
      notification: { create: vi.fn() },
    } as any;

    await sendNotification(prisma, {
      type: 'reaction',
      actorId: 'user-1',
      recipientId: 'user-1',
      entityType: 'log',
      entityId: 'log-1',
    });

    expect(prisma.notification.create).not.toHaveBeenCalled();
    expect(sendPushNotificationsAsync).not.toHaveBeenCalled();
  });

  it('creates an in-app notification and sends pushes to valid Expo tokens only', async () => {
    const prisma = {
      notification: { create: vi.fn().mockResolvedValue({}) },
      user: {
        findUnique: vi.fn().mockResolvedValue({ username: 'sarah', displayName: 'Sarah' }),
      },
      pushToken: {
        findMany: vi.fn().mockResolvedValue([
          { token: 'ExponentPushToken[good-token]' },
          { token: 'not-a-valid-token' },
        ]),
      },
    } as any;

    await sendNotification(prisma, {
      type: 'comment',
      actorId: 'user-2',
      recipientId: 'user-1',
      entityType: 'log',
      entityId: 'log-1',
    });

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        recipientId: 'user-1',
        actorId: 'user-2',
        type: 'comment',
        entityType: 'log',
        entityId: 'log-1',
      },
    });
    expect(chunkPushNotifications).toHaveBeenCalledWith([
      {
        to: 'ExponentPushToken[good-token]',
        sound: 'default',
        body: 'sarah commented on your log',
        data: {
          type: 'comment',
          entityType: 'log',
          entityId: 'log-1',
        },
      },
    ]);
    expect(sendPushNotificationsAsync).toHaveBeenCalledTimes(1);
  });

  it('keeps the in-app notification when the actor cannot be loaded but skips push delivery', async () => {
    const prisma = {
      notification: { create: vi.fn().mockResolvedValue({}) },
      user: { findUnique: vi.fn().mockResolvedValue(null) },
      pushToken: { findMany: vi.fn() },
    } as any;

    await sendNotification(prisma, {
      type: 'follow',
      actorId: 'user-2',
      recipientId: 'user-1',
    });

    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    expect(prisma.pushToken.findMany).not.toHaveBeenCalled();
    expect(sendPushNotificationsAsync).not.toHaveBeenCalled();
  });

  it('skips delivery when the recipient has no valid push tokens', async () => {
    const prisma = {
      notification: { create: vi.fn().mockResolvedValue({}) },
      user: { findUnique: vi.fn().mockResolvedValue({ username: 'kai', displayName: 'Kai' }) },
      pushToken: {
        findMany: vi.fn().mockResolvedValue([{ token: 'bad-token' }]),
      },
    } as any;

    await sendNotification(prisma, {
      type: 'tag',
      actorId: 'user-2',
      recipientId: 'user-1',
      entityType: 'log',
      entityId: 'log-9',
    });

    expect(chunkPushNotifications).not.toHaveBeenCalled();
    expect(sendPushNotificationsAsync).not.toHaveBeenCalled();
  });
});
