import Fastify, { FastifyPluginAsync } from 'fastify';

export async function buildRouteApp(plugin: FastifyPluginAsync, prisma: any, prefix = '') {
  const app = Fastify({ logger: false });

  app.decorate('prisma', prisma);
  app.decorate('authenticate', async function authenticate(request: any) {
    const userId = request.headers['x-user-id'];
    if (!userId) {
      const error: any = new Error('Invalid or expired access token');
      error.statusCode = 401;
      throw error;
    }
    request.user = { sub: Array.isArray(userId) ? userId[0] : userId };
  });
  app.decorate('optionalAuth', async function optionalAuth(request: any) {
    const userId = request.headers['x-user-id'];
    if (userId) {
      request.user = { sub: Array.isArray(userId) ? userId[0] : userId };
    }
  });

  await app.register(plugin, prefix ? { prefix } : undefined);
  await app.ready();
  return app;
}
