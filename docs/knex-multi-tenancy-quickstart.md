# Knex Multi-Tenancy Quick Start Guide

## 🚀 Quick Setup (5 minutes)

### 1. Install Dependencies

```bash
npm install knex pg
npm install -D @types/pg
```

### 2. Basic Setup

```typescript
// libs/core/database/setup.ts
import knex from 'knex';

export const db = knex({
  client: 'postgresql',
  connection: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  },
  pool: {
    min: 2,
    max: 10
  }
});
```

### 3. Create Tenant-Safe Repository

```typescript
// libs/core/repository.ts
import { Knex } from 'knex';

export class TenantRepository<T> {
  constructor(
    private db: Knex,
    private table: string,
    private tenantId: string
  ) {}

  // Auto-filter by tenant_id
  private query() {
    return this.db(this.table).where('tenant_id', this.tenantId);
  }

  // ✅ Safe CRUD operations
  async findAll(): Promise<T[]> {
    return this.query().select('*');
  }

  async findById(id: string): Promise<T | null> {
    const result = await this.query().where('id', id).first();
    return result || null;
  }

  async create(data: Omit<T, 'id' | 'tenant_id'>): Promise<T> {
    const [created] = await this.db(this.table)
      .insert({
        ...data,
        id: crypto.randomUUID(),
        tenant_id: this.tenantId,
        created_at: new Date(),
        updated_at: new Date()
      })
      .returning('*');
    return created;
  }

  async update(id: string, data: Partial<T>): Promise<T | null> {
    const [updated] = await this.query()
      .where('id', id)
      .update({
        ...data,
        updated_at: new Date()
      })
      .returning('*');
    return updated || null;
  }

  async delete(id: string): Promise<boolean> {
    const deleted = await this.query().where('id', id).del();
    return deleted > 0;
  }

  async count(): Promise<number> {
    const result = await this.query().count('* as count').first();
    return parseInt(result?.count as string) || 0;
  }
}
```

## 📋 Real-World Example: User Management

### 1. User Interface

```typescript
// types/user.ts
export interface User {
  id: string;
  tenant_id: string;
  email: string;
  first_name: string;
  last_name: string;
  status: 'active' | 'inactive';
  created_at: Date;
  updated_at: Date;
}

export interface CreateUser {
  email: string;
  first_name: string;
  last_name: string;
  password: string;
}
```

### 2. User Repository

```typescript
// repositories/user-repository.ts
import { TenantRepository } from '../core/repository';
import { User, CreateUser } from '../types/user';

export class UserRepository extends TenantRepository<User> {
  constructor(db: Knex, tenantId: string) {
    super(db, 'users', tenantId);
  }

  // Custom methods
  async findByEmail(email: string): Promise<User | null> {
    const result = await this.query().where('email', email).first();
    return result || null;
  }

  async findActive(): Promise<User[]> {
    return this.query().where('status', 'active').select('*');
  }

  async createUser(userData: CreateUser): Promise<User> {
    // Check if email exists
    const existing = await this.findByEmail(userData.email);
    if (existing) {
      throw new Error('Email already exists');
    }

    // Hash password
    const passwordHash = await hashPassword(userData.password);

    return this.create({
      email: userData.email,
      first_name: userData.first_name,
      last_name: userData.last_name,
      password_hash: passwordHash,
      status: 'active'
    });
  }
}

async function hashPassword(password: string): Promise<string> {
  const bcrypt = require('bcrypt');
  return bcrypt.hash(password, 10);
}
```

### 3. User Service

```typescript
// services/user-service.ts
import { UserRepository } from '../repositories/user-repository';
import { CreateUser, User } from '../types/user';

export class UserService {
  private userRepo: UserRepository;

  constructor(db: Knex, tenantId: string) {
    this.userRepo = new UserRepository(db, tenantId);
  }

  async getAllUsers(): Promise<User[]> {
    return this.userRepo.findAll();
  }

  async getUserById(id: string): Promise<User | null> {
    return this.userRepo.findById(id);
  }

  async createUser(userData: CreateUser): Promise<User> {
    return this.userRepo.createUser(userData);
  }

  async updateUser(id: string, data: Partial<User>): Promise<User | null> {
    return this.userRepo.update(id, data);
  }

  async deleteUser(id: string): Promise<boolean> {
    return this.userRepo.delete(id);
  }

  async getUserCount(): Promise<number> {
    return this.userRepo.count();
  }
}
```

### 4. Fastify Controller

```typescript
// controllers/user-controller.ts
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { UserService } from '../services/user-service';
import { CreateUser } from '../types/user';

interface TenantRequest extends FastifyRequest {
  tenantId: string;
}

export async function userRoutes(fastify: FastifyInstance) {
  
  // GET /users
  fastify.get('/users', async (request: TenantRequest, reply: FastifyReply) => {
    const userService = new UserService(fastify.db, request.tenantId);
    const users = await userService.getAllUsers();
    
    return { users };
  });

  // GET /users/:id
  fastify.get('/users/:id', async (request: TenantRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const userService = new UserService(fastify.db, request.tenantId);
    
    const user = await userService.getUserById(id);
    if (!user) {
      return reply.code(404).send({ error: 'User not found' });
    }
    
    return { user };
  });

  // POST /users
  fastify.post('/users', async (request: TenantRequest, reply: FastifyReply) => {
    const userData = request.body as CreateUser;
    const userService = new UserService(fastify.db, request.tenantId);
    
    try {
      const user = await userService.createUser(userData);
      return reply.code(201).send({ user });
    } catch (error) {
      return reply.code(400).send({ error: error.message });
    }
  });

  // PUT /users/:id
  fastify.put('/users/:id', async (request: TenantRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const updateData = request.body as Partial<User>;
    const userService = new UserService(fastify.db, request.tenantId);
    
    const user = await userService.updateUser(id, updateData);
    if (!user) {
      return reply.code(404).send({ error: 'User not found' });
    }
    
    return { user };
  });

  // DELETE /users/:id
  fastify.delete('/users/:id', async (request: TenantRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const userService = new UserService(fastify.db, request.tenantId);
    
    const deleted = await userService.deleteUser(id);
    if (!deleted) {
      return reply.code(404).send({ error: 'User not found' });
    }
    
    return { success: true };
  });
}
```

### 5. Tenant Middleware

```typescript
// middleware/tenant-middleware.ts
import { FastifyRequest, FastifyReply } from 'fastify';

interface TenantRequest extends FastifyRequest {
  tenantId: string;
}

export async function tenantMiddleware(
  request: TenantRequest,
  reply: FastifyReply
) {
  // Extract tenant from subdomain
  const host = request.headers.host;
  if (host) {
    const subdomain = host.split('.')[0];
    if (subdomain && subdomain !== 'www' && subdomain !== 'api') {
      request.tenantId = subdomain;
      return;
    }
  }

  // Extract from header
  const tenantHeader = request.headers['x-tenant-id'] as string;
  if (tenantHeader) {
    request.tenantId = tenantHeader;
    return;
  }

  // No tenant found
  return reply.code(400).send({ error: 'Tenant identification required' });
}
```

## 🗄️ Database Schema

```sql
-- Migration: Create tenants table
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  subdomain VARCHAR(100) UNIQUE NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  config JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Migration: Create users table with tenant_id
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(tenant_id, email)
);

-- Indexes for performance
CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_users_email ON users(tenant_id, email);
CREATE INDEX idx_users_status ON users(tenant_id, status);
```

## 🧪 Testing Example

```typescript
// tests/user-service.test.ts
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import knex, { Knex } from 'knex';
import { UserService } from '../services/user-service';

describe('UserService', () => {
  let db: Knex;
  let userService: UserService;
  const tenantId = 'test-tenant-123';

  beforeEach(async () => {
    // Create test database connection
    db = knex({
      client: 'postgresql',
      connection: {
        host: 'localhost',
        port: 5432,
        user: 'test',
        password: 'test',
        database: 'test_db'
      }
    });

    // Setup test data
    await db('tenants').insert({
      id: tenantId,
      name: 'Test Tenant',
      subdomain: 'test'
    });

    userService = new UserService(db, tenantId);
  });

  afterEach(async () => {
    // Cleanup
    await db('users').where('tenant_id', tenantId).del();
    await db('tenants').where('id', tenantId).del();
    await db.destroy();
  });

  it('should create user within tenant', async () => {
    const userData = {
      email: 'test@example.com',
      first_name: 'John',
      last_name: 'Doe',
      password: 'password123'
    };

    const user = await userService.createUser(userData);

    expect(user.tenant_id).toBe(tenantId);
    expect(user.email).toBe(userData.email);
    expect(user.id).toBeDefined();
  });

  it('should only find users within tenant', async () => {
    // Create user in our tenant
    await userService.createUser({
      email: 'user1@example.com',
      first_name: 'User',
      last_name: 'One',
      password: 'password'
    });

    // Create user in different tenant
    await db('users').insert({
      id: crypto.randomUUID(),
      tenant_id: 'other-tenant',
      email: 'user2@example.com',
      first_name: 'User',
      last_name: 'Two',
      password_hash: 'hash',
      created_at: new Date(),
      updated_at: new Date()
    });

    const users = await userService.getAllUsers();

    expect(users).toHaveLength(1);
    expect(users[0].email).toBe('user1@example.com');
  });
});
```

## 🚀 Complete App Setup

```typescript
// app.ts
import Fastify from 'fastify';
import { db } from './libs/core/database/setup';
import { tenantMiddleware } from './middleware/tenant-middleware';
import { userRoutes } from './controllers/user-controller';

const fastify = Fastify({ logger: true });

// Register database
fastify.decorate('db', db);

// Register tenant middleware
fastify.addHook('preHandler', tenantMiddleware);

// Register routes
fastify.register(userRoutes, { prefix: '/api' });

// Start server
const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: '0.0.0.0' });
    console.log('Server running on http://localhost:3000');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
```

## 📝 Usage Examples

### API Calls

```bash
# Create user for tenant "company-a"
curl -X POST http://company-a.localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@company-a.com",
    "first_name": "John",
    "last_name": "Doe",
    "password": "securepassword"
  }'

# Get all users for tenant "company-a"
curl http://company-a.localhost:3000/api/users

# Get user by ID
curl http://company-a.localhost:3000/api/users/123e4567-e89b-12d3-a456-426614174000

# Update user
curl -X PUT http://company-a.localhost:3000/api/users/123e4567-e89b-12d3-a456-426614174000 \
  -H "Content-Type: application/json" \
  -d '{"first_name": "Jane"}'

# Delete user
curl -X DELETE http://company-a.localhost:3000/api/users/123e4567-e89b-12d3-a456-426614174000
```

## 🔐 Security Best Practices

1. **Always use TenantRepository** - Never query directly with raw Knex
2. **Validate tenant access** - Check user belongs to tenant
3. **Use transactions** - For multi-table operations
4. **Implement rate limiting** - Per tenant limits
5. **Audit logging** - Track all tenant operations

```typescript
// ✅ SAFE - Uses tenant repository
const users = await userRepository.findAll();

// ❌ DANGEROUS - Bypasses tenant isolation  
const users = await db('users').select('*');

// ✅ SAFE - With transaction
await db.transaction(async (trx) => {
  const tenantRepo = new TenantRepository(trx, 'users', tenantId);
  await tenantRepo.create(userData);
});
```

This setup gives you:

- ✅ **Complete tenant isolation**
- ✅ **Type-safe operations**
- ✅ **Easy CRUD patterns**
- ✅ **Minimal boilerplate**
- ✅ **Production ready**
