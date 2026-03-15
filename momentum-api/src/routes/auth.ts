import { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import jwksClient from 'jwks-rsa';
import { JWT_ACCESS_EXPIRES_IN, JWT_REFRESH_EXPIRES_IN, JwtPayload } from '../lib/jwt';

const BCRYPT_ROUNDS = 12;
const USERNAME_REGEX = /^[a-z0-9_]{3,30}$/;

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const appleJwksClient = jwksClient({
  jwksUri: 'https://appleid.apple.com/auth/keys',
  cache: true,
  rateLimit: true,
});

function signAccessToken(fastify: any, user: { id: string; username: string }): string {
  return fastify.jwt.sign(
    { sub: user.id, username: user.username } as JwtPayload,
    { expiresIn: JWT_ACCESS_EXPIRES_IN }
  );
}

function signRefreshToken(user: { id: string }): string {
  const secret = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret';
  return jwt.sign(
    { sub: user.id, type: 'refresh' },
    secret,
    { expiresIn: JWT_REFRESH_EXPIRES_IN }
  );
}

function verifyRefreshToken(token: string): { sub: string; type: string } {
  const secret = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret';
  return jwt.verify(token, secret) as { sub: string; type: string };
}

const authRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /auth/register
  fastify.post('/register', {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '15 minutes',
      },
    },
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password', 'display_name', 'username'],
        properties: {
          email: { type: 'string', format: 'email', maxLength: 255 },
          password: { type: 'string', minLength: 8, maxLength: 128 },
          display_name: { type: 'string', minLength: 1, maxLength: 100 },
          username: { type: 'string', minLength: 3, maxLength: 30, pattern: '^[a-z0-9_]{3,30}$' },
        },
        additionalProperties: false,
      },
      response: {
        201: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                access_token: { type: 'string' },
                refresh_token: { type: 'string' },
                user: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    email: { type: 'string' },
                    username: { type: 'string' },
                    display_name: { type: 'string' },
                    avatar_url: { type: ['string', 'null'] },
                    bio: { type: ['string', 'null'] },
                    created_at: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { email, password, display_name, username } = request.body as {
      email: string;
      password: string;
      display_name: string;
      username: string;
    };

    // Validate username format
    if (!USERNAME_REGEX.test(username)) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Username must be 3-30 characters, lowercase alphanumeric and underscores only',
          details: [],
        },
      });
    }

    // Check for existing email
    const existingEmail = await fastify.prisma.user.findUnique({ where: { email } });
    if (existingEmail) {
      return reply.status(409).send({
        error: {
          code: 'CONFLICT',
          message: 'An account with this email already exists',
          details: [],
        },
      });
    }

    // Check for existing username
    const existingUsername = await fastify.prisma.user.findUnique({ where: { username } });
    if (existingUsername) {
      return reply.status(409).send({
        error: {
          code: 'CONFLICT',
          message: 'This username is already taken',
          details: [],
        },
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Create user
    const user = await fastify.prisma.user.create({
      data: {
        email,
        passwordHash,
        displayName: display_name,
        username,
      },
    });

    // Create streak record
    await fastify.prisma.streak.create({
      data: {
        userId: user.id,
        currentStreak: 0,
        longestStreak: 0,
      },
    });

    const accessToken = signAccessToken(fastify, user);
    const refreshToken = signRefreshToken(user);

    return reply.status(201).send({
      data: {
        access_token: accessToken,
        refresh_token: refreshToken,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          display_name: user.displayName,
          avatar_url: user.avatarUrl,
          bio: user.bio,
          created_at: user.createdAt.toISOString(),
        },
      },
    });
  });

  // POST /auth/login
  fastify.post('/login', {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '15 minutes',
      },
    },
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 1 },
        },
        additionalProperties: false,
      },
    },
  }, async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string };

    const user = await fastify.prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      return reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid email or password',
          details: [],
        },
      });
    }

    if (!user.isActive) {
      return reply.status(403).send({
        error: {
          code: 'FORBIDDEN',
          message: 'Account is deactivated',
          details: [],
        },
      });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid email or password',
          details: [],
        },
      });
    }

    const accessToken = signAccessToken(fastify, user);
    const refreshToken = signRefreshToken(user);

    return reply.status(200).send({
      data: {
        access_token: accessToken,
        refresh_token: refreshToken,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          display_name: user.displayName,
          avatar_url: user.avatarUrl,
          bio: user.bio,
          created_at: user.createdAt.toISOString(),
        },
      },
    });
  });

  // POST /auth/google
  fastify.post('/google', {
    config: {
      rateLimit: {
        max: 20,
        timeWindow: '15 minutes',
      },
    },
    schema: {
      body: {
        type: 'object',
        required: ['id_token'],
        properties: {
          id_token: { type: 'string', minLength: 1 },
        },
        additionalProperties: false,
      },
    },
  }, async (request, reply) => {
    const { id_token } = request.body as { id_token: string };

    let ticket;
    try {
      ticket = await googleClient.verifyIdToken({
        idToken: id_token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
    } catch {
      return reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid Google ID token',
          details: [],
        },
      });
    }

    const payload = ticket.getPayload();
    if (!payload || !payload.sub || !payload.email) {
      return reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid Google token payload',
          details: [],
        },
      });
    }

    const { sub: googleId, email, name } = payload;

    // Check if OAuth account already exists
    const existingOauth = await fastify.prisma.oauthAccount.findUnique({
      where: {
        provider_providerId: {
          provider: 'google',
          providerId: googleId,
        },
      },
      include: { user: true },
    });

    if (existingOauth) {
      const user = existingOauth.user;
      const accessToken = signAccessToken(fastify, user);
      const refreshToken = signRefreshToken(user);

      return reply.status(200).send({
        data: {
          access_token: accessToken,
          refresh_token: refreshToken,
          user: {
            id: user.id,
            email: user.email,
            username: user.username,
            display_name: user.displayName,
            avatar_url: user.avatarUrl,
            bio: user.bio,
            created_at: user.createdAt.toISOString(),
          },
        },
      });
    }

    // Check if a user with this email exists (link accounts)
    let user = await fastify.prisma.user.findUnique({ where: { email } });

    if (!user) {
      // Create new user — generate a unique username from email
      const baseUsername = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 25);
      let username = baseUsername;
      let counter = 1;
      while (await fastify.prisma.user.findUnique({ where: { username } })) {
        username = `${baseUsername.slice(0, 25)}${counter}`;
        counter++;
      }

      user = await fastify.prisma.user.create({
        data: {
          email,
          displayName: name || email.split('@')[0],
          username,
        },
      });

      // Create streak record
      await fastify.prisma.streak.create({
        data: { userId: user.id, currentStreak: 0, longestStreak: 0 },
      });
    }

    // Link OAuth account
    await fastify.prisma.oauthAccount.create({
      data: {
        userId: user.id,
        provider: 'google',
        providerId: googleId,
        email,
      },
    });

    const accessToken = signAccessToken(fastify, user);
    const refreshToken = signRefreshToken(user);

    return reply.status(200).send({
      data: {
        access_token: accessToken,
        refresh_token: refreshToken,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          display_name: user.displayName,
          avatar_url: user.avatarUrl,
          bio: user.bio,
          created_at: user.createdAt.toISOString(),
        },
      },
    });
  });

  // POST /auth/apple
  fastify.post('/apple', {
    config: {
      rateLimit: {
        max: 20,
        timeWindow: '15 minutes',
      },
    },
    schema: {
      body: {
        type: 'object',
        required: ['identity_token'],
        properties: {
          identity_token: { type: 'string', minLength: 1 },
          display_name: { type: 'string', maxLength: 100 },
        },
        additionalProperties: false,
      },
    },
  }, async (request, reply) => {
    const { identity_token, display_name } = request.body as {
      identity_token: string;
      display_name?: string;
    };

    // Decode the JWT header to get the key ID
    let decoded: any;
    try {
      const header = JSON.parse(
        Buffer.from(identity_token.split('.')[0], 'base64url').toString()
      );

      const key = await appleJwksClient.getSigningKey(header.kid);
      const publicKey = key.getPublicKey();

      decoded = jwt.verify(identity_token, publicKey, {
        algorithms: ['RS256'],
        audience: process.env.APPLE_CLIENT_ID,
        issuer: 'https://appleid.apple.com',
      }) as any;
    } catch {
      return reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid Apple identity token',
          details: [],
        },
      });
    }

    const appleId = decoded.sub as string;
    const email = decoded.email as string | undefined;

    if (!appleId) {
      return reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid Apple token payload',
          details: [],
        },
      });
    }

    // Check if OAuth account already exists
    const existingOauth = await fastify.prisma.oauthAccount.findUnique({
      where: {
        provider_providerId: {
          provider: 'apple',
          providerId: appleId,
        },
      },
      include: { user: true },
    });

    if (existingOauth) {
      const user = existingOauth.user;
      const accessToken = signAccessToken(fastify, user);
      const refreshToken = signRefreshToken(user);

      return reply.status(200).send({
        data: {
          access_token: accessToken,
          refresh_token: refreshToken,
          user: {
            id: user.id,
            email: user.email,
            username: user.username,
            display_name: user.displayName,
            avatar_url: user.avatarUrl,
            bio: user.bio,
            created_at: user.createdAt.toISOString(),
          },
        },
      });
    }

    // Check if user with this email exists
    let user = email ? await fastify.prisma.user.findUnique({ where: { email } }) : null;

    if (!user) {
      const userEmail = email || `apple_${appleId.slice(0, 8)}@privaterelay.appleid.com`;
      const baseName = display_name || 'User';
      const baseUsername = baseName.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 25);
      let username = baseUsername;
      let counter = 1;
      while (await fastify.prisma.user.findUnique({ where: { username } })) {
        username = `${baseUsername.slice(0, 25)}${counter}`;
        counter++;
      }

      user = await fastify.prisma.user.create({
        data: {
          email: userEmail,
          displayName: display_name || 'User',
          username,
        },
      });

      // Create streak record
      await fastify.prisma.streak.create({
        data: { userId: user.id, currentStreak: 0, longestStreak: 0 },
      });
    }

    // Link OAuth account
    await fastify.prisma.oauthAccount.create({
      data: {
        userId: user.id,
        provider: 'apple',
        providerId: appleId,
        email: email || null,
      },
    });

    const accessToken = signAccessToken(fastify, user);
    const refreshToken = signRefreshToken(user);

    return reply.status(200).send({
      data: {
        access_token: accessToken,
        refresh_token: refreshToken,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          display_name: user.displayName,
          avatar_url: user.avatarUrl,
          bio: user.bio,
          created_at: user.createdAt.toISOString(),
        },
      },
    });
  });

  // POST /auth/refresh
  fastify.post('/refresh', {
    schema: {
      body: {
        type: 'object',
        required: ['refresh_token'],
        properties: {
          refresh_token: { type: 'string', minLength: 1 },
        },
        additionalProperties: false,
      },
    },
  }, async (request, reply) => {
    const { refresh_token } = request.body as { refresh_token: string };

    let payload;
    try {
      payload = verifyRefreshToken(refresh_token);
    } catch {
      return reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired refresh token',
          details: [],
        },
      });
    }

    if (payload.type !== 'refresh') {
      return reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid token type',
          details: [],
        },
      });
    }

    const user = await fastify.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.isActive) {
      return reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not found or deactivated',
          details: [],
        },
      });
    }

    const accessToken = signAccessToken(fastify, user);
    const newRefreshToken = signRefreshToken(user);

    return reply.status(200).send({
      data: {
        access_token: accessToken,
        refresh_token: newRefreshToken,
      },
    });
  });

  // POST /auth/logout
  fastify.post('/logout', {
    onRequest: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        properties: {
          push_token: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
  }, async (request, reply) => {
    const userId = request.user.sub;
    const body = request.body as { push_token?: string } | undefined;

    // Remove push token if provided
    if (body?.push_token) {
      await fastify.prisma.pushToken.deleteMany({
        where: {
          userId,
          token: body.push_token,
        },
      });
    }

    return reply.status(200).send({
      data: { message: 'Logged out successfully' },
    });
  });
};

export default authRoutes;
