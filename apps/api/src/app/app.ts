import * as path from 'path';
import { FastifyInstance } from 'fastify';
import AutoLoad from '@fastify/autoload';
import { logger, loggerPlugin } from '@aegisx/core-logger';
import { coreAuth } from '@aegisx/core-auth';
import { coreConfig, config } from '@aegisx/core-config';
import { coreDatabase } from '@aegisx/core-database';
import { coreErrors } from '@aegisx/core-errors';
import { coreRbac } from '@aegisx/core-rbac';

/* eslint-disable-next-line */
export interface AppOptions { }

export async function app(fastify: FastifyInstance, opts: AppOptions) {
  // Register logger plugin first
  await fastify.register(loggerPlugin, {
    enableRequestLogging: true,
    enableResponseLogging: true,
    enableErrorLogging: true,
    includeHeaders: false,
    includeBody: false,
    excludePaths: ['/health', '/metrics']
  });

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

  // Example route using Fastify context logger and config
  fastify.get('/api/test', async (request, reply) => {
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

  // Example route with error handling
  fastify.get('/api/error', async (request, reply) => {
    request.logger.warn('Error endpoint accessed - this will throw an error');
    throw new Error('This is a test error');
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
