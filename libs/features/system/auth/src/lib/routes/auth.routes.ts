import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { AuthHandlers } from '../handlers/auth.handlers';
import {
  LoginSchema,
  RegisterSchema,
  RefreshTokenSchema,
  AuthResponseSchema,
  TokenResponseSchema,
  MessageResponseSchema,
  UserSchema,
  ErrorSchema
} from '../schemas';

/**
 * Authentication routes
 * Handles login, register, refresh token, logout
 */
export const authRoutes: FastifyPluginAsync = async (
  fastify: FastifyInstance
) => {
  const handlers = new AuthHandlers();

  // POST /api/auth/login
  fastify.post('/login', {
    schema: {
      summary: 'User login',
      description: 'Authenticate user with email and password',
      tags: ['authentication'],
      body: LoginSchema,
      response: {
        200: AuthResponseSchema,
        401: ErrorSchema,
        400: ErrorSchema
      }
    }
  }, handlers.login);

  // POST /api/auth/register
  fastify.post('/register', {
    schema: {
      summary: 'User registration',
      description: 'Register new user account',
      tags: ['authentication'],
      body: RegisterSchema,
      response: {
        201: AuthResponseSchema,
        400: ErrorSchema,
        409: ErrorSchema
      }
    }
  }, handlers.register);

  // POST /api/auth/refresh
  fastify.post('/refresh', {
    schema: {
      summary: 'Refresh access token',
      description: 'Get new access token using refresh token',
      tags: ['authentication'],
      body: RefreshTokenSchema,
      response: {
        200: TokenResponseSchema,
        401: ErrorSchema
      }
    }
  }, handlers.refreshToken);

  // POST /api/auth/logout
  fastify.post('/logout', {
    schema: {
      summary: 'User logout',
      description: 'Invalidate user session and tokens',
      tags: ['authentication'],
      response: {
        200: MessageResponseSchema
      }
    },
    preHandler: async () => {
      // Optional JWT verification for logout
      // TODO: Add JWT verification when JWT plugin is available
    }
  }, handlers.logout);

  // GET /api/auth/me
  fastify.get('/me', {
    schema: {
      summary: 'Get current user',
      description: 'Get authenticated user information',
      tags: ['authentication'],
      response: {
        200: UserSchema,
        401: ErrorSchema
      }
    },
    preHandler: async () => {
      // TODO: Add JWT verification when JWT plugin is available
      // await request.jwtVerify();
    }
  }, handlers.getCurrentUser);
};
