import { afterEach, describe, expect, it, vi } from 'vitest';
import notificationRoutes from '@/routes/notifications';
import { buildRouteApp } from '../helpers/routeApp';

describe('notification routes', () => {
  afterEach(async () => {
    vi.restoreAllMocks();
  });

  it('returns the unread count for the authenticated user only', async () => {
    const prisma = {
      notification: {
        count: vi.fn().mockResolvedValue(3),
      },
    } as any;
    const app = await buildRouteApp(notificationRoutes, prisma, '/notifications');

    const response = await app.inject({
      method: 'GET',
      url: '/notifications/unread-count',
      headers: { 'x-user-id': '11111111-1111-4111-8111-111111111111' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ data: { unread_count: 3 } });
    expect(prisma.notification.count).toHaveBeenCalledWith({
      where: {
        recipientId: '11111111-1111-4111-8111-111111111111',
        isRead: false,
      },
    });

    await app.close();
  });

  it('rejects marking another user\'s notification as read', async () => {
    const prisma = {
      notification: {
        findUnique: vi.fn().mockResolvedValue({
          id: '22222222-2222-4222-8222-222222222222',
          recipientId: '33333333-3333-4333-8333-333333333333',
        }),
        update: vi.fn(),
      },
    } as any;
    const app = await buildRouteApp(notificationRoutes, prisma, '/notifications');

    const response = await app.inject({
      method: 'PUT',
      url: '/notifications/22222222-2222-4222-8222-222222222222/read',
      headers: { 'x-user-id': '11111111-1111-4111-8111-111111111111' },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.message).toBe('Not your notification');
    expect(prisma.notification.update).not.toHaveBeenCalled();

    await app.close();
  });

  it('marks all unread notifications as read for the authenticated user', async () => {
    const prisma = {
      notification: {
        updateMany: vi.fn().mockResolvedValue({ count: 4 }),
      },
    } as any;
    const app = await buildRouteApp(notificationRoutes, prisma, '/notifications');

    const response = await app.inject({
      method: 'PUT',
      url: '/notifications/read-all',
      headers: { 'x-user-id': '11111111-1111-4111-8111-111111111111' },
    });

    expect(response.statusCode).toBe(200);
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: {
        recipientId: '11111111-1111-4111-8111-111111111111',
        isRead: false,
      },
      data: { isRead: true },
    });

    await app.close();
  });
});
