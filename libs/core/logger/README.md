# @aegisx/core-logger

🚀 **Enterprise-grade logging system** สำหรับ AegisX Platform ที่ integrate กับ Pino และ Fastify

## ✨ Features

- 🔧 **Pino Integration**: High-performance JSON logger
- ⚙️ **Configuration Integration**: ใช้ @aegisx/core-config
- 📊 **Structured Logging**: JSON และ Pretty format
- 🎯 **Child Loggers**: Context-aware logging
- ⏱️ **Performance Timing**: Built-in timer utilities
- 🌐 **Fastify Integration**: Request/response logging
- 🔄 **Environment Detection**: Auto dev/prod/staging
- 🛡️ **Error Handling**: Proper error logging

## 📦 Installation

```bash
npm install @aegisx/core-logger
```

## 🚀 Quick Start

### Basic Usage

```typescript
import { logger } from '@aegisx/core-logger';

// Basic logging
logger.info('Application started');
logger.warn('This is a warning');
logger.error('Something went wrong', new Error('Details'));
logger.debug('Debug information');
```

### Structured Logging

```typescript
import { logger } from '@aegisx/core-logger';

// Log with metadata
logger.info('User login', {
  userId: '12345',
  email: 'user@example.com',
  ip: '192.168.1.1',
  userAgent: 'Mozilla/5.0...'
});

// Log configuration
logger.info('Database connected', {
  host: 'localhost',
  port: 5432,
  database: 'myapp'
});
```

### Performance Timing

```typescript
import { logger } from '@aegisx/core-logger';

// Start timer
const timer = logger.startTimer();

// Do some work...
await processData();

// Log completion with duration
timer.done('Data processing completed', {
  recordsProcessed: 1000
});
```

### Child Loggers

```typescript
import { logger } from '@aegisx/core-logger';

// Create child logger with context
const requestLogger = logger.child({
  requestId: 'req-123',
  userId: 'user-456',
  method: 'POST',
  url: '/api/users'
});

requestLogger.info('Processing request');
requestLogger.info('Validation passed');
requestLogger.info('Request completed');
```

## 🔧 Fastify Integration

### Basic Setup

```typescript
import Fastify from 'fastify';
import { logger } from '@aegisx/core-logger';

const server = Fastify({
  logger: {
    level: 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'yyyy-mm-dd HH:MM:ss'
      }
    }
  }
});

// Use logger in routes
server.get('/', async (request, reply) => {
  logger.info('Homepage accessed');
  return { message: 'Hello World' };
});
```

### Request Logging Middleware

```typescript
import { logger } from '@aegisx/core-logger';

// Add request logging
server.addHook('onRequest', async (request, reply) => {
  const requestLogger = logger.child({
    requestId: request.id,
    method: request.method,
    url: request.url,
    userAgent: request.headers['user-agent'],
    ip: request.ip
  });
  
  requestLogger.info('📥 Incoming request');
});

// Add response logging
server.addHook('onResponse', async (request, reply) => {
  logger.info('📤 Request completed', {
    requestId: request.id,
    method: request.method,
    url: request.url,
    statusCode: reply.statusCode
  });
});
```

## ⚙️ Configuration

Logger ใช้ configuration จาก `@aegisx/core-config`:

```typescript
// ใน environment variables หรือ config file
LOGGING_LEVEL=info
LOGGING_FORMAT=pretty
LOGGING_ENABLE_CONSOLE=true
LOGGING_ENABLE_FILE=false
```

### Configuration Schema

```typescript
interface LoggerConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  format: 'json' | 'pretty';
  enableConsole: boolean;
  enableFile: boolean;
  filePath?: string;
  maxFileSize?: string;
  maxFiles?: number;
  service?: string;
}
```

## 🎯 Advanced Usage

### LoggerManager Class

```typescript
import { LoggerManager } from '@aegisx/core-logger';

// Get singleton instance
const loggerManager = LoggerManager.getInstance();

// Custom configuration
const customLogger = LoggerManager.getInstance({
  level: 'debug',
  format: 'pretty'
});

// Get Pino instance for Fastify
const pinoLogger = loggerManager.getPinoLogger();
```

### Runtime Configuration

```typescript
import { logger } from '@aegisx/core-logger';

// Change log level at runtime
logger.setLevel('debug');

// Get current configuration
const config = logger.getConfig();
console.log('Current log level:', config.level);

// Flush logs (useful for testing)
logger.flush();
```

### Error Logging

```typescript
import { logger } from '@aegisx/core-logger';

try {
  // Some operation
  throw new Error('Something went wrong');
} catch (error) {
  // Proper error logging with stack trace
  logger.error('Operation failed', error);
  
  // Or with additional context
  logger.error('Database operation failed', {
    error,
    query: 'SELECT * FROM users',
    params: { id: 123 }
  });
}
```

## 🌍 Environment-Specific Behavior

### Development
- Pretty format with colors
- Debug level logging
- Detailed stack traces

### Production
- JSON format
- Info level logging
- Structured output for log aggregation

### Staging
- JSON format
- Debug level logging
- Full logging for testing

## 📊 Log Output Examples

### Development (Pretty Format)
```
[2025-06-15 10:23:49] INFO: 🚀 Starting AegisX Platform API...
    service: "AegisX API"
    environment: "development"

[2025-06-15 10:23:49] INFO: 📥 Incoming request
    requestId: "req-1"
    method: "GET"
    url: "/"
    userAgent: "curl/8.7.1"
    ip: "::1"
```

### Production (JSON Format)
```json
{"level":30,"time":1749983029288,"service":"AegisX API","environment":"production","msg":"🚀 Starting AegisX Platform API..."}
{"level":30,"time":1749983040517,"service":"AegisX API","environment":"production","requestId":"req-1","method":"GET","url":"/","userAgent":"curl/8.7.1","ip":"::1","msg":"📥 Incoming request"}
```

## 🔗 Integration with Other Core Libraries

```typescript
import { logger } from '@aegisx/core-logger';
import { config } from '@aegisx/core-config';

// Logger automatically uses config
logger.info('Application started', {
  environment: config.get('app').environment,
  version: config.get('app').version
});
```

## 🛠️ Development

```bash
# Build library
nx run @aegisx/core-logger:build

# Run tests
nx run @aegisx/core-logger:test

# Lint code
nx run @aegisx/core-logger:lint
```

## 📝 Best Practices

1. **Use Structured Logging**: Always include relevant metadata
2. **Child Loggers**: Create context-specific loggers for requests
3. **Performance Timing**: Use timers for operation monitoring
4. **Error Context**: Include relevant context when logging errors
5. **Log Levels**: Use appropriate levels (debug/info/warn/error)
6. **Avoid Sensitive Data**: Never log passwords or tokens

## 🤝 Dependencies

- `pino`: High-performance JSON logger
- `@aegisx/core-config`: Configuration management
- `pino-pretty`: Pretty formatting for development

## 📄 License

MIT License - AegisX Platform
