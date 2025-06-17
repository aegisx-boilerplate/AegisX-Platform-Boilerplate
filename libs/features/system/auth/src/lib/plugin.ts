import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { authRoutes } from './routes/auth.routes';
import { 
  initializeAuthServices, 
  cleanupAuthServices
} from './config/auth.config';

/**
 * Auth plugin options
 */
export interface AuthPluginOptions {
  /**
   * Whether to use mock implementation (for testing/development)
   * Default: false (use real implementation with Knex)
   */
  useMock?: boolean;
  
  /**
   * Route prefix for auth endpoints
   * Default: '/api/auth'
   */
  prefix?: string;
}

/**
 * Authentication plugin for Fastify with Knex database integration
 * Requires @aegisx/core-database and @aegisx/core-auth to be registered first
 */
export const authPlugin: FastifyPluginAsync<AuthPluginOptions> = async (
  fastify: FastifyInstance,
  options: AuthPluginOptions = {}
) => {
  const { 
    useMock = false, 
    prefix = '/api/auth' 
  } = options;

  // Initialize services based on configuration
  if (useMock) {
    // Use mock implementation for development/testing
    fastify.log.info('Auth plugin: Using mock implementation');
    
    // Register mock service (we'll keep the mock for testing)
    const { mockAuthService } = await import('./mocks/auth.mock.js');
    fastify.decorate('mockAuthService', mockAuthService);
  } else {
    // Use real implementation with Knex database
    fastify.log.info('Auth plugin: Using real Knex database implementation');
    
    // Make sure database plugin is registered first
    if (!fastify.db) {
      throw new Error('Database instance not found. Please register @aegisx/core-database plugin before auth plugin.');
    }

    // Initialize auth services with Knex instance
    initializeAuthServices(fastify);
  }

  // Register authentication routes
  await fastify.register(authRoutes, { prefix });

  // Add lifecycle hooks
  fastify.addHook('onClose', async () => {
    if (!useMock) {
      await cleanupAuthServices();
    }
  });

  fastify.log.info(`Auth plugin registered with prefix: ${prefix}`);
};

export default authPlugin;
