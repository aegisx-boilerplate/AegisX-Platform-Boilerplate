# 🏗️ Modules Structure Boilerplate Example

## ตัวอย่าง Modules Structure แบบ Boilerplate

นี่คือตัวอย่างการจัดโครงสร้าง modules ที่แยก **Core Modules** และ **Feature Modules** สำหรับการทำ boilerplate ให้ developer คนอื่นเพิ่ม feature modules เองได้ง่าย

## 📁 โครงสร้าง Modules แบบ Boilerplate

```bash
apps/api/src/
├── app/
│   ├── app.ts                    # ✅ Main app file (AutoLoad)
│   ├── plugins/                  # ✅ Fastify plugins (existing)
│   │   ├── swagger.ts
│   │   ├── helmet.ts
│   │   ├── logger.ts
│   │   └── ...
│   ├── core/                     # 🆕 Core modules (boilerplate)
│   │   ├── base/                 # Base controllers & services
│   │   │   ├── base.controller.ts
│   │   │   ├── base.service.ts
│   │   │   ├── base.repository.ts
│   │   │   └── index.ts
│   │   ├── middleware/            # Shared middleware
│   │   │   ├── auth.middleware.ts
│   │   │   ├── tenant.middleware.ts
│   │   │   ├── validation.middleware.ts
│   │   │   └── index.ts
│   │   ├── decorators/            # Common decorators
│   │   │   ├── auth.decorator.ts
│   │   │   ├── permission.decorator.ts
│   │   │   ├── api-response.decorator.ts
│   │   │   └── index.ts
│   │   ├── utils/                 # Shared utilities
│   │   │   ├── response.util.ts
│   │   │   ├── validation.util.ts
│   │   │   ├── pagination.util.ts
│   │   │   └── index.ts
│   │   └── index.ts               # Export all core modules
│   ├── modules/                  # 🎯 Feature modules (for developers)
│   │   ├── auth/                 # ✅ Authentication module (example)
│   │   │   ├── controllers/
│   │   │   │   ├── auth.controller.ts
│   │   │   │   └── index.ts
│   │   │   ├── services/
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── jwt.service.ts
│   │   │   │   └── index.ts
│   │   │   ├── dto/
│   │   │   │   ├── login.dto.ts
│   │   │   │   ├── register.dto.ts
│   │   │   │   └── index.ts
│   │   │   ├── types/
│   │   │   │   ├── auth.types.ts
│   │   │   │   └── index.ts
│   │   │   ├── routes/
│   │   │   │   ├── auth.routes.ts
│   │   │   │   └── index.ts
│   │   │   └── index.ts           # Module export
│   │   ├── users/                # 🆕 User module (boilerplate example)
│   │   │   ├── controllers/
│   │   │   ├── services/
│   │   │   ├── repositories/
│   │   │   ├── dto/
│   │   │   ├── types/
│   │   │   ├── routes/
│   │   │   └── index.ts
│   │   ├── products/             # 🎯 Example feature module
│   │   │   ├── controllers/
│   │   │   ├── services/
│   │   │   ├── repositories/
│   │   │   ├── dto/
│   │   │   ├── types/
│   │   │   ├── routes/
│   │   │   └── index.ts
│   │   └── [any-feature]/        # 📝 Template for new modules
│   │       ├── controllers/
│   │       ├── services/
│   │       ├── repositories/
│   │       ├── dto/
│   │       ├── types/
│   │       ├── routes/
│   │       └── index.ts
│   ├── routes/                   # 🔄 Legacy routes (migrate to modules)
│   │   ├── auth.ts               # → apps/api/src/app/modules/auth/routes/
│   │   ├── health.ts             # → Keep (core system route)
│   │   ├── root.ts               # → Keep (core system route)
│   │   └── test.ts               # → Keep (core system route)
│   └── types/                    # 📝 Global types
│       ├── fastify.d.ts
│       ├── global.types.ts
│       └── index.ts
```

## 🎯 Core Modules (Boilerplate Foundation)

### 1. Base Controller

```typescript
// apps/api/src/app/core/base/base.controller.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { StandardResponse, PaginatedResponse } from '../utils/response.util';

export abstract class BaseController {
  /**
   * Standard success response
   */
  protected success<T>(
    data?: T,
    message = 'Success',
    meta?: any
  ): StandardResponse<T> {
    return {
      success: true,
      message,
      data,
      meta,
      timestamp: new Date().toISOString(),
      version: process.env.API_VERSION || '1.0.0',
    };
  }

  /**
   * Standard error response
   */
  protected error(
    message = 'An error occurred',
    errors: string[] = [],
    statusCode = 500
  ): StandardResponse {
    return {
      success: false,
      message,
      errors,
      timestamp: new Date().toISOString(),
      version: process.env.API_VERSION || '1.0.0',
    };
  }

  /**
   * Paginated response
   */
  protected paginated<T>(
    items: T[],
    total: number,
    page: number,
    limit: number,
    message = 'Success'
  ): StandardResponse<PaginatedResponse<T>> {
    const totalPages = Math.ceil(total / limit);
    
    return this.success(
      {
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      },
      message
    );
  }

  /**
   * Extract user from request
   */
  protected getUser(request: FastifyRequest): any {
    return (request as any).user;
  }

  /**
   * Extract tenant ID from request
   */
  protected getTenantId(request: FastifyRequest): string | undefined {
    return (request as any).tenantId;
  }

  /**
   * Extract pagination parameters
   */
  protected getPagination(query: any): { page: number; limit: number } {
    const page = Math.max(1, parseInt(query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
    return { page, limit };
  }
}
```

### 2. Base Service

```typescript
// apps/api/src/app/core/base/base.service.ts
import { BaseRepository } from './base.repository';
import { logger } from '@aegisx/core-logger';

export abstract class BaseService<T, CreateDTO, UpdateDTO> {
  constructor(
    protected repository: BaseRepository<T>,
    protected serviceName: string
  ) {}

  async findAll(page = 1, limit = 20, filters?: any): Promise<{
    items: T[];
    total: number;
  }> {
    try {
      logger.info(`${this.serviceName}: Finding all items`, {
        page,
        limit,
        filters,
      });

      const items = await this.repository.findAll({
        page,
        limit,
        where: filters,
      });

      const total = await this.repository.count(filters);

      return { items, total };
    } catch (error) {
      logger.error(`${this.serviceName}: Error finding items`, { error });
      throw error;
    }
  }

  async findById(id: string): Promise<T | null> {
    try {
      logger.info(`${this.serviceName}: Finding item by ID`, { id });
      return await this.repository.findById(id);
    } catch (error) {
      logger.error(`${this.serviceName}: Error finding item by ID`, { 
        id, 
        error 
      });
      throw error;
    }
  }

  async create(data: CreateDTO, userId?: string): Promise<T> {
    try {
      logger.info(`${this.serviceName}: Creating new item`, { 
        userId,
        data: this.sanitizeData(data)
      });

      const result = await this.repository.create(data);

      logger.info(`${this.serviceName}: Item created successfully`, { 
        id: (result as any).id,
        userId 
      });

      return result;
    } catch (error) {
      logger.error(`${this.serviceName}: Error creating item`, { 
        error,
        userId 
      });
      throw error;
    }
  }

  async update(id: string, data: UpdateDTO, userId?: string): Promise<T> {
    try {
      logger.info(`${this.serviceName}: Updating item`, { 
        id,
        userId,
        data: this.sanitizeData(data)
      });

      const result = await this.repository.update(id, data);

      logger.info(`${this.serviceName}: Item updated successfully`, { 
        id,
        userId 
      });

      return result;
    } catch (error) {
      logger.error(`${this.serviceName}: Error updating item`, { 
        id,
        error,
        userId 
      });
      throw error;
    }
  }

  async delete(id: string, userId?: string): Promise<boolean> {
    try {
      logger.info(`${this.serviceName}: Deleting item`, { id, userId });
      
      const result = await this.repository.delete(id);

      logger.info(`${this.serviceName}: Item deleted successfully`, { 
        id,
        userId 
      });

      return result;
    } catch (error) {
      logger.error(`${this.serviceName}: Error deleting item`, { 
        id,
        error,
        userId 
      });
      throw error;
    }
  }

  /**
   * Sanitize sensitive data before logging
   */
  protected sanitizeData(data: any): any {
    const sanitized = { ...data };
    
    // Remove sensitive fields
    const sensitiveFields = ['password', 'token', 'secret', 'key'];
    sensitiveFields.forEach(field => {
      if (sensitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });

    return sanitized;
  }
}
```

### 3. Authentication Middleware

```typescript
// apps/api/src/app/core/middleware/auth.middleware.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { TokenService } from '@aegisx/core-auth';

export interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    id: string;
    email: string;
    role: string;
    tenantId?: string;
  };
  sessionId?: string;
}

/**
 * JWT Authentication Middleware
 */
export async function authenticateToken(
  request: AuthenticatedRequest,
  reply: FastifyReply
) {
  try {
    const authHeader = request.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({
        success: false,
        message: 'Access token required',
        timestamp: new Date().toISOString(),
      });
    }

    const token = authHeader.substring(7);
    const tokenService = new TokenService();
    
    const payload = tokenService.verifyToken(token);
    
    // Attach user to request
    request.user = {
      id: payload.userId,
      email: payload.email,
      role: payload.role,
      tenantId: payload.tenantId,
    };
    
    request.sessionId = payload.sessionId;

  } catch (error) {
    return reply.status(401).send({
      success: false,
      message: 'Invalid or expired token',
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Optional Authentication Middleware
 */
export async function optionalAuth(
  request: AuthenticatedRequest,
  reply: FastifyReply
) {
  try {
    const authHeader = request.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      await authenticateToken(request, reply);
    }
    // If no auth header, continue without user
  } catch (error) {
    // If token is invalid, continue without user
    request.user = undefined;
    request.sessionId = undefined;
  }
}

/**
 * Role-based Authorization Middleware Factory
 */
export function requireRole(allowedRoles: string[]) {
  return async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.status(401).send({
        success: false,
        message: 'Authentication required',
        timestamp: new Date().toISOString(),
      });
    }

    if (!allowedRoles.includes(request.user.role)) {
      return reply.status(403).send({
        success: false,
        message: 'Insufficient permissions',
        timestamp: new Date().toISOString(),
      });
    }
  };
}

/**
 * Permission-based Authorization Middleware Factory
 */
export function requirePermission(permission: string) {
  return async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.status(401).send({
        success: false,
        message: 'Authentication required',
        timestamp: new Date().toISOString(),
      });
    }

    // TODO: Implement permission checking logic
    // This would typically check against a permissions service
    // const hasPermission = await checkUserPermission(request.user.id, permission);
    
    // if (!hasPermission) {
    //   return reply.status(403).send({
    //     success: false,
    //     message: `Permission '${permission}' required`,
    //     timestamp: new Date().toISOString(),
    //   });
    // }
  };
}
```

### 4. Response Utilities

```typescript
// apps/api/src/app/core/utils/response.util.ts
export interface StandardResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  meta?: any;
  errors?: string[];
  timestamp: string;
  version: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export class ResponseUtil {
  static success<T>(
    data?: T,
    message = 'Success',
    meta?: any
  ): StandardResponse<T> {
    return {
      success: true,
      message,
      data,
      meta,
      timestamp: new Date().toISOString(),
      version: process.env.API_VERSION || '1.0.0',
    };
  }

  static error(
    message = 'An error occurred',
    errors: string[] = [],
    statusCode = 500
  ): StandardResponse {
    return {
      success: false,
      message,
      errors,
      timestamp: new Date().toISOString(),
      version: process.env.API_VERSION || '1.0.0',
    };
  }

  static paginated<T>(
    items: T[],
    total: number,
    page: number,
    limit: number,
    message = 'Success'
  ): StandardResponse<PaginatedResponse<T>> {
    const totalPages = Math.ceil(total / limit);
    
    return ResponseUtil.success(
      {
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      },
      message
    );
  }
}
```

## 🎯 Feature Module Template

### User Module Example

```typescript
// apps/api/src/app/modules/users/controllers/users.controller.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { BaseController } from '../../../core/base/base.controller';
import { UsersService } from '../services/users.service';
import { CreateUserDTO, UpdateUserDTO } from '../dto';

export class UsersController extends BaseController {
  constructor(private usersService: UsersService) {
    super();
  }

  async getAllUsers(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { page, limit } = this.getPagination(request.query);
      const user = this.getUser(request);
      
      const { items, total } = await this.usersService.findAll(
        page,
        limit,
        request.query
      );

      return reply.send(
        this.paginated(items, total, page, limit, 'Users retrieved successfully')
      );
    } catch (error) {
      return reply.status(500).send(
        this.error('Failed to retrieve users', [error.message])
      );
    }
  }

  async getUserById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      
      const user = await this.usersService.findById(id);
      
      if (!user) {
        return reply.status(404).send(
          this.error('User not found')
        );
      }

      return reply.send(
        this.success(user, 'User retrieved successfully')
      );
    } catch (error) {
      return reply.status(500).send(
        this.error('Failed to retrieve user', [error.message])
      );
    }
  }

  async createUser(request: FastifyRequest, reply: FastifyReply) {
    try {
      const data = request.body as CreateUserDTO;
      const currentUser = this.getUser(request);
      
      const user = await this.usersService.create(data, currentUser?.id);

      return reply.status(201).send(
        this.success(user, 'User created successfully')
      );
    } catch (error) {
      return reply.status(400).send(
        this.error('Failed to create user', [error.message])
      );
    }
  }

  async updateUser(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const data = request.body as UpdateUserDTO;
      const currentUser = this.getUser(request);
      
      const user = await this.usersService.update(id, data, currentUser?.id);

      return reply.send(
        this.success(user, 'User updated successfully')
      );
    } catch (error) {
      return reply.status(400).send(
        this.error('Failed to update user', [error.message])
      );
    }
  }

  async deleteUser(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const currentUser = this.getUser(request);
      
      await this.usersService.delete(id, currentUser?.id);

      return reply.send(
        this.success(null, 'User deleted successfully')
      );
    } catch (error) {
      return reply.status(400).send(
        this.error('Failed to delete user', [error.message])
      );
    }
  }
}
```

### User Routes

```typescript
// apps/api/src/app/modules/users/routes/users.routes.ts
import { FastifyInstance } from 'fastify';
import { UsersController } from '../controllers/users.controller';
import { UsersService } from '../services/users.service';
import { authenticateToken, requireRole } from '../../../core/middleware';

export async function usersRoutes(fastify: FastifyInstance) {
  // Initialize service and controller
  const usersService = new UsersService();
  const usersController = new UsersController(usersService);

  // Define route schemas
  const getUsersSchema = {
    tags: ['Users'],
    summary: 'Get all users',
    security: [{ bearerAuth: [] }],
    querystring: {
      type: 'object',
      properties: {
        page: { type: 'integer', minimum: 1, default: 1 },
        limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        search: { type: 'string' },
        role: { type: 'string' },
        status: { type: 'string', enum: ['active', 'inactive'] },
      },
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
          data: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: { $ref: '#/components/schemas/User' },
              },
              pagination: { $ref: '#/components/schemas/Pagination' },
            },
          },
          timestamp: { type: 'string' },
          version: { type: 'string' },
        },
      },
    },
  };

  const createUserSchema = {
    tags: ['Users'],
    summary: 'Create a new user',
    security: [{ bearerAuth: [] }],
    body: {
      type: 'object',
      required: ['email', 'firstName', 'lastName'],
      properties: {
        email: { type: 'string', format: 'email' },
        firstName: { type: 'string', minLength: 1, maxLength: 50 },
        lastName: { type: 'string', minLength: 1, maxLength: 50 },
        role: { type: 'string', enum: ['user', 'admin'], default: 'user' },
      },
    },
    response: {
      201: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
          data: { $ref: '#/components/schemas/User' },
          timestamp: { type: 'string' },
          version: { type: 'string' },
        },
      },
    },
  };

  // Routes
  fastify.get('/users', {
    schema: getUsersSchema,
    preHandler: [authenticateToken, requireRole(['admin'])],
  }, usersController.getAllUsers.bind(usersController));

  fastify.get('/users/:id', {
    schema: {
      tags: ['Users'],
      summary: 'Get user by ID',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
        required: ['id'],
      },
    },
    preHandler: [authenticateToken],
  }, usersController.getUserById.bind(usersController));

  fastify.post('/users', {
    schema: createUserSchema,
    preHandler: [authenticateToken, requireRole(['admin'])],
  }, usersController.createUser.bind(usersController));

  fastify.put('/users/:id', {
    schema: {
      tags: ['Users'],
      summary: 'Update user',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
        required: ['id'],
      },
      body: {
        type: 'object',
        properties: {
          firstName: { type: 'string', minLength: 1, maxLength: 50 },
          lastName: { type: 'string', minLength: 1, maxLength: 50 },
          role: { type: 'string', enum: ['user', 'admin'] },
        },
      },
    },
    preHandler: [authenticateToken, requireRole(['admin'])],
  }, usersController.updateUser.bind(usersController));

  fastify.delete('/users/:id', {
    schema: {
      tags: ['Users'],
      summary: 'Delete user',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
        required: ['id'],
      },
    },
    preHandler: [authenticateToken, requireRole(['admin'])],
  }, usersController.deleteUser.bind(usersController));
}
```

### Module Index

```typescript
// apps/api/src/app/modules/users/index.ts
export * from './controllers';
export * from './services';
export * from './dto';
export * from './types';
export * from './routes';

// Module metadata for auto-discovery
export const MODULE_METADATA = {
  name: 'users',
  version: '1.0.0',
  description: 'User management module',
  routes: [
    {
      path: '/api/users',
      method: 'GET',
      description: 'Get all users',
    },
    {
      path: '/api/users/:id',
      method: 'GET',
      description: 'Get user by ID',
    },
    {
      path: '/api/users',
      method: 'POST',
      description: 'Create user',
    },
    {
      path: '/api/users/:id',
      method: 'PUT',
      description: 'Update user',
    },
    {
      path: '/api/users/:id',
      method: 'DELETE',
      description: 'Delete user',
    },
  ],
  dependencies: ['@aegisx/core-auth', '@aegisx/core-logger'],
  permissions: ['user:read', 'user:write', 'user:delete'],
};
```

## 🔄 Migration Strategy

### ขั้นตอนการ Migrate Routes ไปเป็น Modules

1. **สร้างโครงสร้าง Core Modules**
2. **Migrate Auth Routes เป็น Auth Module**  
3. **สร้าง Users Module ใหม่**
4. **อัพเดท app.ts ให้ AutoLoad Modules**
5. **เพิ่ม Module Discovery System**

### Auto-Discovery System

```typescript
// apps/api/src/app/core/module-loader.ts
import { FastifyInstance } from 'fastify';
import * as fs from 'fs';
import * as path from 'path';

export class ModuleLoader {
  static async loadModules(fastify: FastifyInstance) {
    const modulesDir = path.join(__dirname, '../modules');
    
    if (!fs.existsSync(modulesDir)) {
      return;
    }

    const modules = fs.readdirSync(modulesDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    for (const moduleName of modules) {
      try {
        const modulePath = path.join(modulesDir, moduleName);
        const moduleIndex = path.join(modulePath, 'index.ts');
        
        if (fs.existsSync(moduleIndex)) {
          const module = await import(moduleIndex);
          
          // Register module routes
          if (module.MODULE_METADATA && module[`${moduleName}Routes`]) {
            fastify.log.info(`Loading module: ${moduleName}`);
            
            await fastify.register(module[`${moduleName}Routes`], {
              prefix: `/api`,
            });
            
            fastify.log.info(`Module loaded: ${moduleName}`, {
              routes: module.MODULE_METADATA.routes?.length || 0,
              version: module.MODULE_METADATA.version,
            });
          }
        }
      } catch (error) {
        fastify.log.error(`Failed to load module: ${moduleName}`, { error });
      }
    }
  }
}
```

## 🎯 ประโยชน์ของ Modules Structure นี้

### สำหรับ Core Team (Boilerplate Makers)
- **Standardization**: โครงสร้างและ patterns ที่สม่ำเสมอ
- **Maintainability**: แยกส่วน core และ features ชัดเจน
- **Extensibility**: ง่ายต่อการเพิ่ม features ใหม่
- **Testing**: แยก test แต่ละ module ได้อิสระ

### สำหรับ Feature Developers
- **Clear Structure**: โครงสร้างที่ชัดเจน ง่ายต่อการทำความเข้าใจ
- **Base Classes**: มี base controllers/services ให้ extend
- **Common Utilities**: มี middleware และ utilities พร้อมใช้
- **Auto-discovery**: ระบบ load modules อัตโนมัติ
- **Documentation**: Swagger schema และ metadata ครบถ้วน

### สำหรับ Project Scalability
- **Modular**: แยก features เป็น modules อิสระ
- **Lazy Loading**: โหลดเฉพาะ modules ที่ต้องการ
- **Plugin Architecture**: ง่ายต่อการ enable/disable features
- **Team Collaboration**: แต่ละทีมทำงานในส่วนของตัวเองได้

## 🚀 Next Steps

1. **สร้าง Core Modules Foundation**
2. **Migrate Auth Routes เป็น Module**
3. **สร้าง Users Module เป็นตัวอย่าง**
4. **Setup Module Auto-Discovery**
5. **สร้าง Module Generator Tool**
6. **เขียน Documentation สำหรับ Developers**

ต้องการให้ผมเริ่มสร้าง Core Modules หรือ migrate Auth routes เป็น module ก่อนครับ?
