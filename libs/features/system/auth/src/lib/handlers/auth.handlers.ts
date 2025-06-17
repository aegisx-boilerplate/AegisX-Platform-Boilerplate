import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { container } from 'tsyringe';
import {
  LoginRequest,
  RegisterRequest,
  RefreshTokenRequest,
  User
} from '../schemas';
import {
  handleAuthError
} from '../errors/auth.errors';
import { AuthService } from '../services/auth.service';

interface AuthenticatedRequest extends FastifyRequest {
  user: User;
}

/**
 * Get auth service from container or fallback to mock
 */
function getAuthService(fastify: FastifyInstance) {
  // Check if using mock (from plugin options)
  if ((fastify as any).mockAuthService) {
    return (fastify as any).mockAuthService;
  }
  
  // Otherwise use real service from DI container
  return container.resolve<AuthService>('AuthService');
}

/**
 * Auth request handlers with database integration
 * Contains HTTP layer logic for authentication endpoints
 */
export class AuthHandlers {
  
  async login(
    request: FastifyRequest<{ Body: LoginRequest }>,
    reply: FastifyReply
  ) {
    try {
      // Get auth service (mock or real)
      const authService = getAuthService(request.server);
      
      const { email, password } = request.body;
      
      const result = await authService.login({ email, password });
      
      request.log.info('User logged in successfully', { 
        userId: result.user.id,
        email: result.user.email
      });
      
      return reply.code(200).send(result);

    } catch (error) {
      request.log.error('Login error:', error);
      const { statusCode, response } = handleAuthError(error as Error);
      return reply.code(statusCode).send(response);
    }
  }

  async register(
    request: FastifyRequest<{ Body: RegisterRequest }>,
    reply: FastifyReply
  ) {
    try {
      const authService = getAuthService(request.server);
      
      const { email, firstName, lastName, password } = request.body;
      
      const result = await authService.register({
        email,
        password,
        firstName,
        lastName
      });

      request.log.info('User registered successfully', { 
        userId: result.user.id,
        email: result.user.email
      });

      return reply.code(201).send(result);

    } catch (error) {
      request.log.error('Registration error:', error);
      const { statusCode, response } = handleAuthError(error as Error);
      return reply.code(statusCode).send(response);
    }
  }

  async refreshToken(
    request: FastifyRequest<{ Body: RefreshTokenRequest }>,
    reply: FastifyReply
  ) {
    try {
      const authService = getAuthService(request.server);
      const { refreshToken } = request.body;

      const result = await authService.refreshToken(refreshToken);
      
      return reply.code(200).send(result);

    } catch (error) {
      request.log.error('Refresh token error:', error);
      const { statusCode, response } = handleAuthError(error as Error);
      return reply.code(statusCode).send(response);
    }
  }

  async logout(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      // TODO: Implement token invalidation logic
      request.log.info('User logged out');

      return reply.code(200).send({
        message: 'Logged out successfully'
      });

    } catch (error) {
      request.log.error('Logout error:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'An error occurred during logout'
      });
    }
  }

  async getCurrentUser(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      // TODO: Get user from JWT token
      const user = (request as AuthenticatedRequest).user;

      if (!user) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'No authenticated user found'
        });
      }

      return reply.code(200).send(user);

    } catch (error) {
      request.log.error('Get current user error:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'An error occurred while fetching user data'
      });
    }
  }
}
