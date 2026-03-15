import { FastifyPluginAsync } from 'fastify';

const categoryRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /categories — Get the full list of categories (no auth required)
  fastify.get('/', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  icon: { type: ['string', 'null'] },
                  is_default: { type: 'boolean' },
                },
              },
            },
          },
        },
      },
    },
  }, async (_request, reply) => {
    const categories = await fastify.prisma.category.findMany({
      orderBy: { name: 'asc' },
    });

    return reply.status(200).send({
      data: categories.map((c) => ({
        id: c.id,
        name: c.name,
        icon: c.icon,
        is_default: c.isDefault,
      })),
    });
  });
};

export default categoryRoutes;
