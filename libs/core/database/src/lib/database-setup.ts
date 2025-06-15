import knex, { Knex } from 'knex';
import { logger } from '@aegisx/core-logger';

// Global Knex instance
let db: Knex | null = null;

export interface DatabaseConfig {
    type: 'postgresql' | 'mysql';
    host: string;
    port?: number;
    user: string;
    password: string;
    database: string;
    ssl?: boolean | object;
    pool?: {
        min?: number;
        max?: number;
    };
    debug?: boolean;
}

export function setupDatabase(config: DatabaseConfig): Knex {
    if (db) {
        logger.warn('Database already initialized, returning existing instance');
        return db;
    }

    const client = config.type === 'postgresql' ? 'postgresql' : 'mysql2';

    db = knex({
        client,
        connection: {
            host: config.host,
            port: config.port || (config.type === 'postgresql' ? 5432 : 3306),
            user: config.user,
            password: config.password,
            database: config.database,
            ssl: config.ssl,
            ...(config.type === 'mysql' && {
                charset: 'utf8mb4',
                timezone: 'Z'
            })
        },
        pool: {
            min: config.pool?.min || 2,
            max: config.pool?.max || 10
        },
        debug: config.debug || false
    });

    logger.info('🗄️ Database initialized', {
        client,
        host: config.host,
        port: config.port || (config.type === 'postgresql' ? 5432 : 3306),
        database: config.database
    });

    return db;
}

export function setupDatabaseFromUrl(connectionUrl: string): Knex {
    if (db) {
        logger.warn('Database already initialized, returning existing instance');
        return db;
    }

    const url = new URL(connectionUrl);
    const type = url.protocol.startsWith('postgres') ? 'postgresql' : 'mysql';

    const config: DatabaseConfig = {
        type,
        host: url.hostname,
        port: url.port ? parseInt(url.port) : undefined,
        user: url.username,
        password: url.password,
        database: url.pathname.slice(1), // Remove leading '/'
        ssl: url.searchParams.get('ssl') === 'true' || url.searchParams.get('sslmode') !== null
    };

    return setupDatabase(config);
}

export function getDatabase(): Knex {
    if (!db) {
        throw new Error('Database not initialized. Call setupDatabase() first.');
    }
    return db;
}

export async function closeDatabase(): Promise<void> {
    if (db) {
        await db.destroy();
        db = null;
        logger.info('🗄️ Database connection closed');
    }
}

export async function testConnection(): Promise<boolean> {
    try {
        if (!db) return false;
        await db.raw('SELECT 1');
        return true;
    } catch (error) {
        logger.error('Database connection test failed', { error });
        return false;
    }
}

// Export the db instance directly for convenience
export { db }; 