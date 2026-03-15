/** Shared JSON Schema definitions for auth-related routes */

export const userResponseSchema = {
  type: 'object' as const,
  properties: {
    id: { type: 'string' as const },
    email: { type: 'string' as const },
    username: { type: 'string' as const },
    display_name: { type: 'string' as const },
    avatar_url: { type: ['string', 'null'] as const },
    bio: { type: ['string', 'null'] as const },
    created_at: { type: 'string' as const },
  },
};

export const authTokenResponseSchema = {
  type: 'object' as const,
  properties: {
    data: {
      type: 'object' as const,
      properties: {
        access_token: { type: 'string' as const },
        refresh_token: { type: 'string' as const },
        user: userResponseSchema,
      },
    },
  },
};

export const errorResponseSchema = {
  type: 'object' as const,
  properties: {
    error: {
      type: 'object' as const,
      properties: {
        code: { type: 'string' as const },
        message: { type: 'string' as const },
        details: { type: 'array' as const, items: {} },
      },
    },
  },
};
