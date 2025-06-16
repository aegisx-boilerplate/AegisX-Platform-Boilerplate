# Fastify API Architecture Recommendations

## 🏗️ **Recommended API Structure (Domain-Driven)**

### 📁 **Main Structure**
```
apps/api/src/
├── app/
│   ├── app.ts                    # Main app entry
│   ├── plugins/                  # Global Fastify plugins
│   │   ├── cors.ts
│   │   ├── database.ts
│   │   ├── helmet.ts
│   │   ├── logger.ts
│   │   ├── rate-limit.ts
│   │   ├── sensible.ts
│   │   └── swagger.ts
│   └── modules/                  # 🆕 Business modules
│       ├── auth/                 # Authentication module
│       ├── users/                # User management module
│       ├── tenants/              # Multi-tenancy module
│       ├── files/                # File storage module
│       ├── notifications/        # Notifications module
│       ├── webhooks/             # Webhooks module
│       ├── websockets/           # WebSockets module
│       └── system/               # System utilities
├── shared/                       # 🆕 Shared utilities
│   ├── controllers/              # Base controllers
│   ├── services/                 # Base services
│   ├── middleware/               # Custom middleware
│   ├── decorators/               # Custom decorators
│   ├── validators/               # Request validators
│   ├── types/                    # Type definitions
│   └── utils/                    # Utility functions
├── config/                       # 🆕 App-specific config
└── main.ts                       # Application bootstrap
```

### 🏛️ **Module Structure Pattern**

Each module follows this structure:
```
modules/<module-name>/
├── controllers/                  # HTTP request handlers
│   ├── <module>.controller.ts
│   └── index.ts
├── services/                     # Business logic
│   ├── <module>.service.ts
│   └── index.ts
├── repositories/                 # Data access layer
│   ├── <module>.repository.ts
│   └── index.ts
├── routes/                       # Route definitions
│   ├── <module>.routes.ts
│   └── index.ts
├── dto/                          # Data transfer objects
│   ├── create-<module>.dto.ts
│   ├── update-<module>.dto.ts
│   └── index.ts
├── types/                        # Module-specific types
│   ├── <module>.types.ts
│   └── index.ts
├── validators/                   # Input validation
│   ├── <module>.validators.ts
│   └── index.ts
├── middleware/                   # Module-specific middleware
│   ├── <module>.middleware.ts
│   └── index.ts
└── index.ts                      # Module barrel export
```

## 📋 **Example: User Module Implementation**

### 1. User Controller
```typescript
// modules/users/controllers/user.controller.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { inject, injectable } from 'tsyringe';
import { UserService } from '../services/user.service';
import { CreateUserDto, UpdateUserDto } from '../dto';
import { BaseController } from '../../../shared/controllers/base.controller';

@injectable()
export class UserController extends BaseController {
  constructor(
    @inject('UserService') private userService: UserService
  ) {
    super();
  }

  async getUsers(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { page = 1, limit = 20, search } = request.query as any;
      const result = await this.userService.findAll({ page, limit, search });
      
      return this.paginated(result.users, result.total, page, limit);
    } catch (error) {
      return this.handleError(error, reply);
    }
  }

  async getUserById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const user = await this.userService.findById(id);
      
      if (!user) {
        return this.notFound('User not found');
      }
      
      return this.success(user, 'User retrieved successfully');
    } catch (error) {
      return this.handleError(error, reply);
    }
  }

  async createUser(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userData = request.body as CreateUserDto;
      const user = await this.userService.create(userData);
      
      return this.created(user, 'User created successfully');
    } catch (error) {
      return this.handleError(error, reply);
    }
  }

  async updateUser(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const userData = request.body as UpdateUserDto;
      const user = await this.userService.update(id, userData);
      
      return this.success(user, 'User updated successfully');
    } catch (error) {
      return this.handleError(error, reply);
    }
  }

  async deleteUser(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      await this.userService.delete(id);
      
      return this.success(null, 'User deleted successfully');
    } catch (error) {
      return this.handleError(error, reply);
    }
  }
}
```

### 2. User Service (Business Logic)
```typescript
// modules/users/services/user.service.ts
import { inject, injectable } from 'tsyringe';
import { UserRepository } from '../repositories/user.repository';
import { CreateUserDto, UpdateUserDto } from '../dto';
import { User } from '../types/user.types';
import { hashPassword, comparePassword } from '../../../shared/utils/crypto.utils';

@injectable()
export class UserService {
  constructor(
    @inject('UserRepository') private userRepository: UserRepository
  ) {}

  async findAll(options: {
    page: number;
    limit: number;
    search?: string;
  }): Promise<{ users: User[]; total: number }> {
    return this.userRepository.findWithPagination(options);
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findById(id);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findByEmail(email);
  }

  async create(userData: CreateUserDto): Promise<User> {
    // Business rules
    const existingUser = await this.findByEmail(userData.email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await hashPassword(userData.password);
    
    return this.userRepository.create({
      ...userData,
      password: hashedPassword
    });
  }

  async update(id: string, userData: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new Error('User not found');
    }

    // Hash password if provided
    if (userData.password) {
      userData.password = await hashPassword(userData.password);
    }

    return this.userRepository.update(id, userData);
  }

  async delete(id: string): Promise<void> {
    const user = await this.findById(id);
    if (!user) {
      throw new Error('User not found');
    }

    return this.userRepository.delete(id);
  }

  async validateCredentials(email: string, password: string): Promise<User | null> {
    const user = await this.findByEmail(email);
    if (!user) {
      return null;
    }

    const isValid = await comparePassword(password, user.password);
    if (!isValid) {
      return null;
    }

    return user;
  }
}
```

### 3. User Repository (Data Access)
```typescript
// modules/users/repositories/user.repository.ts
import { inject, injectable } from 'tsyringe';
import { Knex } from 'knex';
import { User } from '../types/user.types';
import { CreateUserDto, UpdateUserDto } from '../dto';
import { BaseRepository } from '../../../shared/repositories/base.repository';

@injectable()
export class UserRepository extends BaseRepository<User> {
  constructor(
    @inject('Database') db: Knex
  ) {
    super(db, 'users');
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = await this.db(this.tableName)
      .where('email', email)
      .first();
    
    return user || null;
  }

  async findWithPagination(options: {
    page: number;
    limit: number;
    search?: string;
  }): Promise<{ users: User[]; total: number }> {
    const { page, limit, search } = options;
    const offset = (page - 1) * limit;

    let query = this.db(this.tableName);

    if (search) {
      query = query.where(function() {
        this.where('first_name', 'ilike', `%${search}%`)
          .orWhere('last_name', 'ilike', `%${search}%`)
          .orWhere('email', 'ilike', `%${search}%`);
      });
    }

    const [users, totalResult] = await Promise.all([
      query.clone()
        .limit(limit)
        .offset(offset)
        .orderBy('created_at', 'desc'),
      query.clone().count('* as count').first()
    ]);

    return {
      users,
      total: parseInt(totalResult?.count as string) || 0
    };
  }

  async create(userData: CreateUserDto): Promise<User> {
    const [user] = await this.db(this.tableName)
      .insert({
        ...userData,
        created_at: new Date(),
        updated_at: new Date()
      })
      .returning('*');

    return user;
  }

  async update(id: string, userData: UpdateUserDto): Promise<User> {
    const [user] = await this.db(this.tableName)
      .where('id', id)
      .update({
        ...userData,
        updated_at: new Date()
      })
      .returning('*');

    return user;
  }
}
```

### 4. User Routes
```typescript
// modules/users/routes/user.routes.ts
import { FastifyInstance } from 'fastify';
import { container } from 'tsyringe';
import { UserController } from '../controllers/user.controller';
import { userValidators } from '../validators/user.validators';

export async function userRoutes(fastify: FastifyInstance) {
  const userController = container.resolve(UserController);

  // Get all users with pagination and search
  fastify.get('/users', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['Users'],
      summary: 'Get all users',
      description: 'Retrieve users with pagination and optional search',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', minimum: 1, default: 1 },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
          search: { type: 'string', minLength: 1 }
        }
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
                  items: { $ref: '#/components/schemas/User' }
                },
                meta: {
                  type: 'object',
                  properties: {
                    page: { type: 'number' },
                    limit: { type: 'number' },
                    total: { type: 'number' },
                    totalPages: { type: 'number' },
                    hasNext: { type: 'boolean' },
                    hasPrev: { type: 'boolean' }
                  }
                }
              }
            }
          }
        }
      }
    }
  }, userController.getUsers.bind(userController));

  // Get user by ID
  fastify.get('/users/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['Users'],
      summary: 'Get user by ID',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' }
        }
      }
    }
  }, userController.getUserById.bind(userController));

  // Create user
  fastify.post('/users', {
    preHandler: [fastify.authenticate, userValidators.validateCreateUser],
    schema: {
      tags: ['Users'],
      summary: 'Create new user',
      body: { $ref: '#/components/schemas/CreateUserDto' }
    }
  }, userController.createUser.bind(userController));

  // Update user
  fastify.put('/users/:id', {
    preHandler: [fastify.authenticate, userValidators.validateUpdateUser],
    schema: {
      tags: ['Users'],
      summary: 'Update user',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' }
        }
      },
      body: { $ref: '#/components/schemas/UpdateUserDto' }
    }
  }, userController.updateUser.bind(userController));

  // Delete user
  fastify.delete('/users/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['Users'],
      summary: 'Delete user',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' }
        }
      }
    }
  }, userController.deleteUser.bind(userController));
}
```

### 5. User DTOs
```typescript
// modules/users/dto/create-user.dto.ts
export interface CreateUserDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  avatar?: string;
}

// modules/users/dto/update-user.dto.ts
export interface UpdateUserDto {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatar?: string;
  isActive?: boolean;
}
```

### 6. User Validators
```typescript
// modules/users/validators/user.validators.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import Joi from 'joi';

const createUserSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  firstName: Joi.string().min(1).max(100).required(),
  lastName: Joi.string().min(1).max(100).required(),
  phone: Joi.string().optional(),
  avatar: Joi.string().uri().optional()
});

const updateUserSchema = Joi.object({
  email: Joi.string().email().optional(),
  password: Joi.string().min(8).optional(),
  firstName: Joi.string().min(1).max(100).optional(),
  lastName: Joi.string().min(1).max(100).optional(),
  phone: Joi.string().optional(),
  avatar: Joi.string().uri().optional(),
  isActive: Joi.boolean().optional()
});

export const userValidators = {
  async validateCreateUser(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { error } = createUserSchema.validate(request.body);
      if (error) {
        return reply.code(400).send({
          success: false,
          message: 'Validation failed',
          errors: error.details.map(d => d.message)
        });
      }
    } catch (error) {
      return reply.code(400).send({
        success: false,
        message: 'Invalid request body'
      });
    }
  },

  async validateUpdateUser(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { error } = updateUserSchema.validate(request.body);
      if (error) {
        return reply.code(400).send({
          success: false,
          message: 'Validation failed',
          errors: error.details.map(d => d.message)
        });
      }
    } catch (error) {
      return reply.code(400).send({
        success: false,
        message: 'Invalid request body'
      });
    }
  }
};
```

## 🔧 **Shared Components**

### 1. Base Controller
```typescript
// shared/controllers/base.controller.ts
import { FastifyReply } from 'fastify';

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  meta?: any;
  errors?: string[];
  timestamp: string;
  requestId?: string;
}

export class BaseController {
  protected success<T>(data?: T, message = 'Success'): ApiResponse<T> {
    return {
      success: true,
      message,
      data,
      timestamp: new Date().toISOString()
    };
  }

  protected created<T>(data?: T, message = 'Created successfully'): ApiResponse<T> {
    return {
      success: true,
      message,
      data,
      timestamp: new Date().toISOString()
    };
  }

  protected paginated<T>(
    items: T[],
    total: number,
    page: number,
    limit: number,
    message = 'Success'
  ): ApiResponse<{ items: T[]; meta: any }> {
    const totalPages = Math.ceil(total / limit);
    
    return {
      success: true,
      message,
      data: {
        items,
        meta: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      },
      timestamp: new Date().toISOString()
    };
  }

  protected notFound(message = 'Resource not found'): ApiResponse {
    return {
      success: false,
      message,
      timestamp: new Date().toISOString()
    };
  }

  protected badRequest(message = 'Bad request', errors?: string[]): ApiResponse {
    return {
      success: false,
      message,
      errors,
      timestamp: new Date().toISOString()
    };
  }

  protected handleError(error: any, reply: FastifyReply) {
    console.error('Controller error:', error);
    
    return reply.code(500).send({
      success: false,
      message: error.message || 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
}
```

### 2. Base Repository
```typescript
// shared/repositories/base.repository.ts
import { Knex } from 'knex';

export class BaseRepository<T> {
  constructor(
    protected db: Knex,
    protected tableName: string
  ) {}

  async findAll(): Promise<T[]> {
    return this.db(this.tableName).select('*');
  }

  async findById(id: string): Promise<T | null> {
    const result = await this.db(this.tableName)
      .where('id', id)
      .first();
    return result || null;
  }

  async delete(id: string): Promise<void> {
    await this.db(this.tableName)
      .where('id', id)
      .del();
  }

  async count(): Promise<number> {
    const result = await this.db(this.tableName)
      .count('* as count')
      .first();
    return parseInt(result?.count as string) || 0;
  }
}
```

## 🚀 **Module Registration**

### Main App Registration
```typescript
// app/app.ts
import * as path from 'path';
import { FastifyInstance } from 'fastify';
import AutoLoad from '@fastify/autoload';
import { container } from 'tsyringe';

// Register DI Container
import './config/container'; // DI setup

export async function app(fastify: FastifyInstance, opts: any) {
  // Load plugins first
  await fastify.register(AutoLoad, {
    dir: path.join(__dirname, 'plugins'),
    options: { ...opts },
  });

  // Register all modules
  await fastify.register(AutoLoad, {
    dir: path.join(__dirname, 'modules'),
    options: { ...opts },
    indexPattern: /routes\/index\.(js|ts)$/
  });
}
```

### Module Index Registration
```typescript
// modules/users/routes/index.ts
import { FastifyInstance } from 'fastify';
import { userRoutes } from './user.routes';

export default async function(fastify: FastifyInstance) {
  await fastify.register(userRoutes, { prefix: '/api/v1' });
}
```

## 📊 **Benefits of This Structure**

### ✅ **Scalability**
- แยก concerns ชัดเจน
- ง่ายต่อการเพิ่ม modules ใหม่
- ง่ายต่อการ maintain และ debug

### ✅ **Testability** 
- แต่ละ layer test แยกได้
- Dependency injection ช่วย mocking
- Unit tests เขียนง่าย

### ✅ **Maintainability**
- Code structure สม่ำเสมอ
- แยก business logic จาก HTTP layer
- Type safety ด้วย TypeScript

### ✅ **Team Collaboration**
- แต่ละ module ทำงานแยกได้
- Clear ownership
- Parallel development

## 🔄 **Migration Strategy**

### Phase 1: Setup Structure
1. สร้าง folder structure ใหม่
2. Setup shared components
3. Setup DI container

### Phase 2: Migrate Existing Routes
1. ย้าย auth routes → auth module
2. ย้าย health routes → system module
3. สร้าง users module

### Phase 3: Add New Features
1. ใช้ module pattern สำหรับ features ใหม่
2. Refactor existing code ทีละ module

### Phase 4: Optimization
1. Add caching layers
2. Add monitoring
3. Performance optimization

ต้องการให้ผมเริ่มสร้าง structure นี้ให้มั้ยครับ? หรือมีส่วนไหนที่อยากสอบถามเพิ่มเติม?
