import { PrismaClient } from '@prisma/client';
import Expo, { type ExpoPushMessage } from 'expo-server-sdk';

const expo = new Expo({
  accessToken: process.env.EXPO_ACCESS_TOKEN,
});

export type NotificationType = 'reaction' | 'comment' | 'follow' | 'tag';

interface NotificationData {
  type: NotificationType;
  actorId: string;
  recipientId: string;
  entityType?: 'log' | 'comment';
  entityId?: string;
}

/**
 * Create an in-app notification record and send a push notification.
 * Never notifies a user about their own actions.
 */
export async function sendNotification(
  prisma: PrismaClient,
  data: NotificationData,
): Promise<void> {
  // Never notify a user about their own action
  if (data.actorId === data.recipientId) return;

  // Create the notification record
  await prisma.notification.create({
    data: {
      recipientId: data.recipientId,
      actorId: data.actorId,
      type: data.type,
      entityType: data.entityType || null,
      entityId: data.entityId || null,
    },
  });

  // Get the actor's username for the push message
  const actor = await prisma.user.findUnique({
    where: { id: data.actorId },
    select: { username: true, displayName: true },
  });

  if (!actor) return;

  // Get push tokens for the recipient
  const pushTokens = await prisma.pushToken.findMany({
    where: { userId: data.recipientId },
    select: { token: true },
  });

  if (pushTokens.length === 0) return;

  // Build push message
  const body = buildPushMessage(data.type, actor.username);
  if (!body) return;

  const messages: ExpoPushMessage[] = [];

  for (const { token } of pushTokens) {
    if (!Expo.isExpoPushToken(token)) {
      console.warn(`Invalid Expo push token: ${token}`);
      continue;
    }

    messages.push({
      to: token,
      sound: 'default',
      body,
      data: {
        type: data.type,
        entityType: data.entityType,
        entityId: data.entityId,
      },
    });
  }

  if (messages.length === 0) return;

  // Send in chunks (Expo limit)
  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      await expo.sendPushNotificationsAsync(chunk);
    } catch (err) {
      console.error('Push notification error:', err);
    }
  }
}

function buildPushMessage(type: NotificationType, actorUsername: string): string | null {
  switch (type) {
    case 'reaction':
      return `${actorUsername} celebrated your log`;
    case 'comment':
      return `${actorUsername} commented on your log`;
    case 'follow':
      return `${actorUsername} started following you`;
    case 'tag':
      return `${actorUsername} tagged you in a session`;
    default:
      return null;
  }
}
