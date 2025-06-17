import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import { authPlugin, type AuthPluginOptions } from '@aegisx/features-system-auth';
import { config } from '@aegisx/core-config';

const auth: FastifyPluginAsync = async (fastify) => {
    // Make sure database is available first
    if (!fastify.db) {
        throw new Error('Database must be registered before auth plugin. Make sure database plugin is loaded first.');
    }

    const options: AuthPluginOptions = {
        // Use mock in development/test, real database in production
        useMock: config.isDevelopment() && process.env.NODE_ENV === 'test',
        prefix: '/api/auth'
    };

    await fastify.register(authPlugin, options);

    fastify.log.info('✅ Auth plugin registered');
    fastify.log.info(`✅ Auth endpoints available at ${options.prefix}`);
};

export default fp(auth, {
    name: 'auth',
    dependencies: ['database'] // Ensure database is loaded first
});
