import fp from 'fastify-plugin';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { logger } from './core-logger';
import { config } from '@aegisx/core-config';

// Extend Fastify types
declare module 'fastify' {
    interface FastifyInstance {
        logger: typeof logger;
        config: typeof config;
        createRequestLogger: (request: FastifyRequest) => typeof logger;
    }

    interface FastifyRequest {
        logger: typeof logger;
        config: typeof config;
        requestId: string;
    }
}

export interface LoggerPluginOptions {
    // Plugin options
    enableRequestLogging?: boolean;
    enableResponseLogging?: boolean;
    enableErrorLogging?: boolean;
    logLevel?: 'debug' | 'info' | 'warn' | 'error';
    includeHeaders?: boolean;
    includeBody?: boolean;
    excludePaths?: string[];
}

const DEFAULT_OPTIONS: LoggerPluginOptions = {
    enableRequestLogging: true,
    enableResponseLogging: true,
    enableErrorLogging: true,
    logLevel: 'info',
    includeHeaders: false,
    includeBody: false,
    excludePaths: ['/health', '/metrics']
};

async function loggerPlugin(
    fastify: FastifyInstance,
    options: LoggerPluginOptions = {}
) {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    // Decorate Fastify instance with logger and config
    fastify.decorate('logger', logger);
    fastify.decorate('config', config);

    // Helper function to create request-specific logger
    fastify.decorate('createRequestLogger', (request: FastifyRequest) => {
        return logger.child({
            requestId: request.id,
            method: request.method,
            url: request.url,
            userAgent: request.headers['user-agent'],
            ip: request.ip,
            ...(opts.includeHeaders && { headers: request.headers })
        });
    });

    // Request hook - add logger and config to request context
    fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
        // Skip excluded paths
        if (opts.excludePaths?.includes(request.url)) {
            return;
        }

        // Create request-specific logger
        request.logger = fastify.createRequestLogger(request);
        request.config = config;
        request.requestId = request.id;

        // Log incoming request
        if (opts.enableRequestLogging) {
            const logData: any = {
                method: request.method,
                url: request.url,
                userAgent: request.headers['user-agent'],
                ip: request.ip
            };

            if (opts.includeHeaders) {
                logData.headers = request.headers;
            }

            if (opts.includeBody && request.body) {
                logData.body = request.body;
            }

            request.logger.info('📥 Incoming request', logData);
        }
    });

    // Response hook - log response
    if (opts.enableResponseLogging) {
        fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
            // Skip excluded paths
            if (opts.excludePaths?.includes(request.url)) {
                return;
            }

            const responseTime = reply.elapsedTime || 0;

            request.logger.info('📤 Request completed', {
                method: request.method,
                url: request.url,
                statusCode: reply.statusCode,
                responseTime: `${responseTime}ms`
            });
        });
    }

    // Error handler - log errors
    if (opts.enableErrorLogging) {
        fastify.setErrorHandler(async (error, request: FastifyRequest, reply: FastifyReply) => {
            // Log error with context
            request.logger.error('💥 Request error', {
                error: {
                    message: error.message,
                    stack: error.stack,
                    name: error.name,
                    statusCode: error.statusCode
                },
                method: request.method,
                url: request.url,
                userAgent: request.headers['user-agent'],
                ip: request.ip
            });

            // Return appropriate error response
            const statusCode = error.statusCode || 500;
            const message = statusCode === 500 ? 'Internal Server Error' : error.message;

            reply.status(statusCode).send({
                error: true,
                message,
                statusCode,
                timestamp: new Date().toISOString(),
                path: request.url,
                requestId: request.id
            });
        });
    }

    // Health check endpoint (if not excluded)
    if (!opts.excludePaths?.includes('/health')) {
        fastify.get('/health', async (request, reply) => {
            request.logger.debug('Health check requested');

            return {
                status: 'ok',
                timestamp: new Date().toISOString(),
                service: request.config.get('app').name,
                version: request.config.get('app').version,
                environment: request.config.get('app').environment
            };
        });
    }
}

// Export as Fastify plugin
export default fp(loggerPlugin, {
    name: '@aegisx/core-logger-plugin',
    fastify: '5.x'
});

// Export plugin function for manual registration
export { loggerPlugin }; 