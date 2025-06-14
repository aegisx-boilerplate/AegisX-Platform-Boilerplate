# Knex.js CRUD Blueprint (Single-Tenant)

## 🎯 Overview

This blueprint demonstrates basic CRUD operations using Knex.js without multi-tenancy complexity. Perfect for simple applications, MVPs, or as a foundation before implementing multi-tenancy.

## 🚀 Quick Setup

### 1. Install Dependencies

```bash
npm install knex pg
npm install -D @types/pg
```

### 2. Database Configuration

```typescript
// libs/core/database/config.ts
import knex from 'knex';

export const db = knex({
  client: 'postgresql',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'myapp',
  },
  pool: {
    min: 2,
    max: 10
  },
  migrations: {
    directory: './migrations',
    extension: 'ts'
  },
  seeds: {
    directory: './seeds'
  }
});
```

## 📋 Basic CRUD Patterns

### 1. Base Repository Pattern

```typescript
// libs/core/repository/base-repository.ts
import { Knex } from 'knex';

export class BaseRepository<T> {
  constructor(
    protected db: Knex,
    protected tableName: string
  ) {}

  async findAll(): Promise<T[]> {
    return this.db(this.tableName).select('*');
  }

  async findById(id: string): Promise<T | undefined> {
    const result = await this.db(this.tableName)
      .where('id', id)
      .first();
    return result;
  }

  async create(data: Partial<T>): Promise<T> {
    const [created] = await this.db(this.tableName)
      .insert(data)
      .returning('*');
    return created;
  }

  async update(id: string, data: Partial<T>): Promise<T | undefined> {
    const [updated] = await this.db(this.tableName)
      .where('id', id)
      .update({
        ...data,
        updated_at: new Date()
      })
      .returning('*');
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const deletedCount = await this.db(this.tableName)
      .where('id', id)
      .del();
    return deletedCount > 0;
  }

  async exists(id: string): Promise<boolean> {
    const result = await this.db(this.tableName)
      .where('id', id)
      .first();
    return !!result;
  }

  async count(): Promise<number> {
    const result = await this.db(this.tableName).count('* as count').first();
    return parseInt(result?.count as string) || 0;
  }
}
```

### 2. User Repository Example

```typescript
// libs/modules/user/user.repository.ts
import { BaseRepository } from '../../core/repository/base-repository';
import { db } from '../../core/database/config';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  status: 'active' | 'inactive' | 'suspended';
  created_at: Date;
  updated_at: Date;
  last_login_at?: Date;
}

export interface CreateUserData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
}

export interface UpdateUserData {
  first_name?: string;
  last_name?: string;
  status?: 'active' | 'inactive' | 'suspended';
}

export class UserRepository extends BaseRepository<User> {
  constructor() {
    super(db, 'users');
  }

  async findByEmail(email: string): Promise<User | undefined> {
    return this.db(this.tableName)
      .where('email', email)
      .first();
  }

  async findActive(): Promise<User[]> {
    return this.db(this.tableName)
      .where('status', 'active')
      .select('*');
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.db(this.tableName)
      .where('id', id)
      .update({
        last_login_at: new Date(),
        updated_at: new Date()
      });
  }

  async searchByName(query: string): Promise<User[]> {
    return this.db(this.tableName)
      .where('first_name', 'ilike', `%${query}%`)
      .orWhere('last_name', 'ilike', `%${query}%`)
      .select('*');
  }

  async getPaginated(page: number = 1, limit: number = 10): Promise<{
    users: User[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const offset = (page - 1) * limit;
    
    const [users, totalResult] = await Promise.all([
      this.db(this.tableName)
        .limit(limit)
        .offset(offset)
        .orderBy('created_at', 'desc')
        .select('*'),
      this.count()
    ]);

    return {
      users,
      total: totalResult,
      page,
      limit,
      totalPages: Math.ceil(totalResult / limit)
    };
  }
}
```

### 3. User Service Layer

```typescript
// libs/modules/user/user.service.ts
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { UserRepository, CreateUserData, UpdateUserData, User } from './user.repository';

export class UserService {
  private userRepository: UserRepository;

  constructor() {
    this.userRepository = new UserRepository();
  }

  async createUser(userData: CreateUserData): Promise<User> {
    // Check if email already exists
    const existingUser = await this.userRepository.findByEmail(userData.email);
    if (existingUser) {
      throw new Error('Email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(userData.password, 12);

    // Create user
    const newUser = await this.userRepository.create({
      id: uuidv4(),
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

  async getUserById(id: string): Promise<User> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  async getUserByEmail(email: string): Promise<User> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  async updateUser(id: string, updateData: UpdateUserData): Promise<User> {
    const user = await this.userRepository.update(id, updateData);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  async deleteUser(id: string): Promise<void> {
    const deleted = await this.userRepository.delete(id);
    if (!deleted) {
      throw new Error('User not found');
    }
  }

  async getAllUsers(): Promise<User[]> {
    return this.userRepository.findAll();
  }

  async getActiveUsers(): Promise<User[]> {
    return this.userRepository.findActive();
  }

  async searchUsers(query: string): Promise<User[]> {
    return this.userRepository.searchByName(query);
  }

  async getUsersPaginated(page: number = 1, limit: number = 10) {
    return this.userRepository.getPaginated(page, limit);
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.userRepository.updateLastLogin(id);
  }

  async verifyPassword(email: string, password: string): Promise<User> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new Error('Invalid credentials');
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    return user;
  }
}
```

## 🌐 API Controller (Fastify)

```typescript
// apps/api/src/routes/users.ts
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { UserService } from '../../../libs/modules/user/user.service';

const userService = new UserService();

export async function userRoutes(fastify: FastifyInstance) {
  // Get all users
  fastify.get('/users', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const users = await userService.getAllUsers();
      return reply.code(200).send({
        success: true,
        data: users
      });
    } catch (error) {
      return reply.code(500).send({
        success: false,
        message: error.message
      });
    }
  });

  // Get users with pagination
  fastify.get('/users/paginated', async (request: FastifyRequest<{
    Querystring: { page?: string; limit?: string }
  }>, reply: FastifyReply) => {
    try {
      const page = parseInt(request.query.page || '1');
      const limit = parseInt(request.query.limit || '10');
      
      const result = await userService.getUsersPaginated(page, limit);
      return reply.code(200).send({
        success: true,
        data: result
      });
    } catch (error) {
      return reply.code(500).send({
        success: false,
        message: error.message
      });
    }
  });

  // Get user by ID
  fastify.get('/users/:id', async (request: FastifyRequest<{
    Params: { id: string }
  }>, reply: FastifyReply) => {
    try {
      const user = await userService.getUserById(request.params.id);
      return reply.code(200).send({
        success: true,
        data: user
      });
    } catch (error) {
      return reply.code(404).send({
        success: false,
        message: error.message
      });
    }
  });

  // Create user
  fastify.post('/users', async (request: FastifyRequest<{
    Body: {
      email: string;
      password: string;
      first_name: string;
      last_name: string;
    }
  }>, reply: FastifyReply) => {
    try {
      const user = await userService.createUser(request.body);
      return reply.code(201).send({
        success: true,
        data: user
      });
    } catch (error) {
      return reply.code(400).send({
        success: false,
        message: error.message
      });
    }
  });

  // Update user
  fastify.put('/users/:id', async (request: FastifyRequest<{
    Params: { id: string };
    Body: {
      first_name?: string;
      last_name?: string;
      status?: 'active' | 'inactive' | 'suspended';
    }
  }>, reply: FastifyReply) => {
    try {
      const user = await userService.updateUser(request.params.id, request.body);
      return reply.code(200).send({
        success: true,
        data: user
      });
    } catch (error) {
      return reply.code(404).send({
        success: false,
        message: error.message
      });
    }
  });

  // Delete user
  fastify.delete('/users/:id', async (request: FastifyRequest<{
    Params: { id: string }
  }>, reply: FastifyReply) => {
    try {
      await userService.deleteUser(request.params.id);
      return reply.code(200).send({
        success: true,
        message: 'User deleted successfully'
      });
    } catch (error) {
      return reply.code(404).send({
        success: false,
        message: error.message
      });
    }
  });

  // Search users
  fastify.get('/users/search/:query', async (request: FastifyRequest<{
    Params: { query: string }
  }>, reply: FastifyReply) => {
    try {
      const users = await userService.searchUsers(request.params.query);
      return reply.code(200).send({
        success: true,
        data: users
      });
    } catch (error) {
      return reply.code(500).send({
        success: false,
        message: error.message
      });
    }
  });
}
```

## 🗃️ Database Migrations

### Create Users Table

```typescript
// migrations/001_create_users_table.ts
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('users', (table) => {
    table.uuid('id').primary();
    table.string('email').unique().notNullable();
    table.string('password_hash').notNullable();
    table.string('first_name').notNullable();
    table.string('last_name').notNullable();
    table.enum('status', ['active', 'inactive', 'suspended']).defaultTo('active');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.timestamp('last_login_at').nullable();
    
    // Indexes
    table.index('email');
    table.index('status');
    table.index('created_at');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('users');
}
```

### Create Posts Table (Example)

```typescript
// migrations/002_create_posts_table.ts
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('posts', (table) => {
    table.uuid('id').primary();
    table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.string('title').notNullable();
    table.text('content').notNullable();
    table.enum('status', ['draft', 'published', 'archived']).defaultTo('draft');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.timestamp('published_at').nullable();
    
    // Indexes
    table.index('user_id');
    table.index('status');
    table.index('created_at');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('posts');
}
```

## 🧪 Testing Examples

### Repository Tests

```typescript
// libs/modules/user/user.repository.test.ts
import { UserRepository } from './user.repository';
import { db } from '../../core/database/config';

describe('UserRepository', () => {
  let userRepository: UserRepository;

  beforeAll(async () => {
    userRepository = new UserRepository();
    // Run migrations in test database
    await db.migrate.latest();
  });

  afterAll(async () => {
    await db.destroy();
  });

  beforeEach(async () => {
    // Clean up data before each test
    await db('users').del();
  });

  describe('create', () => {
    it('should create a new user', async () => {
      const userData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        password_hash: 'hashedpassword',
        first_name: 'John',
        last_name: 'Doe',
        status: 'active' as const,
        created_at: new Date(),
        updated_at: new Date()
      };

      const user = await userRepository.create(userData);

      expect(user.email).toBe(userData.email);
      expect(user.first_name).toBe(userData.first_name);
      expect(user.last_name).toBe(userData.last_name);
    });
  });

  describe('findByEmail', () => {
    it('should find user by email', async () => {
      const userData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        password_hash: 'hashedpassword',
        first_name: 'John',
        last_name: 'Doe',
        status: 'active' as const,
        created_at: new Date(),
        updated_at: new Date()
      };

      await userRepository.create(userData);
      const foundUser = await userRepository.findByEmail('test@example.com');

      expect(foundUser).toBeDefined();
      expect(foundUser?.email).toBe('test@example.com');
    });

    it('should return undefined for non-existent email', async () => {
      const foundUser = await userRepository.findByEmail('nonexistent@example.com');
      expect(foundUser).toBeUndefined();
    });
  });
});
```

### Service Tests

```typescript
// libs/modules/user/user.service.test.ts
import { UserService } from './user.service';
import { db } from '../../core/database/config';

describe('UserService', () => {
  let userService: UserService;

  beforeAll(async () => {
    userService = new UserService();
    await db.migrate.latest();
  });

  afterAll(async () => {
    await db.destroy();
  });

  beforeEach(async () => {
    await db('users').del();
  });

  describe('createUser', () => {
    it('should create a new user with hashed password', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'plainpassword',
        first_name: 'John',
        last_name: 'Doe'
      };

      const user = await userService.createUser(userData);

      expect(user.email).toBe(userData.email);
      expect(user.password_hash).not.toBe(userData.password);
      expect(user.password_hash).toBeDefined();
    });

    it('should throw error for duplicate email', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'plainpassword',
        first_name: 'John',
        last_name: 'Doe'
      };

      await userService.createUser(userData);

      await expect(userService.createUser(userData))
        .rejects.toThrow('Email already exists');
    });
  });
});
```

## 🚀 Running Commands

### Setup Database

```bash
# Run migrations
npx knex migrate:latest

# Rollback migration
npx knex migrate:rollback

# Run seeds
npx knex seed:run
```

### Knex Configuration File

```typescript
// knexfile.ts
import { Knex } from 'knex';

const config: { [key: string]: Knex.Config } = {
  development: {
    client: 'postgresql',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      database: process.env.DB_NAME || 'myapp_dev',
    },
    migrations: {
      directory: './migrations',
      extension: 'ts'
    },
    seeds: {
      directory: './seeds'
    }
  },

  test: {
    client: 'postgresql',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      database: process.env.DB_NAME || 'myapp_test',
    },
    migrations: {
      directory: './migrations',
      extension: 'ts'
    }
  },

  production: {
    client: 'postgresql',
    connection: process.env.DATABASE_URL,
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      directory: './migrations',
      extension: 'ts'
    }
  }
};

export default config;
```

## 🔒 Best Practices

### 1. Input Validation

```typescript
// libs/core/validation/user.schema.ts
import Joi from 'joi';

export const createUserSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  first_name: Joi.string().min(1).max(50).required(),
  last_name: Joi.string().min(1).max(50).required()
});

export const updateUserSchema = Joi.object({
  first_name: Joi.string().min(1).max(50).optional(),
  last_name: Joi.string().min(1).max(50).optional(),
  status: Joi.string().valid('active', 'inactive', 'suspended').optional()
});
```

### 2. Error Handling

```typescript
// libs/core/errors/custom-errors.ts
export class NotFoundError extends Error {
  constructor(resource: string, id: string) {
    super(`${resource} with id ${id} not found`);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class DuplicateError extends Error {
  constructor(field: string, value: string) {
    super(`${field} '${value}' already exists`);
    this.name = 'DuplicateError';
  }
}
```

### 3. Transaction Support

```typescript
// Example with transactions
async createUserWithProfile(userData: CreateUserData, profileData: any): Promise<User> {
  return this.db.transaction(async (trx) => {
    // Create user
    const user = await trx('users').insert(userData).returning('*');
    
    // Create profile
    await trx('user_profiles').insert({
      user_id: user[0].id,
      ...profileData
    });
    
    return user[0];
  });
}
```

## 📊 Performance Tips

1. **Use Indexes**: Add proper indexes for frequently queried columns
2. **Limit Results**: Always use pagination for large datasets
3. **Select Specific Columns**: Don't use `SELECT *` in production
4. **Connection Pooling**: Configure proper pool sizes
5. **Query Optimization**: Use `explain` to analyze query performance

## 🔄 Migration to Multi-Tenancy

When ready to add multi-tenancy, you can:

1. Add `tenant_id` column to existing tables
2. Update all queries to include tenant filtering
3. Implement tenant context middleware
4. Refer to [Knex Multi-Tenancy Blueprint](./knex-multi-tenancy-blueprint.md)

This single-tenant pattern provides a solid foundation that can be evolved into multi-tenant architecture when needed.
