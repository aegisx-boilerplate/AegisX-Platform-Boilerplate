import fp from 'fastify-plugin';
import knex, { Knex } from 'knex';
import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { logger } from '@aegisx/core-logger';

export interface DatabasePluginOptions extends FastifyPluginOptions {
    // Option 1: Connection URL
    connectionUrl?: string;

    // Option 2: Individual connection options
    type?: 'postgresql' | 'mysql';
    host?: string;
    port?: number;
    user?: string;
    password?: string;
    database?: string;
    ssl?: boolean | object;

    // Common options
    pool?: {
        min?: number;
        max?: number;
    };
    debug?: boolean;
}

// Type declaration is in apps/api/src/types/fastify.d.ts

async function databasePlugin(fastify: FastifyInstance, options: DatabasePluginOptions) {
    let config: Knex.Config;

    if (options.connectionUrl) {
        // Parse connection URL
        const url = new URL(options.connectionUrl);
        const type = url.protocol.startsWith('postgres') ? 'postgresql' : 'mysql';
        const client = type === 'postgresql' ? 'postgresql' : 'mysql2';

        config = {
            client,
            connection: options.connectionUrl,
            pool: {
                min: options.pool?.min || 2,
                max: options.pool?.max || 10
            },
            debug: options.debug || false
        };
    } else {
        // Validate required individual options
        if (!options.type || !options.host || !options.user || !options.password || !options.database) {
            throw new Error('Missing required database connection options. Provide either connectionUrl or type, host, user, password, and database.');
        }

        // Use individual options
        const client = options.type === 'postgresql' ? 'postgresql' : 'mysql2';

        config = {
            client,
            connection: {
                host: options.host,
                port: options.port || (options.type === 'postgresql' ? 5432 : 3306),
                user: options.user,
                password: options.password,
                database: options.database,
                ssl: options.ssl,
                ...(options.type === 'mysql' && {
                    charset: 'utf8mb4',
                    timezone: 'Z'
                })
            },
            pool: {
                min: options.pool?.min || 2,
                max: options.pool?.max || 10
            },
            debug: options.debug || false
        };
    }

    // Create Knex instance
    const db = knex(config);

    // Test connection
    try {
        await db.raw('SELECT 1');
        logger.info('🗄️ Database connected successfully', {
            client: config.client,
            database: typeof config.connection === 'string'
                ? new URL(config.connection).pathname.slice(1)
                : (config.connection as any).database
        });
    } catch (error) {
        logger.error('❌ Database connection failed', { error });
        throw error;
    }

    // Decorate Fastify instance
    fastify.decorate('db', db);

    // Add health check
    fastify.addHook('onReady', async () => {
        try {
            await db.raw('SELECT 1');
            logger.info('✅ Database health check passed');
        } catch (error) {
            logger.error('❌ Database health check failed', { error });
        }
    });

    // Graceful shutdown
    fastify.addHook('onClose', async () => {
        try {
            await db.destroy();
            logger.info('🗄️ Database connection closed');
        } catch (error) {
            logger.error('❌ Error closing database connection', { error });
        }
    });
}

// Export as Fastify plugin
export default fp(databasePlugin, {
    name: 'aegisx-database',
    fastify: '5.x'
}); 