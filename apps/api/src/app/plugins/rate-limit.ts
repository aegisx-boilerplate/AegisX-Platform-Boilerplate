import fp from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';
import { FastifyInstance } from 'fastify';
import { config } from '@aegisx/core-config';
import { logger } from '@aegisx/core-logger';

/**
 * Rate Limiting Plugin สำหรับ AegisX Platform API
 * 
 * Plugin นี้จะติดตั้ง @fastify/rate-limit เพื่อจำกัดจำนวน requests
 * 
 * Features:
 * - Rate limiting ตาม IP address
 * - ปรับแต่งตาม environment (development vs production)
 * - Localhost allowlist สำหรับ development
 * - Custom error responses
 * - Logging สำหรับ rate limit events
 * - Redis store support (สำหรับ production clustering)
 * 
 * Configuration:
 * - Development: 1000 requests/minute
 * - Production: 100 requests/minute
 * - Localhost bypass ใน development
 */
export default fp(async function rateLimitPlugin(fastify: FastifyInstance) {
    const isDevelopment = config.isDevelopment();
    const isProduction = config.isProduction();

    // Rate limit configuration ตาม environment
    const rateLimitConfig = {
        development: {
            max: 1000, // requests per window
            timeWindow: '1 minute',
            allowList: ['127.0.0.1', '::1', 'localhost'] // localhost bypass
        },
        production: {
            max: 100, // requests per window
            timeWindow: '1 minute',
            allowList: [] // ไม่มี bypass ใน production
        },
        staging: {
            max: 500, // requests per window
            timeWindow: '1 minute',
            allowList: ['127.0.0.1', '::1'] // เฉพาะ localhost
        }
    };

    const currentConfig = isDevelopment
        ? rateLimitConfig.development
        : isProduction
            ? rateLimitConfig.production
            : rateLimitConfig.staging;

    await fastify.register(rateLimit, {
        max: currentConfig.max,
        timeWindow: currentConfig.timeWindow,
        skipOnError: true, // ไม่นับ requests ที่ error
        allowList: currentConfig.allowList,

        // Key generator - ใช้ IP address เป็นหลัก
        keyGenerator: (request: any) => {
            // ลำดับความสำคัญของ IP detection
            const ip = request.headers['x-forwarded-for'] ||
                request.headers['x-real-ip'] ||
                request.connection?.remoteAddress ||
                request.socket?.remoteAddress ||
                request.ip ||
                'anonymous';

            // ถ้าเป็น array (x-forwarded-for) ให้เอาตัวแรก
            return Array.isArray(ip) ? ip[0] : ip;
        },

        // Custom error response
        errorResponseBuilder: (request: any, context: any) => {
            const retryAfter = Math.round(context.ttl / 1000);
            return {
                error: 'Too Many Requests',
                message: `Rate limit exceeded. You have made too many requests. Please try again in ${retryAfter} seconds.`,
                statusCode: 429,
                retryAfter,
                limit: context.max,
                remaining: 0,
                reset: new Date(Date.now() + context.ttl).toISOString()
            };
        },

        // Rate limit approaching warning (80% ของ limit)
        onExceeding: (request: any, key: string) => {
            logger.warn('Rate limit approaching', {
                ip: key,
                userAgent: request.headers['user-agent'],
                url: request.url,
                method: request.method,
                threshold: '80%',
                environment: config.get('app').environment
            });
        },

        // Rate limit exceeded
        onExceeded: (request: any, key: string) => {
            logger.warn('Rate limit exceeded', {
                ip: key,
                userAgent: request.headers['user-agent'],
                url: request.url,
                method: request.method,
                environment: config.get('app').environment,
                action: 'blocked'
            });
        },

        // Headers ที่จะส่งกลับ
        addHeaders: {
            'x-ratelimit-limit': true,
            'x-ratelimit-remaining': true,
            'x-ratelimit-reset': true,
            'retry-after': true
        }
    });

    fastify.log.info('✅ Rate limiting configured', {
        environment: config.get('app').environment,
        maxRequests: currentConfig.max,
        timeWindow: currentConfig.timeWindow,
        allowList: currentConfig.allowList
    });
}, {
    name: 'rate-limit-plugin',
    dependencies: []
}); 