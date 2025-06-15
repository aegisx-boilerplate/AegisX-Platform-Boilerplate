import pino, { Logger, LoggerOptions } from 'pino';
import { config } from '@aegisx/core-config';

// Logger configuration interface
export interface LoggerConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  format: 'json' | 'pretty';
  enableConsole: boolean;
  enableFile: boolean;
  filePath?: string;
  maxFileSize?: string;
  maxFiles?: number;
  service?: string;
}

// Default logger configuration
const DEFAULT_CONFIG: LoggerConfig = {
  level: 'info',
  format: 'json',
  enableConsole: true,
  enableFile: false,
  service: 'aegisx-platform'
};

// Logger Manager class
export class LoggerManager {
  private static instance: LoggerManager;
  private logger: Logger;
  private config: LoggerConfig;

  private constructor(customConfig?: Partial<LoggerConfig>) {
    this.config = this.loadConfig(customConfig);
    this.logger = this.createLogger();
  }

  public static getInstance(customConfig?: Partial<LoggerConfig>): LoggerManager {
    if (!LoggerManager.instance) {
      LoggerManager.instance = new LoggerManager(customConfig);
    }
    return LoggerManager.instance;
  }

  private loadConfig(customConfig?: Partial<LoggerConfig>): LoggerConfig {
    try {
      // Get logging config from @aegisx/core-config
      const coreConfig = config.get('logging');
      const appConfig = config.get('app');

      return {
        ...DEFAULT_CONFIG,
        level: coreConfig.level,
        format: coreConfig.format,
        enableConsole: coreConfig.enableConsole,
        enableFile: coreConfig.enableFile,
        filePath: coreConfig.filePath,
        maxFileSize: coreConfig.maxFileSize,
        maxFiles: coreConfig.maxFiles,
        service: appConfig.name,
        ...customConfig
      };
    } catch (error) {
      // Fallback to default config if core-config is not available
      console.warn('Core config not available, using default logger config');
      return {
        ...DEFAULT_CONFIG,
        ...customConfig
      };
    }
  }

  private createLogger(): Logger {
    const isDevelopment = config?.isDevelopment() ?? process.env.NODE_ENV === 'development';

    const options: LoggerOptions = {
      level: this.config.level,
      base: {
        service: this.config.service,
        environment: isDevelopment ? 'development' :
          config?.isProduction() ? 'production' :
            config?.isStaging() ? 'staging' : 'unknown'
      }
    };

    // Simple pretty printing for development without transport
    if (isDevelopment && this.config.format === 'pretty') {
      options.transport = {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'yyyy-mm-dd HH:MM:ss',
          ignore: 'pid,hostname',
          singleLine: false,
          sync: true // Use sync mode to avoid flush issues
        }
      };
    }

    return pino(options);
  }

  // Get the Pino logger instance (for Fastify integration)
  public getPinoLogger(): Logger {
    return this.logger;
  }

  // Logging methods
  public debug(message: string, meta?: object): void {
    this.logger.debug(meta, message);
  }

  public info(message: string, meta?: object): void {
    this.logger.info(meta, message);
  }

  public warn(message: string, meta?: object): void {
    this.logger.warn(meta, message);
  }

  public error(message: string, error?: Error | object): void {
    if (error instanceof Error) {
      this.logger.error({
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name
        }
      }, message);
    } else {
      this.logger.error(error, message);
    }
  }

  // Create child logger with additional context
  public child(bindings: object): LoggerManager {
    const childLogger = new LoggerManager();
    childLogger.logger = this.logger.child(bindings);
    childLogger.config = this.config;
    return childLogger;
  }

  // Performance timing
  public startTimer(): { done: (message: string, meta?: object) => void } {
    const start = Date.now();
    return {
      done: (message: string, meta?: object) => {
        const duration = Date.now() - start;
        this.info(message, { ...meta, duration: `${duration}ms` });
      }
    };
  }

  // Get current configuration
  public getConfig(): LoggerConfig {
    return { ...this.config };
  }

  // Update log level at runtime
  public setLevel(level: 'debug' | 'info' | 'warn' | 'error'): void {
    this.logger.level = level;
    this.config.level = level;
  }

  // Flush logs (useful for testing or shutdown)
  public flush(): void {
    // Simple flush without timeout issues
    try {
      this.logger.flush();
    } catch (error) {
      // Ignore flush errors to prevent blocking
    }
  }
}

// Create singleton instance
const loggerManager = LoggerManager.getInstance();

// Export logger instance for easy use
export const logger = {
  debug: (message: string, meta?: object) => loggerManager.debug(message, meta),
  info: (message: string, meta?: object) => loggerManager.info(message, meta),
  warn: (message: string, meta?: object) => loggerManager.warn(message, meta),
  error: (message: string, error?: Error | object) => loggerManager.error(message, error),
  child: (bindings: object) => loggerManager.child(bindings),
  startTimer: () => loggerManager.startTimer(),
  setLevel: (level: 'debug' | 'info' | 'warn' | 'error') => loggerManager.setLevel(level),
  flush: () => loggerManager.flush(),
  getConfig: () => loggerManager.getConfig()
};

// Export Pino logger for Fastify integration
export const pinoLogger = loggerManager.getPinoLogger();

// LoggerManager is already exported above

// Legacy function for backward compatibility
export function coreLogger(): string {
  return `core-logger v${logger.getConfig().service}`;
}
