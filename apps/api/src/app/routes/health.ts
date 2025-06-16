import { FastifyInstance } from 'fastify';

/**
 * Health Check and System Information Routes
 */
export default async function healthRoutes(fastify: FastifyInstance) {
  /**
   * GET /health
   * Basic health check endpoint
   */
  fastify.get(
    '/health',
    {
      schema: {
        description: 'API health check',
        tags: ['System'],
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              timestamp: { type: 'string' },
              uptime: { type: 'number' },
              version: { type: 'string' },
              environment: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
      };
    }
  );

  /**
   * GET /
   * API root endpoint
   */
  fastify.get(
    '/',
    {
      schema: {
        description: 'API root information',
        tags: ['System'],
        response: {
          200: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              version: { type: 'string' },
              description: { type: 'string' },
              documentation: { type: 'string' },
              endpoints: {
                type: 'object',
                properties: {
                  health: { type: 'string' },
                  docs: { type: 'string' },
                  auth: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const baseUrl = `${request.protocol}://${request.hostname}${
        request.hostname === 'localhost' ? ':3000' : ''
      }`;

      return {
        name: 'AegisX Platform API',
        version: process.env.npm_package_version || '1.0.0',
        description:
          'Enterprise-grade API built with Fastify and AegisX Core Libraries',
        documentation: `${baseUrl}/docs`,
        endpoints: {
          health: `${baseUrl}/health`,
          docs: `${baseUrl}/docs`,
          auth: `${baseUrl}/auth`,
        },
      };
    }
  );

  fastify.log.info('✅ Health routes registered successfully');
}
