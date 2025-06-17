import { AuthHandlers } from './handlers/auth.handlers';
import { authPlugin } from './plugin';
import { authRoutes } from './routes/auth.routes';

describe('Auth Module', () => {
  describe('AuthHandlers', () => {
    let handlers: AuthHandlers;

    beforeEach(() => {
      handlers = new AuthHandlers();
    });

    it('should create handlers instance', () => {
      expect(handlers).toBeTruthy();
      expect(handlers.login).toBeDefined();
      expect(handlers.register).toBeDefined();
      expect(handlers.refreshToken).toBeDefined();
      expect(handlers.logout).toBeDefined();
      expect(handlers.getCurrentUser).toBeDefined();
    });
  });

  describe('authPlugin', () => {
    it('should be defined', () => {
      expect(authPlugin).toBeDefined();
    });
  });

  describe('authRoutes', () => {
    it('should be defined', () => {
      expect(authRoutes).toBeDefined();
    });
  });
});
