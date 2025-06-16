import { FastifyInstance } from 'fastify';
import { TokenService, AuthConfig, JwtUtils } from '@aegisx/core-auth';

/**
 * Authentication Routes
 * Uses @aegisx/core-auth for JWT token management
 */
export default async function authRoutes(fastify: FastifyInstance) {
  // Initialize auth configuration (this should come from @aegisx/core-config)
  const authConfig: AuthConfig = {
    jwt: {
      secret: process.env.JWT_SECRET || JwtUtils.generateSecureSecret(),
      accessTokenExpiry: process.env.JWT_ACCESS_TOKEN_EXPIRY || '15m',
      refreshTokenExpiry: process.env.JWT_REFRESH_TOKEN_EXPIRY || '7d',
      issuer: process.env.JWT_ISSUER || 'aegisx-api',
      algorithm: (process.env.JWT_ALGORITHM as any) || 'HS256',
    },
    security: {
      maxLoginAttempts: 5,
      lockoutDuration: 15,
      passwordMinLength: 8,
      requireEmailVerification: true,
    },
  };

  // Validate configuration
  const validation = JwtUtils.validateJwtConfig(authConfig.jwt);
  if (!validation.valid) {
    fastify.log.error('Invalid JWT configuration:', validation.errors);
    throw new Error(
      `Invalid JWT configuration: ${validation.errors.join(', ')}`
    );
  }

  // Initialize token service
  const tokenService = new TokenService(authConfig);

  // Register token service to Fastify instance
  fastify.decorate('tokenService', tokenService);

  /**
   * POST /auth/login
   * Authenticate user and return JWT tokens
   */
  fastify.post(
    '/auth/login',
    {
      schema: {
        description: 'User login with email and password',
        tags: ['Authentication'],
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address',
            },
            password: {
              type: 'string',
              minLength: 1,
              description: 'User password',
            },
            rememberMe: {
              type: 'boolean',
              default: false,
              description: 'Extended session duration',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              user: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  email: { type: 'string' },
                  firstName: { type: 'string' },
                  lastName: { type: 'string' },
                },
              },
              tokens: {
                type: 'object',
                properties: {
                  accessToken: { type: 'string' },
                  refreshToken: { type: 'string' },
                  tokenType: { type: 'string' },
                  expiresIn: { type: 'number' },
                },
              },
            },
          },
          401: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { email, password, rememberMe } = request.body as any;

      try {
        // TODO: Replace with actual user validation using @aegisx/feature-user-management
        const user = await validateUserCredentials(email, password);

        if (!user) {
          return reply.code(401).send({
            success: false,
            error: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password',
          });
        }

        // Generate session ID for tracking
        const sessionId = JwtUtils.generateJwtId();

        // Generate tokens using core-auth
        const tokens = tokenService.generateTokenPair(
          user.id,
          user.email,
          sessionId
        );

        // Log successful login
        fastify.log.info('User logged in successfully', {
          userId: user.id,
          email: user.email,
          sessionId,
          ip: JwtUtils.extractIpAddress(request),
          userAgent: JwtUtils.extractUserAgent(request.headers['user-agent']),
          rememberMe,
        });

        return reply.code(200).send({
          success: true,
          message: 'Login successful',
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
          },
          tokens,
        });
      } catch (error) {
        fastify.log.error('Login error:', error);
        return reply.code(500).send({
          success: false,
          error: 'LOGIN_FAILED',
          message: 'An error occurred during login',
        });
      }
    }
  );

  /**
   * POST /auth/refresh
   * Refresh access token using refresh token
   */
  fastify.post(
    '/auth/refresh',
    {
      schema: {
        description: 'Refresh access token',
        tags: ['Authentication'],
        body: {
          type: 'object',
          required: ['refreshToken'],
          properties: {
            refreshToken: {
              type: 'string',
              description: 'Valid refresh token',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              tokens: {
                type: 'object',
                properties: {
                  accessToken: { type: 'string' },
                  refreshToken: { type: 'string' },
                  tokenType: { type: 'string' },
                  expiresIn: { type: 'number' },
                },
              },
            },
          },
          401: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { refreshToken } = request.body as any;

      try {
        // Verify refresh token using core-auth
        const payload = tokenService.verifyRefreshToken(refreshToken);

        // TODO: Check if session is still valid in database
        // TODO: Check if user still exists and is active

        // Generate new token pair
        const tokens = tokenService.generateTokenPair(
          payload.sub,
          payload.email,
          payload.jti
        );

        fastify.log.info('Token refreshed successfully', {
          userId: payload.sub,
          sessionId: payload.jti,
        });

        return reply.code(200).send({
          success: true,
          message: 'Token refreshed successfully',
          tokens,
        });
      } catch (error) {
        fastify.log.warn('Token refresh failed:', error);
        return reply.code(401).send({
          success: false,
          error: 'INVALID_REFRESH_TOKEN',
          message: 'Invalid or expired refresh token',
        });
      }
    }
  );

  /**
   * POST /auth/logout
   * Logout user and invalidate session
   */
  fastify.post(
    '/auth/logout',
    {
      preHandler: [authenticate], // Requires authentication
      schema: {
        description: 'User logout',
        tags: ['Authentication'],
        headers: {
          type: 'object',
          required: ['authorization'],
          properties: {
            authorization: {
              type: 'string',
              pattern: '^Bearer .+$',
              description: 'Bearer JWT token',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: any, reply) => {
      try {
        // TODO: Invalidate session in database
        // TODO: Add token to blacklist if needed

        fastify.log.info('User logged out', {
          userId: request.user.id,
          sessionId: request.sessionId,
        });

        return reply.code(200).send({
          success: true,
          message: 'Logout successful',
        });
      } catch (error) {
        fastify.log.error('Logout error:', error);
        return reply.code(500).send({
          success: false,
          error: 'LOGOUT_FAILED',
          message: 'An error occurred during logout',
        });
      }
    }
  );

  /**
   * GET /auth/me
   * Get current user profile
   */
  fastify.get(
    '/auth/me',
    {
      preHandler: [authenticate], // Requires authentication
      schema: {
        description: 'Get current user profile',
        tags: ['Authentication'],
        headers: {
          type: 'object',
          required: ['authorization'],
          properties: {
            authorization: {
              type: 'string',
              pattern: '^Bearer .+$',
              description: 'Bearer JWT token',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              user: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  email: { type: 'string' },
                  firstName: { type: 'string' },
                  lastName: { type: 'string' },
                  emailVerified: { type: 'boolean' },
                  createdAt: { type: 'string' },
                  lastLoginAt: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request: any, reply) => {
      try {
        // TODO: Fetch full user details from database using @aegisx/feature-user-management
        const user = await getUserById(request.user.id);

        if (!user) {
          return reply.code(404).send({
            success: false,
            error: 'USER_NOT_FOUND',
            message: 'User not found',
          });
        }

        return reply.code(200).send({
          success: true,
          user,
        });
      } catch (error) {
        fastify.log.error('Get user profile error:', error);
        return reply.code(500).send({
          success: false,
          error: 'PROFILE_FETCH_FAILED',
          message: 'Failed to fetch user profile',
        });
      }
    }
  );

  /**
   * Authentication middleware
   * Uses @aegisx/core-auth TokenService
   */
  async function authenticate(request: any, reply: any) {
    try {
      const authHeader = request.headers.authorization;

      if (!authHeader) {
        return reply.code(401).send({
          success: false,
          error: 'MISSING_AUTH_HEADER',
          message: 'Authorization header is required',
        });
      }

      const token = tokenService.extractTokenFromHeader(authHeader);

      if (!token) {
        return reply.code(401).send({
          success: false,
          error: 'INVALID_AUTH_FORMAT',
          message: 'Authorization header must be in format: Bearer <token>',
        });
      }

      const payload = tokenService.verifyAccessToken(token);

      // Attach user info to request
      request.user = {
        id: payload.sub,
        email: payload.email,
      };

      // Attach session ID if available
      if (payload.jti) {
        request.sessionId = payload.jti;
      }
    } catch (error) {
      if (error instanceof Error) {
        switch (error.message) {
          case 'AUTH_TOKEN_EXPIRED':
            return reply.code(401).send({
              success: false,
              error: 'TOKEN_EXPIRED',
              message:
                'Token has expired. Please refresh your token or login again.',
            });
          case 'AUTH_TOKEN_INVALID':
          case 'AUTH_INVALID_TOKEN_TYPE':
            return reply.code(401).send({
              success: false,
              error: 'INVALID_TOKEN',
              message: 'The provided token is invalid',
            });
          case 'AUTH_TOKEN_NOT_ACTIVE':
            return reply.code(401).send({
              success: false,
              error: 'TOKEN_NOT_ACTIVE',
              message: 'This token cannot be used yet',
            });
          default:
            fastify.log.error('Authentication error:', error);
            return reply.code(401).send({
              success: false,
              error: 'AUTHENTICATION_FAILED',
              message: 'Unable to authenticate request',
            });
        }
      }

      return reply.code(500).send({
        success: false,
        error: 'AUTH_ERROR',
        message: 'An unexpected error occurred during authentication',
      });
    }
  }

  fastify.log.info('🔐 Authentication routes registered successfully');
}

// Mock functions - Replace with actual implementations from @aegisx/feature-user-management
async function validateUserCredentials(email: string, password: string) {
  // TODO: Implement actual user validation
  // This should:
  // 1. Check if user exists
  // 2. Verify password hash
  // 3. Check account status (active, locked, etc.)
  // 4. Update last login time

  // Mock implementation for testing
  if (email === 'test@example.com' && password === 'password123') {
    return {
      id: 'user-123',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
    };
  }

  return null;
}

async function getUserById(id: string) {
  // TODO: Fetch user from database using @aegisx/feature-user-management
  // Mock implementation
  return {
    id,
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    emailVerified: true,
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };
}

// Extend Fastify types for request user
declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      email: string;
    };
    sessionId?: string;
  }

  interface FastifyInstance {
    tokenService?: TokenService;
  }
}
