import { mockAuthService } from './mocks/auth.mock';
import { UnauthorizedError } from './errors/auth.errors';

describe('Mock Service Direct Test', () => {
  it('should throw UnauthorizedError for invalid credentials', async () => {
    try {
      await mockAuthService.login({
        email: 'invalid@example.com',
        password: 'wrongpassword'
      });
      fail('Should have thrown an error');
    } catch (error) {
      console.log('Error type:', error.constructor.name);
      console.log('Error instanceof UnauthorizedError:', error instanceof UnauthorizedError);
      console.log('Error message:', error.message);
      expect(error).toBeInstanceOf(UnauthorizedError);
      expect(error.statusCode).toBe(401);
    }
  });
});
