import { FastifyInstance } from 'fastify';
import healthRoutes from './health';
import rootRoutes from './root';
import metricsRoutes from './metrics';

/**
 * System Routes Registration
 * Handles health checks, root info, and system metrics
 */
export default async function systemRoutes(fastify: FastifyInstance) {
  // Register all system-related routes
  await fastify.register(healthRoutes);
  await fastify.register(rootRoutes);
  await fastify.register(metricsRoutes);

  fastify.log.info('✅ System routes registered successfully');
}
