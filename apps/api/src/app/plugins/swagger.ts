import fp from 'fastify-plugin';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { FastifyInstance } from 'fastify';
import { config } from '@aegisx/core-config';

/**
 * Swagger Plugin สำหรับ AegisX Platform API
 * 
 * Plugin นี้จะติดตั้ง:
 * - @fastify/swagger สำหรับ OpenAPI specification
 * - @fastify/swagger-ui สำหรับ documentation UI
 * 
 * Features:
 * - OpenAPI 3.0 specification
 * - JWT Bearer authentication
 * - API Key authentication
 * - Comprehensive schemas และ tags
 * - Development และ Production server configs
 */
export default fp(async function swaggerPlugin(fastify: FastifyInstance) {
    // Register Swagger OpenAPI specification
    await fastify.register(swagger, {
        openapi: {
            openapi: '3.0.0',
            info: {
                title: 'AegisX Platform API',
                description: 'Enterprise-grade API for AegisX Platform with comprehensive security, logging, and monitoring features.',
                version: config.get('app').version,
                contact: {
                    name: 'AegisX Platform Team',
                    email: 'api@aegisx.com',
                    url: 'https://aegisx.com'
                },
                license: {
                    name: 'MIT',
                    url: 'https://opensource.org/licenses/MIT'
                },
                termsOfService: 'https://aegisx.com/terms'
            },
            servers: [
                {
                    url: `http://${config.get('app').host}:${config.get('app').port}`,
                    description: 'Development server'
                },
                {
                    url: 'https://api.aegisx.com',
                    description: 'Production server'
                },
                {
                    url: 'https://staging-api.aegisx.com',
                    description: 'Staging server'
                }
            ],
            tags: [
                {
                    name: 'Health',
                    description: 'Health check and monitoring endpoints'
                },
                {
                    name: 'Test',
                    description: 'Test and development endpoints'
                },
                {
                    name: 'Authentication',
                    description: 'User authentication and authorization'
                },
                {
                    name: 'Users',
                    description: 'User management operations'
                },
                {
                    name: 'Multi-tenancy',
                    description: 'Tenant management and operations'
                },
                {
                    name: 'Notifications',
                    description: 'Notification system endpoints'
                },
                {
                    name: 'File Storage',
                    description: 'File upload and storage operations'
                },
                {
                    name: 'Webhooks',
                    description: 'Webhook management and delivery'
                },
                {
                    name: 'WebSockets',
                    description: 'Real-time communication endpoints'
                }
            ],
            components: {
                securitySchemes: {
                    bearerAuth: {
                        type: 'http',
                        scheme: 'bearer',
                        bearerFormat: 'JWT',
                        description: 'JWT token for user authentication'
                    },
                    apiKey: {
                        type: 'apiKey',
                        in: 'header',
                        name: 'X-API-Key',
                        description: 'API key for service-to-service authentication'
                    },
                    tenantId: {
                        type: 'apiKey',
                        in: 'header',
                        name: 'X-Tenant-ID',
                        description: 'Tenant identifier for multi-tenant operations'
                    }
                },
                schemas: {
                    // Error schemas
                    Error: {
                        type: 'object',
                        properties: {
                            error: {
                                type: 'string',
                                description: 'Error type',
                                example: 'ValidationError'
                            },
                            message: {
                                type: 'string',
                                description: 'Error message',
                                example: 'Invalid input data'
                            },
                            statusCode: {
                                type: 'integer',
                                description: 'HTTP status code',
                                example: 400
                            },
                            timestamp: {
                                type: 'string',
                                format: 'date-time',
                                description: 'Error timestamp',
                                example: '2025-01-15T10:30:00.000Z'
                            },
                            requestId: {
                                type: 'string',
                                description: 'Request identifier for tracking',
                                example: 'req-123456'
                            }
                        },
                        required: ['error', 'message', 'statusCode', 'timestamp']
                    },

                    // Health schemas
                    HealthResponse: {
                        type: 'object',
                        properties: {
                            status: {
                                type: 'string',
                                enum: ['ok', 'error'],
                                description: 'Health status',
                                example: 'ok'
                            },
                            timestamp: {
                                type: 'string',
                                format: 'date-time',
                                description: 'Health check timestamp',
                                example: '2025-01-15T10:30:00.000Z'
                            },
                            service: {
                                type: 'string',
                                description: 'Service name',
                                example: 'AegisX API'
                            },
                            version: {
                                type: 'string',
                                description: 'Service version',
                                example: '1.0.0'
                            },
                            environment: {
                                type: 'string',
                                description: 'Environment name',
                                example: 'development'
                            },
                            uptime: {
                                type: 'number',
                                description: 'Service uptime in seconds',
                                example: 3600
                            }
                        },
                        required: ['status', 'timestamp', 'service', 'version', 'environment']
                    },

                    // User schemas
                    User: {
                        type: 'object',
                        properties: {
                            id: {
                                type: 'string',
                                format: 'uuid',
                                description: 'User unique identifier',
                                example: '123e4567-e89b-12d3-a456-426614174000'
                            },
                            email: {
                                type: 'string',
                                format: 'email',
                                description: 'User email address',
                                example: 'user@example.com'
                            },
                            firstName: {
                                type: 'string',
                                description: 'User first name',
                                example: 'John'
                            },
                            lastName: {
                                type: 'string',
                                description: 'User last name',
                                example: 'Doe'
                            },
                            role: {
                                type: 'string',
                                description: 'User role',
                                example: 'user'
                            },
                            isActive: {
                                type: 'boolean',
                                description: 'User active status',
                                example: true
                            },
                            createdAt: {
                                type: 'string',
                                format: 'date-time',
                                description: 'User creation timestamp',
                                example: '2025-01-15T10:30:00.000Z'
                            },
                            updatedAt: {
                                type: 'string',
                                format: 'date-time',
                                description: 'User last update timestamp',
                                example: '2025-01-15T10:30:00.000Z'
                            }
                        },
                        required: ['id', 'email', 'firstName', 'lastName', 'role', 'isActive']
                    },

                    // Pagination schemas
                    PaginationMeta: {
                        type: 'object',
                        properties: {
                            page: {
                                type: 'integer',
                                minimum: 1,
                                description: 'Current page number',
                                example: 1
                            },
                            limit: {
                                type: 'integer',
                                minimum: 1,
                                maximum: 100,
                                description: 'Items per page',
                                example: 10
                            },
                            total: {
                                type: 'integer',
                                minimum: 0,
                                description: 'Total number of items',
                                example: 100
                            },
                            totalPages: {
                                type: 'integer',
                                minimum: 0,
                                description: 'Total number of pages',
                                example: 10
                            }
                        },
                        required: ['page', 'limit', 'total', 'totalPages']
                    }
                },
                parameters: {
                    // Common parameters
                    PageParam: {
                        name: 'page',
                        in: 'query',
                        description: 'Page number for pagination',
                        required: false,
                        schema: {
                            type: 'integer',
                            minimum: 1,
                            default: 1
                        }
                    },
                    LimitParam: {
                        name: 'limit',
                        in: 'query',
                        description: 'Number of items per page',
                        required: false,
                        schema: {
                            type: 'integer',
                            minimum: 1,
                            maximum: 100,
                            default: 10
                        }
                    },
                    TenantIdHeader: {
                        name: 'X-Tenant-ID',
                        in: 'header',
                        description: 'Tenant identifier',
                        required: true,
                        schema: {
                            type: 'string',
                            format: 'uuid'
                        }
                    }
                }
            },
            security: [
                {
                    bearerAuth: []
                }
            ]
        }
    });

    // Register Swagger UI
    await fastify.register(swaggerUi, {
        routePrefix: '/docs',
        uiConfig: {
            docExpansion: 'list',
            deepLinking: true,
            defaultModelsExpandDepth: 2,
            defaultModelExpandDepth: 2,
            displayOperationId: true,
            displayRequestDuration: true,
            filter: true,
            showExtensions: true,
            showCommonExtensions: true,
            tryItOutEnabled: true
        },
        uiHooks: {
            onRequest: function (request: any, reply: any, next: any) {
                // สามารถเพิ่ม authentication check ที่นี่ได้
                next();
            },
            preHandler: function (request: any, reply: any, next: any) {
                // สามารถเพิ่ม custom headers ที่นี่ได้
                next();
            }
        },
        staticCSP: true,
        transformStaticCSP: (header: any) => header,
        transformSpecification: (swaggerObject: any, request: any, reply: any) => {
            // สามารถ modify swagger object ตาม environment ได้
            if (config.isProduction()) {
                // ซ่อน test endpoints ใน production
                const modifiedObject = { ...swaggerObject };
                modifiedObject.tags = swaggerObject.tags?.filter((tag: any) => tag.name !== 'Test');
                return modifiedObject;
            }
            return swaggerObject;
        },
        transformSpecificationClone: true
    });

    fastify.log.info('✅ Swagger documentation configured', {
        docsUrl: `/docs`,
        jsonUrl: `/docs/json`,
        yamlUrl: `/docs/yaml`,
        environment: config.get('app').environment
    });
}, {
    name: 'swagger-plugin',
    dependencies: []
}); 