# @aegisx/core-config

Type-safe configuration management library for AegisX Platform with environment variable validation and automatic type conversion.

## Features

- 🔒 **Type-safe configuration** with TypeScript and Zod validation
- 🌍 **Environment variable mapping** with automatic parsing
- 🎯 **Default values** for all configuration options
- 🔄 **Automatic type conversion** (string → number, boolean)
- 🏗️ **Singleton pattern** for consistent configuration access
- ✅ **Validation** with detailed error messages
- 🔧 **Helper methods** for common operations

## Installation

```bash
npm install @aegisx/core-config
```

## Quick Start

```typescript
import { config } from '@aegisx/core-config';

// Get specific configuration section
const appConfig = config.get('app');
const dbConfig = config.get('database');

// Get all configuration
const allConfig = config.getAll();

// Helper methods
const dbUrl = config.getDatabaseUrl();
const redisUrl = config.getRedisUrl();

// Environment checks
if (config.isDevelopment()) {
  console.log('Running in development mode');
}
```

## Configuration Sections

### Application
```typescript
app: {
  name: string;           // Default: 'AegisX Platform'
  version: string;        // Default: '1.0.0'
  environment: 'development' | 'staging' | 'production'; // Default: 'development'
  port: number;           // Default: 3000
  host: string;           // Default: 'localhost'
  cors: {
    origin: string | string[]; // Default: '*'
    credentials: boolean;      // Default: true
  };
}
```

### Database
```typescript
database: {
  host: string;              // Default: 'localhost'
  port: number;              // Default: 5432
  name: string;              // Default: 'aegisx_db'
  username: string;          // Default: 'postgres'
  password: string;          // Default: 'password'
  ssl: boolean;              // Default: false
  maxConnections: number;    // Default: 10
  connectionTimeout: number; // Default: 30000
}
```

### Redis
```typescript
redis: {
  host: string;     // Default: 'localhost'
  port: number;     // Default: 6379
  password?: string; // Optional
  db: number;       // Default: 0
  keyPrefix: string; // Default: 'aegisx:'
}
```

### JWT & Security
```typescript
jwt: {
  secret: string;           // REQUIRED (min 32 characters)
  expiresIn: string;        // Default: '24h'
  refreshExpiresIn: string; // Default: '7d'
  issuer: string;           // Default: 'aegisx-platform'
}

security: {
  bcryptRounds: number;     // Default: 12
  sessionSecret: string;    // REQUIRED (min 32 characters)
  rateLimiting: {
    windowMs: number;       // Default: 900000 (15 minutes)
    maxRequests: number;    // Default: 100
  };
}
```

### Logging
```typescript
logging: {
  level: 'debug' | 'info' | 'warn' | 'error'; // Default: 'info'
  format: 'json' | 'pretty';                  // Default: 'json'
  enableConsole: boolean;                     // Default: true
  enableFile: boolean;                        // Default: false
  filePath: string;                           // Default: './logs/app.log'
  maxFileSize: string;                        // Default: '10MB'
  maxFiles: number;                           // Default: 5
}
```

### File Storage
```typescript
storage: {
  provider: 'local' | 'minio' | 's3'; // Default: 'local'
  local: {
    uploadPath: string;    // Default: './uploads'
    maxFileSize: number;   // Default: 10485760 (10MB)
  };
  minio: {
    endpoint: string;      // Default: 'localhost:9000'
    accessKey: string;     // Default: 'minioadmin'
    secretKey: string;     // Default: 'minioadmin'
    bucket: string;        // Default: 'aegisx-files'
    useSSL: boolean;       // Default: false
  };
}
```

### Email
```typescript
email: {
  provider: 'smtp' | 'sendgrid' | 'ses'; // Default: 'smtp'
  from: string;                          // Default: 'noreply@aegisx.com'
  smtp: {
    host: string;        // Default: 'localhost'
    port: number;        // Default: 587
    secure: boolean;     // Default: false
    username?: string;   // Optional
    password?: string;   // Optional
  };
}
```

## Environment Variables

### Required Variables
```bash
# Security (REQUIRED)
JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters-long
SESSION_SECRET=your-super-secret-session-key-at-least-32-characters-long
```

### Optional Variables
```bash
# Application
NODE_ENV=development
PORT=3000
HOST=localhost
APP_NAME=AegisX Platform
APP_VERSION=1.0.0

# CORS (comma-separated for multiple origins)
CORS_ORIGIN=http://localhost:4200,http://localhost:4201
CORS_CREDENTIALS=true

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=aegisx_db
DB_USERNAME=postgres
DB_PASSWORD=password
DB_SSL=false
DB_MAX_CONNECTIONS=10
DB_CONNECTION_TIMEOUT=30000

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_KEY_PREFIX=aegisx:

# JWT
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d
JWT_ISSUER=aegisx-platform

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
LOG_ENABLE_CONSOLE=true
LOG_ENABLE_FILE=false
LOG_FILE_PATH=./logs/app.log
LOG_MAX_FILE_SIZE=10MB
LOG_MAX_FILES=5

# Storage
STORAGE_PROVIDER=local
STORAGE_LOCAL_UPLOAD_PATH=./uploads
STORAGE_LOCAL_MAX_FILE_SIZE=10485760

# MinIO
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=aegisx-files
MINIO_USE_SSL=false

# Email
EMAIL_PROVIDER=smtp
EMAIL_FROM=noreply@aegisx.com
SMTP_HOST=localhost
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USERNAME=
SMTP_PASSWORD=

# Security
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## API Reference

### ConfigManager

#### `config.get<T>(key: T): Config[T]`
Get a specific configuration section.

```typescript
const appConfig = config.get('app');
const dbConfig = config.get('database');
```

#### `config.getAll(): Config`
Get the complete configuration object.

```typescript
const allConfig = config.getAll();
```

#### `config.isDevelopment(): boolean`
Check if running in development environment.

#### `config.isProduction(): boolean`
Check if running in production environment.

#### `config.isStaging(): boolean`
Check if running in staging environment.

#### `config.getDatabaseUrl(): string`
Get PostgreSQL connection string.

```typescript
const dbUrl = config.getDatabaseUrl();
// Returns: postgresql://username:password@host:port/database
```

#### `config.getRedisUrl(): string`
Get Redis connection string.

```typescript
const redisUrl = config.getRedisUrl();
// Returns: redis://[password@]host:port/db
```

#### `config.reload(): void`
Reload configuration (useful for testing).

## Usage Examples

### Basic Usage
```typescript
import { config } from '@aegisx/core-config';

// Start your application
const port = config.get('app').port;
const host = config.get('app').host;

console.log(`Server starting on ${host}:${port}`);
```

### Database Connection
```typescript
import { config } from '@aegisx/core-config';

const dbUrl = config.getDatabaseUrl();
// Use with your ORM (Prisma, TypeORM, etc.)
```

### Environment-specific Logic
```typescript
import { config } from '@aegisx/core-config';

if (config.isDevelopment()) {
  // Development-only code
  console.log('Debug mode enabled');
}

if (config.isProduction()) {
  // Production optimizations
  console.log('Production mode');
}
```

### Logging Configuration
```typescript
import { config } from '@aegisx/core-config';

const logConfig = config.get('logging');
// Configure your logger with these settings
```

## Error Handling

The library will throw detailed validation errors if configuration is invalid:

```typescript
// If JWT_SECRET is missing or too short:
Error: Configuration validation failed:
jwt.secret: String must contain at least 32 character(s)

// If environment variables have wrong types:
Error: Configuration validation failed:
app.port: Expected number, received string
database.ssl: Expected boolean, received string
```

## Development Setup

1. Copy environment template:
```bash
cp env.example .env
```

2. Set required secrets:
```bash
# Generate secure secrets (32+ characters)
JWT_SECRET=your-development-jwt-secret-32-characters-minimum
SESSION_SECRET=your-development-session-secret-32-characters-minimum
```

3. Override optional settings as needed:
```bash
PORT=4000
DB_HOST=localhost
LOG_LEVEL=debug
```

## License

MIT
