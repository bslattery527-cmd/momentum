import { describe, expect, it, vi } from 'vitest';
import logRoutes from '@/routes/logs';
import { buildRouteApp } from '../helpers/routeApp';

function makeLog(overrides: Partial<any> = {}) {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    userId: '11111111-1111-4111-8111-111111111111',
    title: 'Deep work',
    note: 'Focus session',
    totalDuration: 3600,
    startedAt: new Date('2026-03-18T09:00:00.000Z'),
    endedAt: new Date('2026-03-18T10:00:00.000Z'),
    isPublished: true,
    publishedAt: new Date('2026-03-18T10:00:00.000Z'),
    createdAt: new Date('2026-03-18T10:00:00.000Z'),
    user: {
      id: '11111111-1111-4111-8111-111111111111',
      username: 'alex',
      displayName: 'Alex',
      avatarUrl: null,
    },
    tasks: [
      {
        id: 'task-1',
        taskName: 'Coding',
        categoryId: '33333333-3333-4333-8333-333333333333',
        duration: 3600,
        sortOrder: 0,
        category: {
          id: '33333333-3333-4333-8333-333333333333',
          name: 'Coding',
          icon: '💻',
        },
      },
    ],
    images: [],
    taggedUsers: [],
    _count: { reactions: 2, comments: 1 },
    ...overrides,
  };
}

describe('log routes', () => {
  it('hides private logs from non-owners', async () => {
    const prisma = {
      log: {
        findUnique: vi.fn().mockResolvedValue(makeLog({
          isPublished: false,
          publishedAt: null,
          userId: '44444444-4444-4444-8444-444444444444',
        })),
      },
      reaction: {
        findUnique: vi.fn(),
      },
    } as any;
    const app = await buildRouteApp(logRoutes, prisma, '/logs');

    const response = await app.inject({
      method: 'GET',
      url: '/logs/22222222-2222-4222-8222-222222222222',
    });

    expect(response.statusCode).toBe(404);
    expect(prisma.reaction.findUnique).not.toHaveBeenCalled();

    await app.close();
  });

  it('returns log detail for the owner and includes has_reacted state', async () => {
    const prisma = {
      log: {
        findUnique: vi.fn().mockResolvedValue(makeLog({ isPublished: false, publishedAt: null })),
      },
      reaction: {
        findUnique: vi.fn().mockResolvedValue({ id: 'reaction-1' }),
      },
    } as any;
    const app = await buildRouteApp(logRoutes, prisma, '/logs');

    const response = await app.inject({
      method: 'GET',
      url: '/logs/22222222-2222-4222-8222-222222222222',
      headers: { 'x-user-id': '11111111-1111-4111-8111-111111111111' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({
      id: '22222222-2222-4222-8222-222222222222',
      user_id: '11111111-1111-4111-8111-111111111111',
      is_published: false,
      reaction_count: 2,
      comment_count: 1,
      has_reacted: true,
    });
    expect(prisma.reaction.findUnique).toHaveBeenCalledWith({
      where: {
        logId_userId: {
          logId: '22222222-2222-4222-8222-222222222222',
          userId: '11111111-1111-4111-8111-111111111111',
        },
      },
    });

    await app.close();
  });
});
