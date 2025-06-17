import Fastify from 'fastify';
import { authPlugin } from '../plugin';

describe('Auth Plugin Minimal Test', () => {
  it('should handle 401 correctly', async () => {
    const app = Fastify({ logger: false });
    await app.register(authPlugin, { useMock: true });
    await app.ready();

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'wrong@email.com',
          password: 'wrongpass'
        }
      });

      console.log('Response status:', response.statusCode);
      console.log('Response body:', response.payload);
      
      expect(response.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });
});
