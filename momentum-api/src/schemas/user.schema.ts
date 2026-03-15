/** Shared JSON Schema definitions for user-related routes */

export const publicUserSchema = {
  type: 'object' as const,
  properties: {
    id: { type: 'string' as const },
    username: { type: 'string' as const },
    display_name: { type: 'string' as const },
    avatar_url: { type: ['string', 'null'] as const },
    bio: { type: ['string', 'null'] as const },
  },
};

export const userProfileSchema = {
  type: 'object' as const,
  properties: {
    id: { type: 'string' as const },
    username: { type: 'string' as const },
    display_name: { type: 'string' as const },
    avatar_url: { type: ['string', 'null'] as const },
    bio: { type: ['string', 'null'] as const },
    follower_count: { type: 'integer' as const },
    following_count: { type: 'integer' as const },
    current_streak: { type: 'integer' as const },
    longest_streak: { type: 'integer' as const },
    is_following: { type: 'boolean' as const },
    log_count: { type: 'integer' as const },
  },
};

export const paginationQuerySchema = {
  type: 'object' as const,
  properties: {
    limit: { type: 'integer' as const, minimum: 1, maximum: 50, default: 20 },
    cursor: { type: 'string' as const },
  },
};

export const paginationMetaSchema = {
  type: 'object' as const,
  properties: {
    has_more: { type: 'boolean' as const },
    cursor: { type: ['string', 'null'] as const },
  },
};
