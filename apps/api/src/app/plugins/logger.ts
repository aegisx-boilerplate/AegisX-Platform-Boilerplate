import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { loggerPlugin } from '@aegisx/core-logger';

/**
 * Logger Plugin สำหรับ AegisX Platform API
 * 
 * Plugin นี้จะติดตั้ง @aegisx/core-logger เพื่อจัดการ logging
 * 
 * Features:
 * - Request/Response logging
 * - Error logging
 * - Structured logging with JSON format
 * - Request correlation IDs
 * - Performance monitoring
 * - Exclude paths สำหรับ health checks และ static files
 * 
 * Configuration:
 * - enableRequestLogging: บันทึก incoming requests
 * - enableResponseLogging: บันทึก outgoing responses  
 * - enableErrorLogging: บันทึก errors
 * - includeHeaders: รวม headers ใน logs (ปิดเพื่อความปลอดภัย)
 * - includeBody: รวม request/response body (ปิดเพื่อความปลอดภัย)
 * - excludePaths: paths ที่ไม่ต้องการ log
 */
export default fp(async function loggerPluginWrapper(fastify: FastifyInstance) {
    await fastify.register(loggerPlugin, {
        // Request/Response logging configuration
        enableRequestLogging: true,
        enableResponseLogging: true,
        enableErrorLogging: true,

        // Security: ไม่รวม sensitive data
        includeHeaders: false, // ป้องกัน sensitive headers
        includeBody: false,    // ป้องกัน sensitive request/response data

        // Exclude paths ที่ไม่จำเป็นต้อง log
        excludePaths: [
            // Health check endpoints
            '/health',
            '/metrics',
            '/readiness',
            '/liveness',
            '/ping',
            '/status',

            // Swagger/Documentation endpoints
            '/docs',
            '/docs/static/*',
            '/docs/json',
            '/docs/yaml',

            // Static files
            '/favicon.ico',
            '/robots.txt',

            // Assets (ถ้ามี)
            '/assets/*',
            '/static/*'
        ]
    });

    fastify.log.info('✅ Logger plugin configured', {
        requestLogging: true,
        responseLogging: true,
        errorLogging: true,
        includeHeaders: false,
        includeBody: false,
        excludedPaths: [
            'health checks',
            'swagger docs',
            'static files'
        ]
    });
}, {
    name: 'logger-plugin',
    dependencies: []
}); 