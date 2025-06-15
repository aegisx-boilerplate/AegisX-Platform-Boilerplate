import { FastifyInstance } from 'fastify';

export default async function testRoutes(fastify: FastifyInstance) {
    // Test endpoint
    fastify.get('/api/test', {
        schema: {
            tags: ['Test'],
            summary: 'Test endpoint',
            description: 'Test endpoint to verify API functionality and demonstrate logging',
            response: {
                200: {
                    description: 'Successful response',
                    type: 'object',
                    properties: {
                        message: {
                            type: 'string',
                            description: 'Welcome message'
                        },
                        service: {
                            type: 'string',
                            description: 'Service name'
                        },
                        version: {
                            type: 'string',
                            description: 'Service version'
                        },
                        environment: {
                            type: 'string',
                            description: 'Environment name'
                        },
                        requestId: {
                            type: 'string',
                            description: 'Unique request identifier'
                        },
                        timestamp: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Response timestamp'
                        }
                    },
                    required: ['message', 'service', 'version', 'environment', 'requestId', 'timestamp']
                }
            }
        }
    }, async (request, reply) => {
        // ใช้ logger และ config จาก request context
        request.logger.info('Test endpoint accessed', {
            userAgent: request.headers['user-agent']
        });

        const appConfig = request.config.get('app');

        return {
            message: 'Hello from AegisX API!',
            service: appConfig.name,
            version: appConfig.version,
            environment: appConfig.environment,
            requestId: request.requestId,
            timestamp: new Date().toISOString()
        };
    });

    // Error test endpoint
    fastify.get('/api/error', {
        schema: {
            tags: ['Test'],
            summary: 'Error test endpoint',
            description: 'Test endpoint that intentionally throws an error to demonstrate error handling',
            response: {
                500: {
                    description: 'Internal server error',
                    type: 'object',
                    properties: {
                        error: {
                            type: 'string',
                            description: 'Error type',
                            example: 'Error'
                        },
                        message: {
                            type: 'string',
                            description: 'Error message',
                            example: 'This is a test error'
                        },
                        statusCode: {
                            type: 'integer',
                            description: 'HTTP status code',
                            example: 500
                        },
                        timestamp: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Error timestamp'
                        },
                        requestId: {
                            type: 'string',
                            description: 'Request identifier for tracking'
                        }
                    },
                    required: ['error', 'message', 'statusCode', 'timestamp']
                }
            }
        }
    }, async (request, reply) => {
        request.logger.warn('Error endpoint accessed - this will throw an error');
        throw new Error('This is a test error');
    });
} 