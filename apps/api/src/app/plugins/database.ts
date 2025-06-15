import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import { databasePlugin, type DatabasePluginOptions } from '@aegisx/core-database';
import { config } from '@aegisx/core-config';

const database: FastifyPluginAsync = async (fastify, opts) => {
    const databaseUrl = config.getDatabaseUrl();

    if (!databaseUrl) {
        fastify.log.warn('⚠️ No database URL configured - skipping database setup');
        return;
    }

    const options: DatabasePluginOptions = {
        connectionUrl: databaseUrl,
        pool: {
            min: 2,
            max: 10
        },
        debug: config.isDevelopment()
    };

    await fastify.register(databasePlugin, options);

    fastify.log.info('✅ Database plugin registered');
    fastify.log.info('✅ Database available at fastify.db');
};

export default fp(database, {
    name: 'database'
}); 