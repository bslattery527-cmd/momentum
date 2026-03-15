/** Shared JSON Schema definitions for log-related routes */

export const logTaskSchema = {
  type: 'object' as const,
  properties: {
    id: { type: 'string' as const },
    task_name: { type: 'string' as const },
    category_id: { type: 'string' as const },
    category: {
      type: 'object' as const,
      properties: {
        id: { type: 'string' as const },
        name: { type: 'string' as const },
        icon: { type: ['string', 'null'] as const },
      },
    },
    duration: { type: 'integer' as const },
    sort_order: { type: 'integer' as const },
  },
};

export const logImageSchema = {
  type: 'object' as const,
  properties: {
    id: { type: 'string' as const },
    public_url: { type: 'string' as const },
    width: { type: ['integer', 'null'] as const },
    height: { type: ['integer', 'null'] as const },
    sort_order: { type: 'integer' as const },
  },
};

export const logResponseSchema = {
  type: 'object' as const,
  properties: {
    id: { type: 'string' as const },
    user_id: { type: 'string' as const },
    title: { type: 'string' as const },
    note: { type: ['string', 'null'] as const },
    total_duration: { type: 'integer' as const },
    started_at: { type: ['string', 'null'] as const },
    ended_at: { type: ['string', 'null'] as const },
    is_published: { type: 'boolean' as const },
    published_at: { type: ['string', 'null'] as const },
    tasks: { type: 'array' as const, items: logTaskSchema },
    images: { type: 'array' as const, items: logImageSchema },
    reaction_count: { type: 'integer' as const },
    comment_count: { type: 'integer' as const },
    has_reacted: { type: 'boolean' as const },
    created_at: { type: 'string' as const },
  },
};

export const feedCardSchema = {
  type: 'object' as const,
  properties: {
    ...logResponseSchema.properties,
    user: {
      type: 'object' as const,
      properties: {
        id: { type: 'string' as const },
        username: { type: 'string' as const },
        display_name: { type: 'string' as const },
        avatar_url: { type: ['string', 'null'] as const },
      },
    },
    streak_at_time: { type: 'integer' as const },
  },
};

export const imageUploadRequestSchema = {
  type: 'object' as const,
  required: ['images'] as const,
  properties: {
    images: {
      type: 'array' as const,
      minItems: 1,
      maxItems: 4,
      items: {
        type: 'object' as const,
        required: ['mime_type', 'file_size'] as const,
        properties: {
          mime_type: {
            type: 'string' as const,
            enum: ['image/jpeg', 'image/png', 'image/webp'],
          },
          file_size: {
            type: 'integer' as const,
            minimum: 1,
            maximum: 10485760,
          },
        },
        additionalProperties: false,
      },
    },
  },
  additionalProperties: false,
};
