import fp from 'fastify-plugin';
import helmet from '@fastify/helmet';
import { FastifyInstance } from 'fastify';
import { config } from '@aegisx/core-config';

/**
 * Helmet Security Plugin สำหรับ AegisX Platform API
 * 
 * Plugin นี้จะติดตั้ง @fastify/helmet เพื่อเพิ่ม security headers
 * 
 * Features:
 * - Content Security Policy (CSP)
 * - HTTP Strict Transport Security (HSTS)
 * - X-Frame-Options
 * - X-Content-Type-Options
 * - X-XSS-Protection
 * - Referrer-Policy
 * - และ security headers อื่นๆ
 * 
 * Configuration:
 * - รองรับ Swagger UI (unsafe-inline, unsafe-eval)
 * - ปรับแต่งตาม environment
 * - HSTS สำหรับ production
 */
export default fp(async function helmetPlugin(fastify: FastifyInstance) {
    const isDevelopment = config.isDevelopment();
    const isProduction = config.isProduction();

    await fastify.register(helmet, {
        // Content Security Policy
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: [
                    "'self'",
                    "'unsafe-inline'", // สำหรับ Swagger UI
                    ...(isDevelopment ? ["'unsafe-eval'"] : []) // เฉพาะ development
                ],
                scriptSrc: [
                    "'self'",
                    "'unsafe-inline'", // สำหรับ Swagger UI
                    "'unsafe-eval'" // สำหรับ Swagger UI
                ],
                imgSrc: [
                    "'self'",
                    "data:",
                    "https:",
                    "validator.swagger.io" // สำหรับ Swagger UI
                ],
                connectSrc: ["'self'"],
                fontSrc: ["'self'"],
                objectSrc: ["'none'"],
                mediaSrc: ["'self'"],
                frameSrc: ["'none'"],
                baseUri: ["'self'"],
                formAction: ["'self'"]
            },
            // ใน development อาจจะผ่อนปรนกฎบางอย่าง
            reportOnly: isDevelopment
        },

        // Cross-Origin Embedder Policy
        crossOriginEmbedderPolicy: false, // ปิดเพื่อให้ API ทำงานได้

        // HTTP Strict Transport Security
        hsts: isProduction ? {
            maxAge: 31536000, // 1 ปี
            includeSubDomains: true,
            preload: true
        } : false, // ปิดใน development

        // X-Frame-Options
        frameguard: {
            action: 'deny'
        },

        // X-Content-Type-Options
        noSniff: true,

        // X-XSS-Protection
        xssFilter: true,

        // Referrer Policy
        referrerPolicy: {
            policy: 'strict-origin-when-cross-origin'
        },

        // X-Permitted-Cross-Domain-Policies
        permittedCrossDomainPolicies: false,

        // X-Download-Options
        ieNoOpen: true,

        // X-DNS-Prefetch-Control
        dnsPrefetchControl: {
            allow: false
        },




    });

    fastify.log.info('✅ Helmet security headers configured', {
        environment: config.get('app').environment,
        hsts: isProduction,
        cspReportOnly: isDevelopment,
        features: [
            'Content Security Policy',
            'X-Frame-Options',
            'X-Content-Type-Options',
            'X-XSS-Protection',
            'Referrer-Policy',
            ...(isProduction ? ['HSTS'] : [])
        ]
    });
}, {
    name: 'helmet-plugin',
    dependencies: []
}); 