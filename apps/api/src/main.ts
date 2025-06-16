import Fastify from 'fastify';
import { app } from './app/app';
import { config } from '@aegisx/core-config';
import { logger } from '@aegisx/core-logger';

async function bootstrap() {
  // Log startup
  logger.info('🚀 Starting AegisX Platform API...');

  // Create timer for startup performance
  const startupTimer = logger.startTimer();

  try {
    // Get configuration
    const appConfig = config.get('app');
    const isDevelopment = config.isDevelopment();

    // Instantiate Fastify with logger configuration
    const server = Fastify({
      logger: {
        level: 'info',
        transport: isDevelopment
          ? {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'yyyy-mm-dd HH:MM:ss',
                ignore: 'pid,hostname',
                singleLine: false,
              },
            }
          : undefined,
      },
    });

    // Register your application as a normal plugin
    server.register(app);

    // Start listening
    await server.listen({
      port: appConfig.port,
      host: appConfig.host,
    });

    // Log successful startup
    startupTimer.done('🎉 AegisX Platform API started successfully', {
      host: appConfig.host,
      port: appConfig.port,
      environment: appConfig.environment,
      url: `http://${appConfig.host}:${appConfig.port}`,
    });
  } catch (error) {
    logger.error(
      '❌ Failed to start AegisX Platform API',
      error instanceof Error ? error : new Error(String(error))
    );
    process.exit(1);
  }
}

bootstrap();
