# AegisX Fastify API Boilerplate Architecture

## 🎯 **Boilerplate Goals**
- ให้ **core modules** พื้นฐานที่จำเป็น
- เตรียม structure สำหรับ **feature modules** ที่จะเพิ่มทีหลัง
- ง่ายต่อการ extend และ customize
- Best practices และ patterns ที่ชัดเจน

## 📁 **Boilerplate Structure**

```
apps/api/src/
├── app/
│   ├── app.ts                    # Main app entry
│   ├── plugins/                  # ✅ Global Fastify plugins (มีแล้ว)
│   │   ├── cors.ts
│   │   ├── database.ts
│   │   ├── helmet.ts
│   │   ├── logger.ts
│   │   ├── rate-limit.ts
│   │   ├── sensible.ts
│   │   └── swagger.ts
│   ├── modules/                  # 🆕 Modular architecture
│   │   ├── core/                 # 🏛️ Core system modules (Boilerplate)
│   │   │   ├── auth/             # Authentication & JWT
│   │   │   ├── system/           # Health, metrics, root
│   │   │   └── README.md         # Core modules guide
│   │   ├── features/             # 🚀 Business feature modules (User-added)
│   │   │   ├── .gitkeep         # Keep folder for git
│   │   │   └── README.md         # Feature development guide
│   │   └── README.md             # Modules overview
│   └── shared/                   # 🔧 Shared utilities & base classes
│       ├── controllers/          # Base controller patterns
│       ├── services/             # Base service patterns  
│       ├── repositories/         # Base repository patterns
│       ├── middleware/           # Custom middleware
│       ├── decorators/           # Custom decorators
│       ├── validators/           # Request validators
│       ├── types/                # Common type definitions
│       ├── utils/                # Utility functions
│       └── README.md             # Shared components guide
├── config/                       # 🆕 App-specific configuration
│   ├── container.ts              # DI container setup
│   ├── routes.ts                 # Auto route registration
│   └── README.md                 # Configuration guide
└── main.ts                       # Application bootstrap
```

## 🏛️ **Core Modules (Provided in Boilerplate)**

### 1. **Core Auth Module**
```
modules/core/auth/
├── controllers/
│   ├── auth.controller.ts        # Login, logout, refresh, me
│   └── index.ts
├── services/
│   ├── auth.service.ts           # Authentication business logic
│   └── index.ts
├── middleware/
│   ├── auth.middleware.ts        # JWT authentication middleware
│   └── index.ts
├── routes/
│   ├── auth.routes.ts            # Auth route definitions
│   └── index.ts
├── dto/
│   ├── login.dto.ts              # Login request/response DTOs
│   ├── register.dto.ts           # Registration DTOs
│   └── index.ts
├── types/
│   ├── auth.types.ts             # Auth-related types
│   └── index.ts
└── index.ts                      # Module exports
```

### 2. **Core System Module**
```
modules/core/system/
├── controllers/
│   ├── health.controller.ts      # Health checks
│   ├── metrics.controller.ts     # System metrics
│   └── index.ts
├── services/
│   ├── health.service.ts         # Health check logic
│   ├── metrics.service.ts        # Metrics collection
│   └── index.ts
├── routes/
│   ├── health.routes.ts          # Health endpoints
│   ├── metrics.routes.ts         # Metrics endpoints
│   ├── root.routes.ts            # Root API info
│   └── index.ts
└── index.ts
```

## 🚀 **Feature Modules (User-added)**

Developer สามารถเพิ่ม feature modules ตาม pattern นี้:

```
modules/features/<feature-name>/
├── controllers/                  # HTTP handlers
├── services/                     # Business logic
├── repositories/                 # Data access (optional)
├── routes/                       # Route definitions
├── dto/                          # Data transfer objects
├── types/                        # Feature-specific types
├── validators/                   # Input validation
├── middleware/                   # Feature middleware (optional)
└── index.ts                      # Module exports
```

**ตัวอย่าง Feature Modules ที่ User อาจเพิ่ม:**
- `modules/features/users/` - User management
- `modules/features/tenants/` - Multi-tenancy
- `modules/features/files/` - File storage
- `modules/features/notifications/` - Notification system
- `modules/features/webhooks/` - Webhook management
- `modules/features/analytics/` - Analytics tracking

## 🔧 **Shared Components (Boilerplate Foundation)**

### 1. **Base Controller**
```typescript
// shared/controllers/base.controller.ts
export abstract class BaseController {
  protected success<T>(data?: T, message = 'Success'): ApiResponse<T>
  protected created<T>(data?: T, message = 'Created'): ApiResponse<T>
  protected paginated<T>(items: T[], total: number, page: number, limit: number): ApiResponse<PaginatedData<T>>
  protected notFound(message = 'Resource not found'): ApiResponse
  protected badRequest(message: string, errors?: string[]): ApiResponse
  protected handleError(error: any, reply: FastifyReply): void
}
```

### 2. **Base Service**
```typescript
// shared/services/base.service.ts
export abstract class BaseService {
  protected logger: Logger;
  protected config: ConfigManager;
  
  constructor() {
    this.logger = container.resolve('Logger');
    this.config = container.resolve('Config');
  }
}
```

### 3. **Base Repository**
```typescript
// shared/repositories/base.repository.ts
export abstract class BaseRepository<T> {
  constructor(protected db: Knex, protected tableName: string)
  
  abstract findAll(): Promise<T[]>
  abstract findById(id: string): Promise<T | null>
  abstract create(data: Partial<T>): Promise<T>
  abstract update(id: string, data: Partial<T>): Promise<T>
  abstract delete(id: string): Promise<void>
}
```

### 4. **Common Types**
```typescript
// shared/types/api.types.ts
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  meta?: any;
  errors?: string[];
  timestamp: string;
  requestId?: string;
}

export interface PaginatedData<T> {
  items: T[];
  meta: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}
```

## 📋 **Auto Route Registration**

```typescript
// config/routes.ts
import { FastifyInstance } from 'fastify';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';

export async function registerRoutes(fastify: FastifyInstance) {
  const modulesDir = join(__dirname, '../app/modules');
  
  // Register core modules
  await registerModuleRoutes(fastify, join(modulesDir, 'core'), '/api/v1');
  
  // Register feature modules
  await registerModuleRoutes(fastify, join(modulesDir, 'features'), '/api/v1');
}

async function registerModuleRoutes(
  fastify: FastifyInstance, 
  modulesPath: string, 
  prefix: string
) {
  if (!existsSync(modulesPath)) return;
  
  const modules = readdirSync(modulesPath);
  
  for (const module of modules) {
    const modulePath = join(modulesPath, module);
    const routesPath = join(modulePath, 'routes', 'index.ts');
    
    if (statSync(modulePath).isDirectory() && existsSync(routesPath)) {
      const { default: moduleRoutes } = await import(routesPath);
      await fastify.register(moduleRoutes, { prefix });
      
      fastify.log.info(`✅ Registered module: ${module}`);
    }
  }
}
```

## 🎯 **DI Container Setup**

```typescript
// config/container.ts
import { container } from 'tsyringe';
import { config } from '@aegisx/core-config';
import { logger } from '@aegisx/core-logger';

// Register core dependencies
container.registerSingleton('Config', { useValue: config });
container.registerSingleton('Logger', { useValue: logger });

// Auto-register services from core modules
export function setupContainer() {
  // Core Auth Services
  container.registerSingleton('AuthService', AuthService);
  
  // Core System Services
  container.registerSingleton('HealthService', HealthService);
  container.registerSingleton('MetricsService', MetricsService);
  
  // Database connection
  container.registerSingleton('Database', { useValue: fastify.db });
}
```

## 📚 **Documentation & Guides**

### 1. **Core Modules README**
```markdown
# Core Modules

Core modules ให้ functionality พื้นฐานที่จำเป็นสำหรับ API:

## Available Core Modules

- **auth** - JWT authentication, login, logout
- **system** - Health checks, metrics, API info

## Usage

Core modules จะถูก register อัตโนมัติเมื่อ start application

## Extension

ไม่แนะนำให้แก้ไข core modules ให้สร้าง feature modules แทน
```

### 2. **Feature Modules Guide**
```markdown
# Feature Development Guide

## Creating a New Feature Module

1. สร้าง folder ใน `modules/features/<feature-name>/`
2. ใช้ template structure:
   - controllers/
   - services/
   - routes/
   - dto/
   - types/
3. Export routes ใน `routes/index.ts`
4. Register dependencies ใน DI container

## Examples

ดู core modules เป็น reference pattern

## Best Practices

- ใช้ BaseController, BaseService patterns
- Implement proper error handling
- Add comprehensive Swagger schemas
- Follow naming conventions
```

## 🔄 **Migration Strategy**

### Phase 1: Setup New Structure
1. สร้าง modules/core และ modules/features folders
2. Setup shared components
3. Setup auto-registration system

### Phase 2: Migrate Auth Module  
1. ย้าย existing auth.ts → modules/core/auth/
2. แยก controller, service, routes
3. Test functionality

### Phase 3: Migrate System Module
1. ย้าย health.ts, root.ts → modules/core/system/
2. เพิ่ม metrics functionality
3. Test endpoints

### Phase 4: Documentation
1. สร้าง README files
2. Add development guides
3. Example feature module

## ✅ **Benefits for Boilerplate**

### For Boilerplate Authors:
- **Core stability** - Core modules tested และ stable
- **Clear separation** - Core vs Feature แยกชัดเจน
- **Easy maintenance** - Structure สม่ำเสมอ

### For Boilerplate Users:
- **Quick start** - Core functionality พร้อมใช้
- **Clear guidance** - Documentation และ examples
- **Flexible extension** - เพิ่ม features ตาม pattern
- **Best practices** - Built-in patterns และ utilities

## 🚀 **Next Steps**

1. **เริ่มสร้าง structure** - modules, shared components
2. **Migrate auth module** - แยก controller/service/routes  
3. **Setup auto-registration** - dynamic route loading
4. **Add documentation** - guides และ examples
5. **Create example feature** - เป็น template สำหรับ users

คุณต้องการให้ผมเริ่มสร้าง structure นี้เลยมั้ยครับ?
