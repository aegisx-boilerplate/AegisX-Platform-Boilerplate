import * as path from 'path';
import { FastifyInstance } from 'fastify';
import AutoLoad from '@fastify/autoload';
import { logger } from '@aegisx/core-logger';
import { coreAuth } from '@aegisx/core-auth';
import { coreConfig, config } from '@aegisx/core-config';
import { coreDatabase } from '@aegisx/core-database';
import { coreErrors } from '@aegisx/core-errors';
import { coreRbac } from '@aegisx/core-rbac';

/* eslint-disable-next-line */
export interface AppOptions { }

export async function app(fastify: FastifyInstance, opts: AppOptions) {
  // Place here your custom code!
  logger.info('🔧 Testing All Core Libraries');

  // Test all core libraries
  const coreLibraries = {
    logger: logger.getConfig().service,
    auth: coreAuth(),
    config: coreConfig(),
    database: coreDatabase(),
    errors: coreErrors(),
    rbac: coreRbac()
  };

  logger.info('📚 Core Libraries Status', coreLibraries);

  // Test core config with structured logging
  logger.info('⚙️ Configuration Testing');

  const configSummary = {
    app: config.get('app'),
    databaseUrl: config.getDatabaseUrl(),
    redisUrl: config.getRedisUrl(),
    environment: {
      isDevelopment: config.isDevelopment(),
      isProduction: config.isProduction(),
      isStaging: config.isStaging()
    },
    jwt: {
      expiresIn: config.get('jwt').expiresIn,
      refreshExpiresIn: config.get('jwt').refreshExpiresIn,
      issuer: config.get('jwt').issuer,
      hasSecret: !!config.get('jwt').secret
    }
  };

  logger.info('📋 Configuration Summary', configSummary);
  logger.info('✅ All Core Libraries Working!');

  // Add request logging middleware
  fastify.addHook('onRequest', async (request, reply) => {
    const requestLogger = logger.child({
      requestId: request.id,
      method: request.method,
      url: request.url,
      userAgent: request.headers['user-agent'],
      ip: request.ip
    });

    requestLogger.info('📥 Incoming request');
  });

  // Add response logging middleware  
  fastify.addHook('onResponse', async (request, reply) => {
    logger.info('📤 Request completed', {
      requestId: request.id,
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode
    });
  });

  // Add error logging middleware
  fastify.setErrorHandler(async (error, request, reply) => {
    logger.error('💥 Request error', error instanceof Error ? error : new Error(String(error)));

    // Return appropriate error response
    const statusCode = error.statusCode || 500;
    const message = statusCode === 500 ? 'Internal Server Error' : error.message;

    reply.status(statusCode).send({
      error: true,
      message,
      statusCode,
      timestamp: new Date().toISOString(),
      path: request.url
    });
  });

  // Do not touch the following lines

  // This loads all plugins defined in plugins
  // those should be support plugins that are reused
  // through your application
  fastify.register(AutoLoad, {
    dir: path.join(__dirname, 'plugins'),
    options: { ...opts },
  });

  // This loads all plugins defined in routes
  // define your routes in one of these
  fastify.register(AutoLoad, {
    dir: path.join(__dirname, 'routes'),
    options: { ...opts },
  });
}
