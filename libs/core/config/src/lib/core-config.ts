import { z } from 'zod';

// Configuration Schema Definition
const ConfigSchema = z.object({
  // Application
  app: z.object({
    name: z.string().default('AegisX Platform'),
    version: z.string().default('1.0.0'),
    environment: z.enum(['development', 'staging', 'production']).default('development'),
    port: z.coerce.number().min(1).max(65535).default(3000),
    host: z.string().default('localhost'),
    cors: z.object({
      origin: z.union([z.string(), z.array(z.string())]).default('*'),
      credentials: z.coerce.boolean().default(true),
    }),
  }),

  // Database
  database: z.object({
    host: z.string().default('localhost'),
    port: z.coerce.number().min(1).max(65535).default(5432),
    name: z.string().default('aegisx_db'),
    username: z.string().default('postgres'),
    password: z.string().default('password'),
    ssl: z.coerce.boolean().default(false),
    maxConnections: z.coerce.number().min(1).default(10),
    connectionTimeout: z.coerce.number().min(1000).default(30000),
  }),

  // Redis
  redis: z.object({
    host: z.string().default('localhost'),
    port: z.coerce.number().min(1).max(65535).default(6379),
    password: z.string().optional(),
    db: z.coerce.number().min(0).default(0),
    keyPrefix: z.string().default('aegisx:'),
  }),

  // JWT
  jwt: z.object({
    secret: z.string().min(32),
    expiresIn: z.string().default('24h'),
    refreshExpiresIn: z.string().default('7d'),
    issuer: z.string().default('aegisx-platform'),
  }),

  // Logging
  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    format: z.enum(['json', 'pretty']).default('json'),
    enableConsole: z.coerce.boolean().default(true),
    enableFile: z.coerce.boolean().default(false),
    filePath: z.string().default('./logs/app.log'),
    maxFileSize: z.string().default('10MB'),
    maxFiles: z.coerce.number().default(5),
  }),

  // File Storage
  storage: z.object({
    provider: z.enum(['local', 'minio', 's3']).default('local'),
    local: z.object({
      uploadPath: z.string().default('./uploads'),
      maxFileSize: z.coerce.number().default(10 * 1024 * 1024), // 10MB
    }),
    minio: z.object({
      endpoint: z.string().default('localhost:9000'),
      accessKey: z.string().default('minioadmin'),
      secretKey: z.string().default('minioadmin'),
      bucket: z.string().default('aegisx-files'),
      useSSL: z.coerce.boolean().default(false),
    }),
  }),

  // Email
  email: z.object({
    provider: z.enum(['smtp', 'sendgrid', 'ses']).default('smtp'),
    from: z.string().email().default('noreply@aegisx.com'),
    smtp: z.object({
      host: z.string().default('localhost'),
      port: z.coerce.number().default(587),
      secure: z.coerce.boolean().default(false),
      username: z.string().optional(),
      password: z.string().optional(),
    }),
  }),

  // Security
  security: z.object({
    bcryptRounds: z.coerce.number().min(8).max(15).default(12),
    rateLimiting: z.object({
      windowMs: z.coerce.number().default(15 * 60 * 1000), // 15 minutes
      maxRequests: z.coerce.number().default(100),
    }),
    sessionSecret: z.string().min(32),
  }),
});

// Type inference from schema
export type Config = z.infer<typeof ConfigSchema>;

// Environment variable mapping
const ENV_MAPPING = {
  // App
  'app.name': 'APP_NAME',
  'app.version': 'APP_VERSION',
  'app.environment': 'NODE_ENV',
  'app.port': 'PORT',
  'app.host': 'HOST',
  'app.cors.origin': 'CORS_ORIGIN',
  'app.cors.credentials': 'CORS_CREDENTIALS',

  // Database
  'database.host': 'DB_HOST',
  'database.port': 'DB_PORT',
  'database.name': 'DB_NAME',
  'database.username': 'DB_USERNAME',
  'database.password': 'DB_PASSWORD',
  'database.ssl': 'DB_SSL',
  'database.maxConnections': 'DB_MAX_CONNECTIONS',
  'database.connectionTimeout': 'DB_CONNECTION_TIMEOUT',

  // Redis
  'redis.host': 'REDIS_HOST',
  'redis.port': 'REDIS_PORT',
  'redis.password': 'REDIS_PASSWORD',
  'redis.db': 'REDIS_DB',
  'redis.keyPrefix': 'REDIS_KEY_PREFIX',

  // JWT
  'jwt.secret': 'JWT_SECRET',
  'jwt.expiresIn': 'JWT_EXPIRES_IN',
  'jwt.refreshExpiresIn': 'JWT_REFRESH_EXPIRES_IN',
  'jwt.issuer': 'JWT_ISSUER',

  // Logging
  'logging.level': 'LOG_LEVEL',
  'logging.format': 'LOG_FORMAT',
  'logging.enableConsole': 'LOG_ENABLE_CONSOLE',
  'logging.enableFile': 'LOG_ENABLE_FILE',
  'logging.filePath': 'LOG_FILE_PATH',
  'logging.maxFileSize': 'LOG_MAX_FILE_SIZE',
  'logging.maxFiles': 'LOG_MAX_FILES',

  // Storage
  'storage.provider': 'STORAGE_PROVIDER',
  'storage.local.uploadPath': 'STORAGE_LOCAL_UPLOAD_PATH',
  'storage.local.maxFileSize': 'STORAGE_LOCAL_MAX_FILE_SIZE',
  'storage.minio.endpoint': 'MINIO_ENDPOINT',
  'storage.minio.accessKey': 'MINIO_ACCESS_KEY',
  'storage.minio.secretKey': 'MINIO_SECRET_KEY',
  'storage.minio.bucket': 'MINIO_BUCKET',
  'storage.minio.useSSL': 'MINIO_USE_SSL',

  // Email
  'email.provider': 'EMAIL_PROVIDER',
  'email.from': 'EMAIL_FROM',
  'email.smtp.host': 'SMTP_HOST',
  'email.smtp.port': 'SMTP_PORT',
  'email.smtp.secure': 'SMTP_SECURE',
  'email.smtp.username': 'SMTP_USERNAME',
  'email.smtp.password': 'SMTP_PASSWORD',

  // Security
  'security.bcryptRounds': 'BCRYPT_ROUNDS',
  'security.rateLimiting.windowMs': 'RATE_LIMIT_WINDOW_MS',
  'security.rateLimiting.maxRequests': 'RATE_LIMIT_MAX_REQUESTS',
  'security.sessionSecret': 'SESSION_SECRET',
} as const;

// Utility function to get nested object value by path (unused but kept for future use)
// function getNestedValue(obj: any, path: string): any {
//   return path.split('.').reduce((current, key) => current?.[key], obj);
// }

// Utility function to set nested object value by path
function setNestedValue(obj: any, path: string, value: any): void {
  const keys = path.split('.');
  const lastKey = keys.pop()!;
  const target = keys.reduce((current, key) => {
    if (!(key in current)) current[key] = {};
    return current[key];
  }, obj);
  target[lastKey] = value;
}

// Parse environment variables
function parseEnvironmentVariables(): Partial<Config> {
  const envConfig: any = {};

  for (const [configPath, envVar] of Object.entries(ENV_MAPPING)) {
    const envValue = process.env[envVar];
    if (envValue !== undefined) {
      // Handle special cases for arrays (CORS_ORIGIN)
      if (configPath === 'app.cors.origin' && envValue.includes(',')) {
        setNestedValue(envConfig, configPath, envValue.split(',').map(s => s.trim()));
      } else {
        setNestedValue(envConfig, configPath, envValue);
      }
    }
  }

  return envConfig;
}

// Configuration class
export class ConfigManager {
  private static instance: ConfigManager;
  private config: Config;

  private constructor() {
    this.config = this.loadConfig();
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  private loadConfig(): Config {
    try {
      // Parse environment variables
      const envConfig = parseEnvironmentVariables();

      // Validate and parse with schema
      const result = ConfigSchema.parse(envConfig);

      return result;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map(err =>
          `${err.path.join('.')}: ${err.message}`
        ).join('\n');
        throw new Error(`Configuration validation failed:\n${errorMessages}`);
      }
      throw error;
    }
  }

  public get<T extends keyof Config>(key: T): Config[T] {
    return this.config[key];
  }

  public getAll(): Config {
    return { ...this.config };
  }

  public isDevelopment(): boolean {
    return this.config.app.environment === 'development';
  }

  public isProduction(): boolean {
    return this.config.app.environment === 'production';
  }

  public isStaging(): boolean {
    return this.config.app.environment === 'staging';
  }

  // Reload configuration (useful for testing)
  public reload(): void {
    this.config = this.loadConfig();
  }

  // Get database connection string
  public getDatabaseUrl(): string {
    const { host, port, name, username, password } = this.config.database;
    return `postgresql://${username}:${password}@${host}:${port}/${name}`;
  }

  // Get Redis connection string
  public getRedisUrl(): string {
    const { host, port, password, db } = this.config.redis;
    const auth = password ? `:${password}@` : '';
    return `redis://${auth}${host}:${port}/${db}`;
  }
}

// Export singleton instance
export const config = ConfigManager.getInstance();

// Export utility functions
export { ConfigSchema };

// Legacy function for backward compatibility
export function coreConfig(): string {
  return `core-config v${config.get('app').version}`;
}
