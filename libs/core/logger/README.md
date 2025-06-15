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
- 🚫 **Exclude Paths**: ลด log noise สำหรับ health checks
- 🔍 **Include Body**: Debug mode สำหรับ troubleshooting

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
logger.error('Something went wrong', { error: 'details' });

// Structured logging
logger.info('User action', {
  userId: '123',
  action: 'login',
  timestamp: new Date().toISOString()
});

// Performance timing
const timer = logger.startTimer();
// ... some operation
timer.done('Operation completed');
```

### 🌐 Fastify Plugin Usage

```typescript
import Fastify from 'fastify';
import { loggerPlugin } from '@aegisx/core-logger';

const fastify = Fastify();

// Register logger plugin
await fastify.register(loggerPlugin, {
  enableRequestLogging: true,
  enableResponseLogging: true,
  enableErrorLogging: true,
  excludePaths: ['/health', '/metrics'],
  includeBody: false // Production safe
});

// ใน route handlers
fastify.get('/api/users', async (request, reply) => {
  // ใช้ context logger
  request.logger.info('Fetching users', {
    userId: request.user?.id
  });
  
  // ใช้ config
  const dbConfig = request.config.get('database');
  
  return { users: [] };
});
```

## 🔧 Configuration

### Logger Plugin Options

```typescript
interface LoggerPluginOptions {
  enableRequestLogging?: boolean;    // Default: true
  enableResponseLogging?: boolean;   // Default: true  
  enableErrorLogging?: boolean;      // Default: true
  logLevel?: 'debug' | 'info' | 'warn' | 'error'; // Default: 'info'
  includeHeaders?: boolean;          // Default: false
  includeBody?: boolean;             // Default: false
  excludePaths?: string[];           // Default: ['/health', '/metrics', ...]
}
```

### Default Exclude Paths

```typescript
excludePaths: [
  '/health',      // Health check endpoint
  '/metrics',     // Prometheus metrics
  '/readiness',   // Kubernetes readiness probe
  '/liveness',    // Kubernetes liveness probe
  '/ping',        // Simple ping endpoint
  '/status',      // General status endpoint
  '/favicon.ico', // Browser requests
  '/robots.txt'   // Search engine crawlers
]
```

## 🎯 Dual Usage Pattern

### Pattern 1: Global Singleton
```typescript
import { logger } from '@aegisx/core-logger';

// ใช้ได้ทุกที่ในแอปพลิเคชัน
export class UserService {
  async createUser(userData: any) {
    logger.info('Creating user', { email: userData.email });
    
    try {
      // ... business logic
      logger.info('User created successfully', { userId: user.id });
      return user;
    } catch (error) {
      logger.error('Failed to create user', { error, userData });
      throw error;
    }
  }
}
```

### Pattern 2: Fastify Context
```typescript
// ใน route handlers - มี request context
fastify.post('/api/users', async (request, reply) => {
  // Logger มี request context (requestId, method, url, etc.)
  request.logger.info('Creating user via API', {
    userAgent: request.headers['user-agent'],
    ip: request.ip
  });
  
  // Config accessible
  const jwtConfig = request.config.get('jwt');
  
  return userService.createUser(request.body);
});
```

## 📊 Log Output Examples

### Development Mode (Pretty Format)
```
[2025-06-15 15:50:37] INFO: 📥 Incoming request
    reqId: "req-3"
    req: {
      "method": "GET",
      "url": "/api/test",
      "host": "localhost:3000",
      "remoteAddress": "::1"
    }

[2025-06-15 15:50:37] INFO: Test endpoint accessed
    reqId: "req-3"
    userAgent: "curl/8.7.1"

[2025-06-15 15:50:37] INFO: 📤 Request completed
    reqId: "req-3"
    res: {
      "statusCode": 200
    }
    responseTime: 0.8119170069694519
```

### Production Mode (JSON Format)
```json
{"level":30,"time":1750002637029,"service":"AegisX API","environment":"development","requestId":"req-3","method":"GET","url":"/api/test","userAgent":"curl/8.7.1","ip":"::1","msg":"📥 Incoming request"}

{"level":30,"time":1750002637029,"service":"AegisX API","environment":"development","requestId":"req-3","userAgent":"curl/8.7.1","msg":"Test endpoint accessed"}

{"level":30,"time":1750002637030,"service":"AegisX API","environment":"development","requestId":"req-3","method":"GET","url":"/api/test","statusCode":200,"responseTime":"0.8119170069694519ms","msg":"📤 Request completed"}
```

## 🚫 Exclude Paths Behavior

### Excluded Paths (`/health`, `/metrics`, etc.)
```bash
# ✅ มี Basic Fastify Logging (เพื่อ monitoring)
[2025-06-15 16:19:13] INFO: incoming request
    reqId: "req-4"
    req: {
      "method": "GET",
      "url": "/health"
    }

# ❌ ไม่มี Plugin Logging (ลด noise)
# ไม่มี: 📥 Incoming request
# ไม่มี: 📤 Request completed
# ไม่มี: Custom business logs
```

### Business Paths (`/api/*`)
```bash
# ✅ มี Full Plugin Logging
{"msg":"📥 Incoming request","method":"POST","url":"/api/users"}
{"msg":"Creating user","email":"user@example.com"}
{"msg":"📤 Request completed","statusCode":201,"responseTime":"45ms"}
```

## 🔍 Include Body Usage

### Development/Debug Mode
```typescript
// เฉพาะ development
await fastify.register(loggerPlugin, {
  includeBody: config.isDevelopment(),
  includeHeaders: config.isDevelopment()
});
```

### Log Output with Body
```json
{
  "level": 30,
  "msg": "📥 Incoming request",
  "method": "POST",
  "url": "/api/users",
  "body": {
    "email": "user@example.com",
    "name": "John Doe",
    "profile": {
      "age": 30,
      "city": "Bangkok"
    }
  }
}
```

### ⚠️ Security Considerations
```typescript
// อันตราย! ไม่ควรใช้ใน production
{
  "body": {
    "password": "user_password",      // ← Sensitive!
    "credit_card": "1234-5678-9012", // ← Sensitive!
    "api_key": "secret_key_123"      // ← Sensitive!
  }
}
```

## 🛡️ Best Practices

### 1. Environment-Based Configuration
```typescript
const loggerOptions: LoggerPluginOptions = {
  enableRequestLogging: true,
  enableResponseLogging: true,
  enableErrorLogging: true,
  includeBody: config.isDevelopment(), // เฉพาะ dev
  includeHeaders: config.isDevelopment(),
  excludePaths: ['/health', '/metrics', '/ping']
};
```

### 2. Pattern Selection Guide
```typescript
// ✅ ใช้ Global Pattern เมื่อ:
// - Service classes
// - Utility functions  
// - Background jobs
// - Startup/shutdown processes

// ✅ ใช้ Fastify Context เมื่อ:
// - Route handlers
// - Middleware
// - Request-specific operations
// - ต้องการ request tracking
```

### 3. Performance Considerations
```typescript
// ✅ Good: Structured logging
logger.info('User operation', {
  userId: user.id,
  operation: 'update',
  duration: timer.elapsed()
});

// ❌ Avoid: String concatenation
logger.info(`User ${user.id} performed ${operation} in ${duration}ms`);

// ✅ Good: Conditional expensive operations
if (logger.isLevelEnabled('debug')) {
  logger.debug('Detailed state', {
    state: expensiveSerializeOperation()
  });
}
```

### 4. Error Handling
```typescript
try {
  await riskyOperation();
} catch (error) {
  // ✅ Good: Structured error logging
  request.logger.error('Operation failed', {
    error: {
      message: error.message,
      stack: error.stack,
      code: error.code
    },
    context: {
      userId: request.user?.id,
      operation: 'risky_operation'
    }
  });
  
  throw error;
}
```

## 🔗 Integration Examples

### Database Operations
```typescript
export class UserRepository {
  async findById(id: string) {
    const timer = logger.startTimer();
    
    try {
      logger.debug('Querying user', { userId: id });
      const user = await db.user.findUnique({ where: { id } });
      
      timer.done('Database query completed', {
        userId: id,
        found: !!user
      });
      
      return user;
    } catch (error) {
      logger.error('Database query failed', { userId: id, error });
      throw error;
    }
  }
}
```

### Authentication
```typescript
fastify.post('/auth/login', async (request, reply) => {
  request.logger.info('Login attempt', {
    email: request.body.email,
    userAgent: request.headers['user-agent'],
    ip: request.ip
  });
  
  try {
    const user = await authService.login(request.body);
    
    request.logger.info('Login successful', {
      userId: user.id,
      email: user.email
    });
    
    return { token: generateToken(user) };
  } catch (error) {
    request.logger.warn('Login failed', {
      email: request.body.email,
      reason: error.message
    });
    
    throw error;
  }
});
```

### Health Check Endpoint
```typescript
// Health endpoint สร้างโดย Logger Plugin
GET /health

// Response:
{
  "status": "ok",
  "timestamp": "2025-06-15T15:50:23.823Z",
  "service": "AegisX API",
  "version": "1.0.0",
  "environment": "development"
}
```

## 📈 Production Deployment

### 1. Log Aggregation
```typescript
// Production: JSON format สำหรับ log aggregation
const server = Fastify({
  logger: {
    level: 'info',
    // ไม่มี pino-pretty ใน production
  }
});
```

### 2. Log Rotation
```bash
# ใช้ external log rotation
# PM2, Docker, Kubernetes จัดการ log rotation
```

### 3. Monitoring Integration
```typescript
// ส่ง logs ไปยัง monitoring systems
// - ELK Stack (Elasticsearch, Logstash, Kibana)
// - Grafana Loki
// - AWS CloudWatch
// - Google Cloud Logging
```

## 🚀 Advanced Usage

### Custom Child Loggers
```typescript
const userLogger = logger.child({ 
  module: 'user-service',
  version: '1.0.0'
});

userLogger.info('User operation', { userId: '123' });
// Output: {"module":"user-service","version":"1.0.0","userId":"123","msg":"User operation"}
```

### Performance Monitoring
```typescript
const timer = logger.startTimer();

// Long running operation
await processLargeDataset();

timer.done('Dataset processing completed', {
  recordsProcessed: 10000,
  memoryUsage: process.memoryUsage()
});
```

### Request Correlation
```typescript
// Logger Plugin สร้าง requestId อัตโนมัติ
fastify.get('/api/data', async (request, reply) => {
  // ทุก log จะมี requestId เดียวกัน
  request.logger.info('Starting data fetch');
  
  const data = await dataService.fetch(); // ใน service จะมี requestId เดียวกัน
  
  request.logger.info('Data fetch completed', { 
    recordCount: data.length 
  });
  
  return data;
});
```

## 🎯 Summary

`@aegisx/core-logger` ให้ **Dual Usage Pattern** ที่ยืดหยุ่น:

1. **🌍 Global Singleton** - ใช้ทุกที่ในแอปพลิเคชัน
2. **🌐 Fastify Context** - Request-aware logging พร้อม context

**Key Benefits:**
- ✅ **High Performance** - Pino-based JSON logging
- ✅ **Production Ready** - Exclude paths, structured logging
- ✅ **Developer Friendly** - Pretty format, debug options
- ✅ **Enterprise Grade** - Error handling, monitoring integration
- ✅ **Flexible** - Environment-based configuration
- ✅ **Secure** - Sensitive data protection

พร้อมใช้งานใน production environment! 🚀
