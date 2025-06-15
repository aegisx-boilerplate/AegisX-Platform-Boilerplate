# @aegisx/core-logger

🚀 **Enterprise-grade logging system** สำหรับ AegisX Platform ที่ integrate กับ Pino และ Fastify พร้อม **Dual Usage Pattern**

## ✨ Features

- 🔧 **Pino Integration**: High-performance JSON logger
- ⚙️ **Configuration Integration**: ใช้ @aegisx/core-config
- 📊 **Structured Logging**: JSON และ Pretty format
- 🎯 **Child Loggers**: Context-aware logging
- ⏱️ **Performance Timing**: Built-in timer utilities
- 🌐 **Fastify Integration**: Request/response logging
- 🔄 **Environment Detection**: Auto dev/prod/staging
- 🛡️ **Error Handling**: Proper error logging
- 🔀 **Dual Usage Pattern**: Global singleton + Fastify context
- 🔌 **Fastify Plugin**: Complete lifecycle integration

## 📦 Installation

```bash
npm install @aegisx/core-logger
```

## 🚀 Quick Start

### 🌍 Global Usage (Singleton Pattern)

```typescript
import { logger } from '@aegisx/core-logger';

// Basic logging
logger.info('Application started');
logger.warn('This is a warning');
logger.error('Something went wrong', new Error('Details'));
logger.debug('Debug information');
```

### 🔌 Fastify Plugin Usage (Context Pattern)

```typescript
import Fastify from 'fastify';
import { loggerPlugin } from '@aegisx/core-logger';

const server = Fastify();

// Register logger plugin
await server.register(loggerPlugin, {
  enableRequestLogging: true,
  enableResponseLogging: true,
  enableErrorLogging: true,
  includeHeaders: false,
  excludePaths: ['/health', '/metrics']
});

// Use logger in routes
server.get('/api/users', async (request, reply) => {
  // Logger with request context
  request.logger.info('Fetching users', {
    userAgent: request.headers['user-agent']
  });
  
  // Access config from request context
  const appConfig = request.config.get('app');
  
  return {
    users: [],
    requestId: request.requestId,
    service: appConfig.name
  };
});
```

## 🎯 Usage Patterns

### Pattern 1: Global Singleton

เหมาะสำหรับ:
- Application startup/shutdown
- Background tasks
- Utility functions
- General purpose logging

```typescript
import { logger } from '@aegisx/core-logger';

// Startup logging
logger.info('🚀 Starting application');

// Background task
async function processData() {
  const timer = logger.startTimer();
  // ... process data
  timer.done('Data processing completed');
}
```

### Pattern 2: Fastify Context

เหมาะสำหรับ:
- Request/response logging
- API endpoints
- Request-specific context
- Error handling

```typescript
// Automatic request logging
server.addHook('onRequest', async (request, reply) => {
  // Logger already available with context
  request.logger.info('📥 Request received');
});

// Route with context
server.get('/api/data', async (request, reply) => {
  try {
    request.logger.info('Processing request');
    const data = await fetchData();
    request.logger.info('Request successful', { count: data.length });
    return data;
  } catch (error) {
    request.logger.error('Request failed', error);
    throw error;
  }
});
```

## 🔧 Fastify Plugin Configuration

### Plugin Options

```typescript
interface LoggerPluginOptions {
  enableRequestLogging?: boolean;    // Default: true
  enableResponseLogging?: boolean;   // Default: true
  enableErrorLogging?: boolean;      // Default: true
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  includeHeaders?: boolean;          // Default: false
  includeBody?: boolean;             // Default: false
  excludePaths?: string[];           // Default: ['/health', '/metrics']
}
```

### Complete Setup Example

```typescript
import Fastify from 'fastify';
import { loggerPlugin, LoggerPluginOptions } from '@aegisx/core-logger';

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

// Plugin configuration
const loggerOptions: LoggerPluginOptions = {
  enableRequestLogging: true,
  enableResponseLogging: true,
  enableErrorLogging: true,
  includeHeaders: process.env.NODE_ENV === 'development',
  includeBody: false,
  excludePaths: ['/health', '/metrics', '/favicon.ico']
};

await server.register(loggerPlugin, loggerOptions);

// Routes automatically get logger context
server.get('/api/test', async (request, reply) => {
  request.logger.info('Test endpoint accessed');
  
  return {
    message: 'Hello World!',
    requestId: request.requestId,
    timestamp: new Date().toISOString()
  };
});
```

## 📊 Structured Logging

### With Metadata

```typescript
// Global usage
logger.info('User login', {
  userId: '12345',
  email: 'user@example.com',
  ip: '192.168.1.1',
  userAgent: 'Mozilla/5.0...'
});

// Fastify context usage
server.post('/api/login', async (request, reply) => {
  request.logger.info('Login attempt', {
    email: request.body.email,
    ip: request.ip,
    userAgent: request.headers['user-agent']
  });
});
```

### Performance Timing

```typescript
// Global usage
const timer = logger.startTimer();
await processData();
timer.done('Data processing completed', { recordsProcessed: 1000 });

// Fastify context usage
server.get('/api/heavy-task', async (request, reply) => {
  const timer = request.logger.startTimer();
  const result = await heavyComputation();
  timer.done('Heavy computation completed', { resultSize: result.length });
  return result;
});
```

### Child Loggers

```typescript
// Global usage
const userLogger = logger.child({ userId: '123', module: 'user-service' });
userLogger.info('User action performed');

// Fastify context usage (automatic child logger)
server.get('/api/users/:id', async (request, reply) => {
  // request.logger is already a child logger with request context
  const userLogger = request.logger.child({ userId: request.params.id });
  userLogger.info('Fetching user details');
});
```

## 🌐 TypeScript Support

### Fastify Type Extensions

```typescript
// Types are automatically extended
declare module 'fastify' {
  interface FastifyInstance {
    logger: typeof logger;
    config: typeof config;
    createRequestLogger: (request: FastifyRequest) => typeof logger;
  }
  
  interface FastifyRequest {
    logger: typeof logger;
    config: typeof config;
    requestId: string;
  }
}
```

### Usage with Types

```typescript
import { FastifyRequest, FastifyReply } from 'fastify';

async function handler(request: FastifyRequest, reply: FastifyReply) {
  // Full TypeScript support
  request.logger.info('Handler called');
  const appConfig = request.config.get('app');
  
  return {
    requestId: request.requestId,
    service: appConfig.name
  };
}
```

## ⚙️ Configuration

Logger ใช้ configuration จาก `@aegisx/core-config`:

```typescript
// Environment variables
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

## 🛠️ Advanced Usage

### Manual Plugin Registration

```typescript
import { createLoggerPlugin } from '@aegisx/core-logger';

// Manual registration with custom options
const customLoggerPlugin = createLoggerPlugin({
  enableRequestLogging: true,
  logLevel: 'debug',
  includeHeaders: true
});

await server.register(customLoggerPlugin);
```

### Error Handling

```typescript
// Global error handling
try {
  throw new Error('Something went wrong');
} catch (error) {
  logger.error('Operation failed', error);
}

// Fastify error handling (automatic via plugin)
server.get('/api/error', async (request, reply) => {
  request.logger.warn('This will throw an error');
  throw new Error('Test error'); // Automatically logged by plugin
});
```

### Health Check Endpoint

Plugin automatically adds `/health` endpoint:

```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2025-06-15T10:42:05.989Z",
  "service": "AegisX API",
  "version": "1.0.0",
  "environment": "development"
}
```

## 🌍 Environment-Specific Behavior

### Development
- Pretty format with colors
- Debug level logging
- Detailed stack traces
- Request headers included (if enabled)

### Production
- JSON format
- Info level logging
- Structured output for log aggregation
- Minimal metadata

### Staging
- JSON format
- Debug level logging
- Full logging for testing

## 📊 Log Output Examples

### Development (Pretty Format)
```
[2025-06-15 10:42:05] INFO: 📥 Incoming request
    requestId: "req-2"
    method: "GET"
    url: "/api/test"
    userAgent: "curl/8.7.1"
    ip: "::1"

[2025-06-15 10:42:05] INFO: Test endpoint accessed
    requestId: "req-2"
    userAgent: "curl/8.7.1"

[2025-06-15 10:42:05] INFO: 📤 Request completed
    requestId: "req-2"
    method: "GET"
    url: "/api/test"
    statusCode: 200
    responseTime: "0.75ms"
```

### Production (JSON Format)
```json
{"level":30,"time":1749984125988,"service":"AegisX API","environment":"production","requestId":"req-2","method":"GET","url":"/api/test","userAgent":"curl/8.7.1","ip":"::1","msg":"📥 Incoming request"}
{"level":30,"time":1749984125988,"service":"AegisX API","environment":"production","requestId":"req-2","userAgent":"curl/8.7.1","msg":"Test endpoint accessed"}
{"level":30,"time":1749984125989,"service":"AegisX API","environment":"production","requestId":"req-2","method":"GET","url":"/api/test","statusCode":200,"responseTime":"0.75ms","msg":"📤 Request completed"}
```

## 🔗 Integration Examples

### With Database Operations

```typescript
server.get('/api/users', async (request, reply) => {
  const timer = request.logger.startTimer();
  
  try {
    request.logger.info('Fetching users from database');
    const users = await db.users.findMany();
    
    timer.done('Database query completed', {
      userCount: users.length,
      query: 'users.findMany'
    });
    
    return users;
  } catch (error) {
    request.logger.error('Database query failed', error);
    throw error;
  }
});
```

### With Authentication

```typescript
server.addHook('preHandler', async (request, reply) => {
  const token = request.headers.authorization;
  
  if (!token) {
    request.logger.warn('Missing authorization header');
    throw new Error('Unauthorized');
  }
  
  try {
    const user = await verifyToken(token);
    request.user = user;
    
    // Add user context to logger
    request.logger = request.logger.child({
      userId: user.id,
      userEmail: user.email
    });
    
    request.logger.info('User authenticated');
  } catch (error) {
    request.logger.error('Authentication failed', error);
    throw error;
  }
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

### 1. Choose the Right Pattern
- **Global**: Application-level events, background tasks
- **Fastify Context**: Request-specific operations, API endpoints

### 2. Use Structured Logging
```typescript
// ✅ Good
request.logger.info('User created', {
  userId: user.id,
  email: user.email,
  role: user.role
});

// ❌ Avoid
request.logger.info(`User ${user.email} created with role ${user.role}`);
```

### 3. Performance Timing
```typescript
// ✅ Use timers for operations
const timer = request.logger.startTimer();
await expensiveOperation();
timer.done('Operation completed');
```

### 4. Error Context
```typescript
// ✅ Include relevant context
request.logger.error('Payment processing failed', {
  error,
  userId: request.user.id,
  amount: request.body.amount,
  paymentMethod: request.body.method
});
```

### 5. Avoid Sensitive Data
```typescript
// ❌ Never log sensitive information
request.logger.info('User login', {
  password: request.body.password, // DON'T DO THIS
  creditCard: request.body.card     // DON'T DO THIS
});

// ✅ Log safely
request.logger.info('User login', {
  email: request.body.email,
  hasPassword: !!request.body.password,
  paymentMethodType: request.body.card?.type
});
```

## 🤝 Dependencies

- `pino`: High-performance JSON logger
- `fastify-plugin`: Fastify plugin system
- `@aegisx/core-config`: Configuration management
- `pino-pretty`: Pretty formatting for development

## 📄 License

MIT License - AegisX Platform
