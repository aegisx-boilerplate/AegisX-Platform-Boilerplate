import Fastify, { FastifyInstance } from 'fastify';
import { authPlugin } from './plugin';
import { mockAuthService } from './mocks/auth.mock';
import { UnauthorizedError } from './errors/auth.errors';

describe('Auth Plugin Integration', () => {

  describe('Mock Implementation', () => {
    let app: FastifyInstance;

    beforeEach(async () => {
      app = Fastify({
        logger: false // Disable logging for tests
      });
      
      // Use mock implementation for tests
      await app.register(authPlugin, { useMock: true });
      await app.ready();
    });

    afterEach(async () => {
      await app.close();
    });

    describe('POST /api/auth/login', () => {
      it('should login with valid credentials', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/api/auth/login',
          payload: {
            email: 'admin@aegisx.com',
            password: 'password123'
          }
        });

        if (response.statusCode !== 200) {
          console.log('Error response:', response.payload);
        }

        expect(response.statusCode).toBe(200);
        
        const payload = JSON.parse(response.payload);
        expect(payload).toHaveProperty('accessToken');
        expect(payload).toHaveProperty('refreshToken');
        expect(payload).toHaveProperty('user');
        expect(payload.user.email).toBe('admin@aegisx.com');
      });      it('should return 401 for invalid credentials', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/api/auth/login',
          payload: {
            email: 'invalid@example.com',
            password: 'wrongpassword'
          }
        });

        // Debug the error
        if (response.statusCode === 500) {
          const payload = JSON.parse(response.payload);
          console.log('500 Error Details:', payload);
        }

        expect(response.statusCode).toBe(401);
        
        const payload = JSON.parse(response.payload);
        expect(payload).toHaveProperty('error');
      });

      it('should return 400 for invalid email format', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/api/auth/login',
          payload: {
            email: 'invalid-email',
            password: 'password123'
          }
        });

        expect(response.statusCode).toBe(400);
      });

      it('should return 400 for short password', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/api/auth/login',
          payload: {
            email: 'test@example.com',
            password: '123'
          }
        });

        expect(response.statusCode).toBe(400);
      });
    });

    describe('POST /api/auth/register', () => {
      it('should register new user successfully', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/api/auth/register',
          payload: {
            email: 'newuser@example.com',
            password: 'password123',
            firstName: 'John',
            lastName: 'Doe'
          }
        });

        expect(response.statusCode).toBe(201);
        
        const payload = JSON.parse(response.payload);
        expect(payload).toHaveProperty('accessToken');
        expect(payload).toHaveProperty('refreshToken');
        expect(payload).toHaveProperty('user');
        expect(payload.user.email).toBe('newuser@example.com');
        expect(payload.user.firstName).toBe('John');
        expect(payload.user.lastName).toBe('Doe');
      });

      it('should return 409 for existing user', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/api/auth/register',
          payload: {
            email: 'admin@aegisx.com', // Existing user in mock
            password: 'password123',
            firstName: 'Test',
            lastName: 'User'
          }
        });

        expect(response.statusCode).toBe(409);
        
        const payload = JSON.parse(response.payload);
        expect(payload).toHaveProperty('error');
      });
    });

    describe('POST /api/auth/refresh', () => {
      it('should refresh token successfully', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/api/auth/refresh',
          payload: {
            refreshToken: 'mock-refresh-token'
          }
        });

        expect(response.statusCode).toBe(200);
        
        const payload = JSON.parse(response.payload);
        expect(payload).toHaveProperty('accessToken');
        expect(payload).toHaveProperty('refreshToken');
      });

      it('should return 401 for invalid refresh token', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/api/auth/refresh',
          payload: {
            refreshToken: 'invalid-token'
          }
        });

        expect(response.statusCode).toBe(401);
      });
    });

    describe('POST /api/auth/logout', () => {
      it('should logout successfully', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/api/auth/logout'
        });

        expect(response.statusCode).toBe(200);
        
        const payload = JSON.parse(response.payload);
        expect(payload.message).toBe('Logged out successfully');
      });
    });

    describe('GET /api/auth/me', () => {
      it('should return 401 for unauthenticated request', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/auth/me'
        });

        expect(response.statusCode).toBe(401);
      });
    });
  });

  describe('Real Implementation (Unit Tests)', () => {
    // Note: Real implementation tests would require actual database
    // These are placeholder tests that verify the structure is correct
    
    it('should export real services', async () => {
      const { AuthService, TokenService, UserRepository } = await import('./auth');
      
      expect(AuthService).toBeDefined();
      expect(TokenService).toBeDefined();
      expect(UserRepository).toBeDefined();
    });

    it('should export configuration functions', async () => {
      const { 
        registerAuthServices,
        initializeAuthServices
      } = await import('./auth');
      
      expect(registerAuthServices).toBeDefined();
      expect(initializeAuthServices).toBeDefined();
    });
  });

  describe('Mock Service Direct Test', () => {
    it('should throw UnauthorizedError for invalid credentials', async () => {
      try {
        await mockAuthService.login({
          email: 'invalid@example.com',
          password: 'wrongpassword'
        });
        fail('Should have thrown an error');
      } catch (error) {
        console.log('Direct test - Error type:', error.constructor.name);
        console.log('Direct test - Error instanceof UnauthorizedError:', error instanceof UnauthorizedError);
        console.log('Direct test - Error message:', error.message);
        console.log('Direct test - Error statusCode:', error.statusCode);
        expect(error).toBeInstanceOf(UnauthorizedError);
        expect(error.statusCode).toBe(401);
      }
    });
  });
});
