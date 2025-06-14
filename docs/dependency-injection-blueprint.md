# Dependency Injection Blueprint with TSyringe

## 🎯 Overview

This blueprint demonstrates how to implement clean, testable, and maintainable Dependency Injection (DI) using TSyringe in the AegisX Platform. TSyringe provides lightweight, TypeScript-first DI container that works seamlessly with Fastify and our modular architecture.

## 🚀 Quick Setup

### 1. Install Dependencies

```bash
npm install tsyringe reflect-metadata
npm install -D @types/node
```

### 2. Basic Configuration

```typescript
// libs/core/di/container.ts
import 'reflect-metadata';
import { container, DependencyContainer } from 'tsyringe';

// Configure the global container
export const appContainer: DependencyContainer = container;

// Helper function to reset container (useful for testing)
export const resetContainer = (): void => {
  container.clearInstances();
};

export { container };
```

### 3. Bootstrap Application

```typescript
// apps/api/src/main.ts
import 'reflect-metadata';
import './di/container-setup'; // Import DI setup
import { container } from 'tsyringe';
import { FastifyInstance } from 'fastify';
import { buildApp } from './app';

async function bootstrap() {
  const app: FastifyInstance = await buildApp();
  
  try {
    await app.listen({ 
      port: parseInt(process.env.PORT || '3000'),
      host: '0.0.0.0' 
    });
    
    console.log('🚀 Application started successfully');
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

bootstrap();
```

## 🏗️ Architecture Patterns

### 1. Repository Pattern with DI

```typescript
// libs/core/interfaces/repository.interface.ts
export interface IRepository<T> {
  findAll(): Promise<T[]>;
  findById(id: string): Promise<T | undefined>;
  create(data: Partial<T>): Promise<T>;
  update(id: string, data: Partial<T>): Promise<T | undefined>;
  delete(id: string): Promise<boolean>;
}

// libs/modules/user/interfaces/user-repository.interface.ts
import { IRepository } from '../../../core/interfaces/repository.interface';
import { User } from '../entities/user.entity';

export interface IUserRepository extends IRepository<User> {
  findByEmail(email: string): Promise<User | undefined>;
  findByTenantId(tenantId: string): Promise<User[]>;
  updateLastLogin(id: string): Promise<void>;
}

export const USER_REPOSITORY_TOKEN = Symbol('UserRepository');
```

### 2. Repository Implementation

```typescript
// libs/modules/user/repositories/user.repository.ts
import { injectable } from 'tsyringe';
import { Knex } from 'knex';
import { IUserRepository } from '../interfaces/user-repository.interface';
import { User } from '../entities/user.entity';
import { BaseRepository } from '../../../core/repositories/base.repository';

@injectable()
export class UserRepository extends BaseRepository<User> implements IUserRepository {
  constructor() {
    super('users');
  }

  async findByEmail(email: string): Promise<User | undefined> {
    return this.query()
      .where('email', email)
      .first();
  }

  async findByTenantId(tenantId: string): Promise<User[]> {
    return this.query()
      .where('tenant_id', tenantId)
      .select('*');
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.query()
      .where('id', id)
      .update({
        last_login_at: new Date(),
        updated_at: new Date()
      });
  }
}
```

### 3. Service Layer with DI

```typescript
// libs/modules/user/interfaces/user-service.interface.ts
import { User } from '../entities/user.entity';
import { CreateUserData, UpdateUserData } from '../dto/user.dto';

export interface IUserService {
  createUser(tenantId: string, userData: CreateUserData): Promise<User>;
  getUserById(tenantId: string, id: string): Promise<User>;
  updateUser(tenantId: string, id: string, updateData: UpdateUserData): Promise<User>;
  deleteUser(tenantId: string, id: string): Promise<void>;
  getUsersByTenant(tenantId: string): Promise<User[]>;
  verifyPassword(email: string, password: string): Promise<User>;
}

export const USER_SERVICE_TOKEN = Symbol('UserService');
```

```typescript
// libs/modules/user/services/user.service.ts
import { injectable, inject } from 'tsyringe';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { IUserService } from '../interfaces/user-service.interface';
import { IUserRepository, USER_REPOSITORY_TOKEN } from '../interfaces/user-repository.interface';
import { User } from '../entities/user.entity';
import { CreateUserData, UpdateUserData } from '../dto/user.dto';
import { NotFoundError, ValidationError } from '../../../core/errors/custom-errors';

@injectable()
export class UserService implements IUserService {
  constructor(
    @inject(USER_REPOSITORY_TOKEN) private userRepository: IUserRepository
  ) {}

  async createUser(tenantId: string, userData: CreateUserData): Promise<User> {
    // Check if email exists in tenant
    const existingUser = await this.userRepository.findByEmail(userData.email);
    if (existingUser && existingUser.tenant_id === tenantId) {
      throw new ValidationError('Email already exists in this tenant');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(userData.password, 12);

    // Create user
    const newUser = await this.userRepository.create({
      id: uuidv4(),
      tenant_id: tenantId,
      email: userData.email,
      password_hash: passwordHash,
      first_name: userData.first_name,
      last_name: userData.last_name,
      status: 'active',
      created_at: new Date(),
      updated_at: new Date()
    });

    return newUser;
  }

  async getUserById(tenantId: string, id: string): Promise<User> {
    const user = await this.userRepository.findById(id);
    
    if (!user || user.tenant_id !== tenantId) {
      throw new NotFoundError('User', id);
    }
    
    return user;
  }

  async updateUser(tenantId: string, id: string, updateData: UpdateUserData): Promise<User> {
    // Verify user belongs to tenant
    await this.getUserById(tenantId, id);
    
    const updatedUser = await this.userRepository.update(id, updateData);
    if (!updatedUser) {
      throw new NotFoundError('User', id);
    }
    
    return updatedUser;
  }

  async deleteUser(tenantId: string, id: string): Promise<void> {
    // Verify user belongs to tenant
    await this.getUserById(tenantId, id);
    
    const deleted = await this.userRepository.delete(id);
    if (!deleted) {
      throw new NotFoundError('User', id);
    }
  }

  async getUsersByTenant(tenantId: string): Promise<User[]> {
    return this.userRepository.findByTenantId(tenantId);
  }

  async verifyPassword(email: string, password: string): Promise<User> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new ValidationError('Invalid credentials');
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      throw new ValidationError('Invalid credentials');
    }

    // Update last login
    await this.userRepository.updateLastLogin(user.id);
    
    return user;
  }
}
```

### 4. Controller with DI

```typescript
// libs/modules/user/controllers/user.controller.ts
import { injectable, inject } from 'tsyringe';
import { FastifyRequest, FastifyReply } from 'fastify';
import { IUserService, USER_SERVICE_TOKEN } from '../interfaces/user-service.interface';
import { CreateUserData, UpdateUserData } from '../dto/user.dto';
import { TenantContext } from '../../../core/interfaces/tenant-context.interface';

interface AuthenticatedRequest extends FastifyRequest {
  tenant: TenantContext;
}

@injectable()
export class UserController {
  constructor(
    @inject(USER_SERVICE_TOKEN) private userService: IUserService
  ) {}

  async getUsers(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const users = await this.userService.getUsersByTenant(request.tenant.id);
      
      return reply.code(200).send({
        success: true,
        data: users
      });
    } catch (error: any) {
      return reply.code(500).send({
        success: false,
        message: error.message
      });
    }
  }

  async getUserById(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const user = await this.userService.getUserById(request.tenant.id, id);
      
      return reply.code(200).send({
        success: true,
        data: user
      });
    } catch (error: any) {
      const statusCode = error.name === 'NotFoundError' ? 404 : 500;
      return reply.code(statusCode).send({
        success: false,
        message: error.message
      });
    }
  }

  async createUser(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const userData = request.body as CreateUserData;
      const user = await this.userService.createUser(request.tenant.id, userData);
      
      return reply.code(201).send({
        success: true,
        data: user
      });
    } catch (error: any) {
      const statusCode = error.name === 'ValidationError' ? 400 : 500;
      return reply.code(statusCode).send({
        success: false,
        message: error.message
      });
    }
  }

  async updateUser(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const updateData = request.body as UpdateUserData;
      
      const user = await this.userService.updateUser(request.tenant.id, id, updateData);
      
      return reply.code(200).send({
        success: true,
        data: user
      });
    } catch (error: any) {
      const statusCode = error.name === 'NotFoundError' ? 404 : 500;
      return reply.code(statusCode).send({
        success: false,
        message: error.message
      });
    }
  }

  async deleteUser(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      await this.userService.deleteUser(request.tenant.id, id);
      
      return reply.code(200).send({
        success: true,
        message: 'User deleted successfully'
      });
    } catch (error: any) {
      const statusCode = error.name === 'NotFoundError' ? 404 : 500;
      return reply.code(statusCode).send({
        success: false,
        message: error.message
      });
    }
  }
}
```

## 🔧 Container Configuration

### 1. DI Container Setup

```typescript
// apps/api/src/di/container-setup.ts
import 'reflect-metadata';
import { container } from 'tsyringe';

// Core services
import { DatabaseService } from '../../../libs/core/database/database.service';
import { LoggerService } from '../../../libs/core/logger/logger.service';
import { CacheService } from '../../../libs/core/cache/cache.service';

// User module
import { UserRepository } from '../../../libs/modules/user/repositories/user.repository';
import { UserService } from '../../../libs/modules/user/services/user.service';
import { UserController } from '../../../libs/modules/user/controllers/user.controller';
import { 
  USER_REPOSITORY_TOKEN, 
  USER_SERVICE_TOKEN 
} from '../../../libs/modules/user/interfaces';

// Tenant module
import { TenantRepository } from '../../../libs/modules/tenant/repositories/tenant.repository';
import { TenantService } from '../../../libs/modules/tenant/services/tenant.service';
import { 
  TENANT_REPOSITORY_TOKEN, 
  TENANT_SERVICE_TOKEN 
} from '../../../libs/modules/tenant/interfaces';

// Core services registration
container.registerSingleton(DatabaseService);
container.registerSingleton(LoggerService);
container.registerSingleton(CacheService);

// User module registration
container.register(USER_REPOSITORY_TOKEN, { useClass: UserRepository });
container.register(USER_SERVICE_TOKEN, { useClass: UserService });
container.registerSingleton(UserController);

// Tenant module registration
container.register(TENANT_REPOSITORY_TOKEN, { useClass: TenantRepository });
container.register(TENANT_SERVICE_TOKEN, { useClass: TenantService });

console.log('✅ DI Container configured successfully');
```

### 2. Fastify Plugin Integration

```typescript
// libs/core/plugins/di.plugin.ts
import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import fp from 'fastify-plugin';
import { container } from 'tsyringe';

interface DIPluginOptions extends FastifyPluginOptions {
  container?: typeof container;
}

async function diPlugin(fastify: FastifyInstance, options: DIPluginOptions) {
  const diContainer = options.container || container;
  
  // Add container to Fastify instance
  fastify.decorate('container', diContainer);
  
  // Helper method to resolve services
  fastify.decorate('resolve', <T>(token: any): T => {
    return diContainer.resolve<T>(token);
  });
}

export default fp(diPlugin, {
  name: 'di-plugin'
});
```

### 3. Route Registration with DI

```typescript
// libs/modules/user/routes/user.routes.ts
import { FastifyInstance } from 'fastify';
import { container } from 'tsyringe';
import { UserController } from '../controllers/user.controller';

export async function userRoutes(fastify: FastifyInstance) {
  const userController = container.resolve(UserController);

  // Register routes
  fastify.get('/users', {
    preHandler: [fastify.authenticate, fastify.extractTenant]
  }, userController.getUsers.bind(userController));

  fastify.get('/users/:id', {
    preHandler: [fastify.authenticate, fastify.extractTenant]
  }, userController.getUserById.bind(userController));

  fastify.post('/users', {
    preHandler: [fastify.authenticate, fastify.extractTenant]
  }, userController.createUser.bind(userController));

  fastify.put('/users/:id', {
    preHandler: [fastify.authenticate, fastify.extractTenant]
  }, userController.updateUser.bind(userController));

  fastify.delete('/users/:id', {
    preHandler: [fastify.authenticate, fastify.extractTenant]
  }, userController.deleteUser.bind(userController));
}
```

## 🧪 Testing with DI

### 1. Unit Testing with Mocks

```typescript
// libs/modules/user/services/user.service.test.ts
import 'reflect-metadata';
import { container } from 'tsyringe';
import { UserService } from './user.service';
import { IUserRepository, USER_REPOSITORY_TOKEN } from '../interfaces/user-repository.interface';
import { User } from '../entities/user.entity';

describe('UserService', () => {
  let userService: UserService;
  let mockUserRepository: jest.Mocked<IUserRepository>;

  beforeEach(() => {
    // Create mock repository
    mockUserRepository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findByEmail: jest.fn(),
      findByTenantId: jest.fn(),
      updateLastLogin: jest.fn()
    };

    // Create child container for testing
    const testContainer = container.createChildContainer();
    
    // Register mock
    testContainer.register(USER_REPOSITORY_TOKEN, {
      useValue: mockUserRepository
    });

    // Resolve service with mocked dependencies
    userService = testContainer.resolve(UserService);
  });

  afterEach(() => {
    container.clearInstances();
  });

  describe('createUser', () => {
    it('should create a new user successfully', async () => {
      // Arrange
      const tenantId = 'tenant-123';
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        first_name: 'John',
        last_name: 'Doe'
      };

      const expectedUser: User = {
        id: 'user-123',
        tenant_id: tenantId,
        email: userData.email,
        password_hash: 'hashed-password',
        first_name: userData.first_name,
        last_name: userData.last_name,
        status: 'active',
        created_at: new Date(),
        updated_at: new Date()
      };

      mockUserRepository.findByEmail.mockResolvedValue(undefined);
      mockUserRepository.create.mockResolvedValue(expectedUser);

      // Act
      const result = await userService.createUser(tenantId, userData);

      // Assert
      expect(result).toEqual(expectedUser);
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(userData.email);
      expect(mockUserRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: tenantId,
          email: userData.email,
          first_name: userData.first_name,
          last_name: userData.last_name,
          status: 'active'
        })
      );
    });

    it('should throw error if email already exists', async () => {
      // Arrange
      const tenantId = 'tenant-123';
      const userData = {
        email: 'existing@example.com',
        password: 'password123',
        first_name: 'John',
        last_name: 'Doe'
      };

      const existingUser: User = {
        id: 'existing-user',
        tenant_id: tenantId,
        email: userData.email,
        password_hash: 'hash',
        first_name: 'Existing',
        last_name: 'User',
        status: 'active',
        created_at: new Date(),
        updated_at: new Date()
      };

      mockUserRepository.findByEmail.mockResolvedValue(existingUser);

      // Act & Assert
      await expect(userService.createUser(tenantId, userData))
        .rejects.toThrow('Email already exists in this tenant');
    });
  });
});
```

### 2. Integration Testing

```typescript
// libs/modules/user/controllers/user.controller.test.ts
import 'reflect-metadata';
import { FastifyInstance } from 'fastify';
import { container } from 'tsyringe';
import { buildTestApp } from '../../../../test/helpers/test-app';
import { createTestDatabase, cleanupTestDatabase } from '../../../../test/helpers/test-database';

describe('User Controller Integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    await createTestDatabase();
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
    await cleanupTestDatabase();
  });

  beforeEach(async () => {
    // Reset DI container for each test
    container.clearInstances();
  });

  describe('POST /users', () => {
    it('should create a new user', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        first_name: 'John',
        last_name: 'Doe'
      };

      const response = await app.inject({
        method: 'POST',
        url: '/users',
        headers: {
          'authorization': 'Bearer valid-token',
          'x-tenant-id': 'tenant-123'
        },
        payload: userData
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.email).toBe(userData.email);
      expect(body.data.first_name).toBe(userData.first_name);
    });
  });
});
```

## 🏷️ Advanced DI Patterns

### 1. Factory Pattern

```typescript
// libs/core/factories/repository.factory.ts
import { injectable, inject } from 'tsyringe';
import { Knex } from 'knex';
import { DatabaseService } from '../database/database.service';

export interface RepositoryFactory {
  createUserRepository(tenantId: string): IUserRepository;
  createTenantRepository(): ITenantRepository;
}

@injectable()
export class KnexRepositoryFactory implements RepositoryFactory {
  constructor(
    @inject(DatabaseService) private databaseService: DatabaseService
  ) {}

  createUserRepository(tenantId: string): IUserRepository {
    const db = this.databaseService.getConnection(tenantId);
    return new UserRepository(db);
  }

  createTenantRepository(): ITenantRepository {
    const db = this.databaseService.getConnection();
    return new TenantRepository(db);
  }
}
```

### 2. Decorator Pattern for Caching

```typescript
// libs/core/decorators/cached.decorator.ts
import { container } from 'tsyringe';
import { CacheService } from '../cache/cache.service';

export function Cached(ttl: number = 300) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cacheService = container.resolve(CacheService);
      const cacheKey = `${target.constructor.name}:${propertyName}:${JSON.stringify(args)}`;
      
      // Try to get from cache
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Execute method and cache result
      const result = await method.apply(this, args);
      await cacheService.set(cacheKey, JSON.stringify(result), ttl);
      
      return result;
    };
  };
}

// Usage
@injectable()
export class UserService implements IUserService {
  @Cached(600) // Cache for 10 minutes
  async getUsersByTenant(tenantId: string): Promise<User[]> {
    return this.userRepository.findByTenantId(tenantId);
  }
}
```

### 3. Multi-Tenant DI Strategy

```typescript
// libs/core/di/tenant-container.ts
import { DependencyContainer, container } from 'tsyringe';

class TenantContainerManager {
  private tenantContainers = new Map<string, DependencyContainer>();

  getTenantContainer(tenantId: string): DependencyContainer {
    if (!this.tenantContainers.has(tenantId)) {
      // Create child container for tenant
      const tenantContainer = container.createChildContainer();
      
      // Register tenant-specific services
      tenantContainer.register('TenantId', { useValue: tenantId });
      
      this.tenantContainers.set(tenantId, tenantContainer);
    }

    return this.tenantContainers.get(tenantId)!;
  }

  clearTenantContainer(tenantId: string): void {
    this.tenantContainers.delete(tenantId);
  }
}

export const tenantContainerManager = new TenantContainerManager();
```

## 🚀 Performance Considerations

### 1. Lazy Loading

```typescript
// libs/core/di/lazy-injection.ts
import { container, delay } from 'tsyringe';

@injectable()
export class EmailService {
  constructor(
    @inject(delay(() => LoggerService)) private logger: LoggerService
  ) {}
}
```

### 2. Singleton vs Transient

```typescript
// Register as singleton (one instance per container)
container.registerSingleton(DatabaseService);

// Register as transient (new instance every time)
container.register('UserService', UserService);

// Register with factory
container.register('Logger', {
  useFactory: (container) => {
    return new Logger(process.env.LOG_LEVEL || 'info');
  }
});
```

## 🔒 Security Best Practices

### 1. Secure Service Registration

```typescript
// Only register trusted services
const ALLOWED_SERVICES = [
  'UserService',
  'TenantService',
  'AuthService'
];

export function secureRegister(token: string, implementation: any) {
  if (!ALLOWED_SERVICES.includes(token)) {
    throw new Error(`Service ${token} is not allowed`);
  }
  
  container.register(token, implementation);
}
```

### 2. Input Validation in Services

```typescript
@injectable()
export class UserService {
  async createUser(tenantId: string, userData: CreateUserData): Promise<User> {
    // Validate input
    if (!tenantId || typeof tenantId !== 'string') {
      throw new ValidationError('Invalid tenant ID');
    }
    
    // Continue with implementation...
  }
}
```

## 📊 Monitoring DI Container

```typescript
// libs/core/di/container-monitor.ts
import { container } from 'tsyringe';

export class ContainerMonitor {
  static getRegisteredServices(): string[] {
    // Get all registered tokens (implementation depends on TSyringe internals)
    return Array.from((container as any)._registry.keys());
  }

  static checkHealth(): boolean {
    try {
      // Try to resolve core services
      container.resolve(DatabaseService);
      container.resolve(LoggerService);
      return true;
    } catch (error) {
      return false;
    }
  }
}
```

## 🛠️ Best Practices

### 1. **Use Interfaces**

- Always define interfaces for your services
- Register implementations, not concrete classes
- Use symbol tokens for better type safety

### 2. **Keep It Simple**

- Don't over-engineer the DI setup
- Use singleton for stateless services
- Use transient for stateful services

### 3. **Testing**

- Create child containers for tests
- Mock dependencies easily
- Clear instances between tests

### 4. **Performance**

- Register expensive services as singletons
- Use lazy injection for circular dependencies
- Monitor container health

### 5. **Security**

- Validate service registrations
- Don't expose container globally
- Use proper error handling

This blueprint provides a solid foundation for implementing clean, testable, and maintainable Dependency Injection in your AegisX Platform using TSyringe.
