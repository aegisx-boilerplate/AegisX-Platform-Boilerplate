# Multi-Tenancy Implementation Guide

## Overview
This guide covers implementing multi-tenancy support in AegisX Platform, allowing the application to serve multiple organizations or clients with data isolation and customization.

## Architecture Strategies

### 1. Single Database with Tenant ID (Recommended)
- **Pros**: Simple to implement, cost-effective, easy to maintain
- **Cons**: Security concerns, scaling limitations
- **Best for**: Small to medium applications with trusted tenants

### 2. Schema Per Tenant
- **Pros**: Better isolation, easier to backup individual tenants
- **Cons**: Schema management complexity, limited number of schemas
- **Best for**: Medium applications with moderate isolation requirements

### 3. Database Per Tenant
- **Pros**: Complete isolation, independent scaling
- **Cons**: High resource usage, complex management
- **Best for**: Enterprise applications with strict isolation requirements

## Implementation

### Core Interfaces

```typescript
// libs/core/tenant/interfaces.ts
export interface TenantContext {
  id: string;
  name: string;
  schema?: string;
  config: TenantConfig;
  status: 'active' | 'suspended' | 'inactive';
}

export interface TenantConfig {
  features: string[];
  limits: {
    maxUsers: number;
    maxStorage: number;
    apiRateLimit: number;
  };
  customization: {
    logo?: string;
    theme?: string;
    domain?: string;
  };
}
```

### Database Schema

```sql
-- Tenants table
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add tenant_id to all business tables
ALTER TABLE users ADD COLUMN tenant_id UUID REFERENCES tenants(id);
ALTER TABLE roles ADD COLUMN tenant_id UUID REFERENCES tenants(id);
-- ... add to all relevant tables

-- Indexes for performance
CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_roles_tenant_id ON roles(tenant_id);
```

### Tenant Context Middleware

```typescript
// libs/plugins/fastify-tenant/index.ts
import { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

declare module 'fastify' {
  interface FastifyRequest {
    tenant: TenantContext;
  }
}

export default fp(async function tenantPlugin(fastify: FastifyInstance) {
  fastify.decorateRequest('tenant', null);

  fastify.addHook('preHandler', async (request: FastifyRequest, reply) => {
    const tenantId = extractTenantId(request);
    
    if (!tenantId) {
      reply.code(400).send({ error: 'Tenant identification required' });
      return;
    }

    const tenant = await fastify.tenantService.findById(tenantId);
    if (!tenant || tenant.status !== 'active') {
      reply.code(404).send({ error: 'Tenant not found or inactive' });
      return;
    }

    request.tenant = tenant;
  });
});

function extractTenantId(request: FastifyRequest): string | null {
  // Method 1: From subdomain
  const host = request.headers.host;
  if (host) {
    const subdomain = host.split('.')[0];
    if (subdomain !== 'www' && subdomain !== 'api') {
      return subdomain;
    }
  }

  // Method 2: From header
  const tenantHeader = request.headers['x-tenant-id'] as string;
  if (tenantHeader) return tenantHeader;

  // Method 3: From JWT token
  const token = request.headers.authorization?.replace('Bearer ', '');
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;
      return decoded.tenantId;
    } catch (error) {
      // Invalid token, continue to other methods
    }
  }

  // Method 4: From query parameter
  return request.query.tenant_id as string || null;
}
```

### Tenant-Aware Query Builder

```typescript
// libs/core/database/tenant-query-builder.ts
import { Knex } from 'knex';

export class TenantQueryBuilder {
  constructor(
    private knex: Knex,
    private tenantId: string
  ) {}

  // Automatically add tenant_id to all queries
  table(tableName: string): Knex.QueryBuilder {
    return this.knex(tableName).where('tenant_id', this.tenantId);
  }

  // For queries that need to access cross-tenant data (admin only)
  adminTable(tableName: string): Knex.QueryBuilder {
    return this.knex(tableName);
  }

  // Transaction with tenant context
  async transaction<T>(
    callback: (trx: Knex.Transaction, builder: TenantQueryBuilder) => Promise<T>
  ): Promise<T> {
    return this.knex.transaction(async (trx) => {
      const tenantTrx = new TenantQueryBuilder(trx, this.tenantId);
      return callback(trx, tenantTrx);
    });
  }
}
```

### Repository Pattern with Tenant Support

```typescript
// libs/core/database/base-repository.ts
export abstract class BaseTenantRepository<T> {
  constructor(
    protected db: TenantQueryBuilder,
    protected tableName: string
  ) {}

  async findAll(filters?: any): Promise<T[]> {
    let query = this.db.table(this.tableName);
    
    if (filters) {
      query = this.applyFilters(query, filters);
    }
    
    return query.select('*');
  }

  async findById(id: string): Promise<T | null> {
    const result = await this.db.table(this.tableName)
      .where('id', id)
      .first();
    
    return result || null;
  }

  async create(data: Partial<T>): Promise<T> {
    const [created] = await this.db.table(this.tableName)
      .insert({
        ...data,
        tenant_id: this.db.tenantId,
        created_at: new Date(),
        updated_at: new Date()
      })
      .returning('*');
    
    return created;
  }

  async update(id: string, data: Partial<T>): Promise<T | null> {
    const [updated] = await this.db.table(this.tableName)
      .where('id', id)
      .update({
        ...data,
        updated_at: new Date()
      })
      .returning('*');
    
    return updated || null;
  }

  async delete(id: string): Promise<boolean> {
    const deleted = await this.db.table(this.tableName)
      .where('id', id)
      .del();
    
    return deleted > 0;
  }

  protected applyFilters(query: Knex.QueryBuilder, filters: any): Knex.QueryBuilder {
    // Override in child classes for specific filtering logic
    return query;
  }
}
```

### Tenant Service

```typescript
// libs/modules/tenant/tenant.service.ts
export class TenantService {
  constructor(
    private db: Knex,
    private redis: Redis
  ) {}

  async findById(id: string): Promise<TenantContext | null> {
    // Check cache first
    const cached = await this.redis.get(`tenant:${id}`);
    if (cached) {
      return JSON.parse(cached);
    }

    // Query database
    const tenant = await this.db('tenants')
      .where('id', id)
      .orWhere('slug', id)
      .first();

    if (!tenant) return null;

    const tenantContext: TenantContext = {
      id: tenant.id,
      name: tenant.name,
      config: tenant.config,
      status: tenant.status
    };

    // Cache for 5 minutes
    await this.redis.setex(`tenant:${id}`, 300, JSON.stringify(tenantContext));

    return tenantContext;
  }

  async createTenant(data: {
    name: string;
    slug: string;
    config?: TenantConfig;
  }): Promise<TenantContext> {
    const tenant = await this.db('tenants')
      .insert({
        name: data.name,
        slug: data.slug,
        config: data.config || this.getDefaultConfig(),
        status: 'active'
      })
      .returning('*');

    // Initialize tenant data (default admin user, roles, etc.)
    await this.initializeTenantData(tenant[0].id);

    return tenant[0];
  }

  private getDefaultConfig(): TenantConfig {
    return {
      features: ['users', 'roles', 'audit'],
      limits: {
        maxUsers: 100,
        maxStorage: 1024 * 1024 * 1024, // 1GB
        apiRateLimit: 1000
      },
      customization: {}
    };
  }

  private async initializeTenantData(tenantId: string): Promise<void> {
    const tenantDb = new TenantQueryBuilder(this.db, tenantId);

    // Create default admin role
    await tenantDb.table('roles').insert({
      id: uuidv4(),
      name: 'Admin',
      permissions: ['*'],
      tenant_id: tenantId
    });

    // Create default admin user
    await tenantDb.table('users').insert({
      id: uuidv4(),
      email: 'admin@tenant.local',
      password: await hashPassword('admin123'),
      role_id: adminRole.id,
      tenant_id: tenantId
    });
  }
}
```

### Usage Examples

```typescript
// In a Fastify route handler
fastify.get('/users', async (request, reply) => {
  const tenantDb = new TenantQueryBuilder(fastify.db, request.tenant.id);
  const userRepo = new UserRepository(tenantDb);
  
  const users = await userRepo.findAll({
    active: true,
    limit: 10
  });
  
  return { users };
});

// In a service
class UserService {
  constructor(private tenantDb: TenantQueryBuilder) {}
  
  async createUser(userData: CreateUserDto): Promise<User> {
    const userRepo = new UserRepository(this.tenantDb);
    
    // Check tenant limits
    const userCount = await userRepo.count();
    const maxUsers = this.getCurrentTenant().config.limits.maxUsers;
    
    if (userCount >= maxUsers) {
      throw new Error('User limit exceeded');
    }
    
    return userRepo.create(userData);
  }
}
```

## Security Considerations

1. **Data Isolation**: Always ensure tenant_id is included in queries
2. **Cross-Tenant Access**: Implement strict validation for admin operations
3. **Resource Limits**: Enforce tenant-specific limits and quotas
4. **Audit Logging**: Track all cross-tenant operations
5. **Rate Limiting**: Apply tenant-specific rate limits

## Testing

```typescript
// Test with different tenant contexts
describe('Multi-Tenant User Service', () => {
  let tenantA: TenantContext;
  let tenantB: TenantContext;

  beforeEach(async () => {
    tenantA = await createTestTenant('tenant-a');
    tenantB = await createTestTenant('tenant-b');
  });

  it('should isolate data between tenants', async () => {
    const userServiceA = new UserService(new TenantQueryBuilder(db, tenantA.id));
    const userServiceB = new UserService(new TenantQueryBuilder(db, tenantB.id));

    const userA = await userServiceA.create({ email: 'user@a.com' });
    const userB = await userServiceB.create({ email: 'user@b.com' });

    const usersA = await userServiceA.findAll();
    const usersB = await userServiceB.findAll();

    expect(usersA).toHaveLength(1);
    expect(usersB).toHaveLength(1);
    expect(usersA[0].id).not.toBe(usersB[0].id);
  });
});
```

## Migration Strategy

1. **Add tenant_id columns** to existing tables
2. **Create default tenant** for existing data
3. **Update application code** to use tenant-aware queries
4. **Migrate data** to assign proper tenant_id values
5. **Add constraints** and indexes for performance
6. **Test thoroughly** before production deployment
