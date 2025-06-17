import { FastifyInstance } from 'fastify';

/**
 * Metrics Routes
 * Provides basic system metrics and performance data
 */
export default async function metricsRoutes(fastify: FastifyInstance) {
    // Basic metrics endpoint
    fastify.get('/metrics', async () => {
        const uptime = process.uptime();
        const memoryUsage = process.memoryUsage();

        return {
            status: 'success',
            data: {
                uptime: `${Math.floor(uptime)} seconds`,
                memory: {
                    rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
                    heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
                    heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
                    external: `${Math.round(memoryUsage.external / 1024 / 1024)} MB`
                },
                node: {
                    version: process.version,
                    platform: process.platform,
                    arch: process.arch
                },
                timestamp: new Date().toISOString()
            }
        };
    });

    fastify.log.info('📊 Metrics routes registered');
}
