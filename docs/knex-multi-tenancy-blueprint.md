# Knex.js Multi-Tenancy Blueprint

## Table of Contents

- [Overview](#overview)
- [Core Architecture](#core-architecture)
- [Tenant-Safe Query Builder](#tenant-safe-query-builder)
- [Repository Pattern](#repository-pattern)
- [Service Layer](#service-layer)
- [CRUD Operations](#crud-operations)
- [Advanced Patterns](#advanced-patterns)
- [Testing](#testing)
- [Best Practices](#best-practices)

## Overview

This blueprint provides a comprehensive implementation of Multi-Tenancy using Knex.js with safety-first approach. It focuses on ease of use while maintaining strict tenant isolation.

### Key Features

- **Automatic Tenant Isolation** - No need to remember tenant_id in queries
- **Type-Safe CRUD Operations** - TypeScript-first approach
- **Flexible Architecture** - Supports all tenancy strategies
- **Developer-Friendly API** - Simple and intuitive interface
- **Built-in Safety** - Prevents accidental cross-tenant access

## Core Architecture

### 1. Tenant Context

```typescript
// libs/core/tenant/types.ts
export interface TenantContext {
  id: string;
  name: string;
  subdomain: string;
  status: 'active' | 'suspended' | 'inactive';
  config: TenantConfig;
}

export interface TenantConfig {
  features: string[];
  limits: {
    maxUsers: number;
    maxStorage: number;
    apiRateLimit: number;
  };
  database?: {
    strategy: 'shared' | 'schema' | 'database';
    schema?: string;
    database?: string;
  };
}
```

### 2. Tenant Connection Manager

```typescript
// libs/core/database/tenant-connection-manager.ts
import { Knex } from 'knex';
import { TenantContext } from '../tenant/types';

export class TenantConnectionManager {
  private connections = new Map<string, Knex>();
  private baseKnex: Knex;

  constructor(baseKnex: Knex) {
    this.baseKnex = baseKnex;
  }

  getTenantConnection(tenant: TenantContext): Knex {
    const strategy = tenant.config.database?.strategy || 'shared';
    
    switch (strategy) {
      case 'database':
        return this.getDatabasePerTenantConnection(tenant);
      case 'schema':
        return this.getSchemaPerTenantConnection(tenant);
      default:
        return this.baseKnex;
    }
  }

  private getDatabasePerTenantConnection(tenant: TenantContext): Knex {
    const connectionKey = `db_${tenant.id}`;
    
    if (!this.connections.has(connectionKey)) {
      const connection = this.baseKnex.withUserParams({
        database: tenant.config.database?.database || `tenant_${tenant.id}`
      });
      this.connections.set(connectionKey, connection);
    }
    
    return this.connections.get(connectionKey)!;
  }

  private getSchemaPerTenantConnection(tenant: TenantContext): Knex {
    const connectionKey = `schema_${tenant.id}`;
    
    if (!this.connections.has(connectionKey)) {
      const connection = this.baseKnex.withSchema(
        tenant.config.database?.schema || `tenant_${tenant.id}`
      );
      this.connections.set(connectionKey, connection);
    }
    
    return this.connections.get(connectionKey)!;
  }

  async closeAllConnections(): Promise<void> {
    const closePromises = Array.from(this.connections.values())
      .map(connection => connection.destroy());
    
    await Promise.all(closePromises);
    this.connections.clear();
  }
}
```

## Tenant-Safe Query Builder

### 1. Core Query Builder

```typescript
// libs/core/database/tenant-query-builder.ts
import { Knex } from 'knex';
import { TenantContext } from '../tenant/types';

export class TenantQueryBuilder {
  private knex: Knex;
  private tenantId: string;
  private strategy: string;

  constructor(knex: Knex, tenant: TenantContext) {
    this.knex = knex;
    this.tenantId = tenant.id;
    this.strategy = tenant.config.database?.strategy || 'shared';
  }

  /**
   * Get a table query builder with automatic tenant filtering
   */
  table<T = any>(tableName: string): Knex.QueryBuilder<T> {
    const query = this.knex<T>(tableName);
    
    // Auto-add tenant_id filter for shared database strategy
    if (this.strategy === 'shared') {
      return query.where('tenant_id', this.tenantId);
    }
    
    return query;
  }

  /**
   * Raw query with tenant context
   */
  raw(sql: string, bindings?: any[]): Knex.Raw {
    return this.knex.raw(sql, bindings);
  }

  /**
   * Transaction with tenant context
   */
  async transaction<T>(
    callback: (trx: Knex.Transaction, tenantTrx: TenantQueryBuilder) => Promise<T>
  ): Promise<T> {
    return this.knex.transaction(async (trx) => {
      const tenantTrx = new TenantQueryBuilder(trx, {
        id: this.tenantId,
        config: { database: { strategy: this.strategy } }
      } as TenantContext);
      
      return callback(trx, tenantTrx);
    });
  }

  /**
   * Admin-only: Access without tenant filtering (dangerous!)
   */
  adminTable<T = any>(tableName: string): Knex.QueryBuilder<T> {
    if (!this.isAdminContext()) {
      throw new Error('Admin access required for cross-tenant queries');
    }
    return this.knex<T>(tableName);
  }

  /**
   * Get tenant ID
   */
  getTenantId(): string {
    return this.tenantId;
  }

  private isAdminContext(): boolean {
    // Implement admin check logic
    return process.env.NODE_ENV === 'development' || false;
  }
}
```

### 2. Query Builder Factory

```typescript
// libs/core/database/tenant-query-factory.ts
import { Injectable } from '@nestjs/common';
import { Knex } from 'knex';
import { TenantConnectionManager } from './tenant-connection-manager';
import { TenantQueryBuilder } from './tenant-query-builder';
import { TenantContext } from '../tenant/types';

@Injectable()
export class TenantQueryFactory {
  constructor(
    private knex: Knex,
    private connectionManager: TenantConnectionManager
  ) {}

  createTenantQuery(tenant: TenantContext): TenantQueryBuilder {
    const connection = this.connectionManager.getTenantConnection(tenant);
    return new TenantQueryBuilder(connection, tenant);
  }

  createAdminQuery(): Knex {
    return this.knex;
  }
}
```

## Repository Pattern

### 1. Base Tenant Repository

```typescript
// libs/core/database/base-tenant-repository.ts
import { TenantQueryBuilder } from './tenant-query-builder';

export interface BaseEntity {
  id: string;
  tenant_id?: string;
  created_at: Date;
  updated_at: Date;
}

export interface FindOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
  where?: Record<string, any>;
}

export interface CreateOptions {
  returning?: string[];
}

export interface UpdateOptions {
  returning?: string[];
}

export abstract class BaseTenantRepository<T extends BaseEntity> {
  protected tableName: string;
  protected tenantQuery: TenantQueryBuilder;

  constructor(tableName: string, tenantQuery: TenantQueryBuilder) {
    this.tableName = tableName;
    this.tenantQuery = tenantQuery;
  }

  /**
   * Find all records with optional filtering
   */
  async findAll(options: FindOptions = {}): Promise<T[]> {
    let query = this.tenantQuery.table<T>(this.tableName);

    if (options.where) {
      query = query.where(options.where);
    }

    if (options.orderBy) {
      query = query.orderBy(options.orderBy, options.orderDirection || 'asc');
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.offset(options.offset);
    }

    return query.select('*');
  }

  /**
   * Find record by ID
   */
  async findById(id: string): Promise<T | null> {
    const result = await this.tenantQuery
      .table<T>(this.tableName)
      .where('id', id)
      .first();

    return result || null;
  }

  /**
   * Find one record by criteria
   */
  async findOne(where: Record<string, any>): Promise<T | null> {
    const result = await this.tenantQuery
      .table<T>(this.tableName)
      .where(where)
      .first();

    return result || null;
  }

  /**
   * Count records
   */
  async count(where?: Record<string, any>): Promise<number> {
    let query = this.tenantQuery.table(this.tableName);

    if (where) {
      query = query.where(where);
    }

    const result = await query.count('* as count').first();
    return parseInt(result?.count as string) || 0;
  }

  /**
   * Check if record exists
   */
  async exists(where: Record<string, any>): Promise<boolean> {
    const count = await this.count(where);
    return count > 0;
  }

  /**
   * Create new record
   */
  async create(data: Omit<T, 'id' | 'created_at' | 'updated_at'>, options: CreateOptions = {}): Promise<T> {
    const insertData = {
      ...data,
      id: this.generateId(),
      tenant_id: this.tenantQuery.getTenantId(),
      created_at: new Date(),
      updated_at: new Date(),
    };

    const [result] = await this.tenantQuery
      .table<T>(this.tableName)
      .insert(insertData)
      .returning(options.returning || '*');

    return result;
  }

  /**
   * Create multiple records
   */
  async createMany(
    dataArray: Array<Omit<T, 'id' | 'created_at' | 'updated_at'>>,
    options: CreateOptions = {}
  ): Promise<T[]> {
    const insertData = dataArray.map(data => ({
      ...data,
      id: this.generateId(),
      tenant_id: this.tenantQuery.getTenantId(),
      created_at: new Date(),
      updated_at: new Date(),
    }));

    return this.tenantQuery
      .table<T>(this.tableName)
      .insert(insertData)
      .returning(options.returning || '*');
  }

  /**
   * Update record by ID
   */
  async updateById(
    id: string,
    data: Partial<Omit<T, 'id' | 'tenant_id' | 'created_at'>>,
    options: UpdateOptions = {}
  ): Promise<T | null> {
    const updateData = {
      ...data,
      updated_at: new Date(),
    };

    const [result] = await this.tenantQuery
      .table<T>(this.tableName)
      .where('id', id)
      .update(updateData)
      .returning(options.returning || '*');

    return result || null;
  }

  /**
   * Update records by criteria
   */
  async updateWhere(
    where: Record<string, any>,
    data: Partial<Omit<T, 'id' | 'tenant_id' | 'created_at'>>,
    options: UpdateOptions = {}
  ): Promise<T[]> {
    const updateData = {
      ...data,
      updated_at: new Date(),
    };

    return this.tenantQuery
      .table<T>(this.tableName)
      .where(where)
      .update(updateData)
      .returning(options.returning || '*');
  }

  /**
   * Delete record by ID
   */
  async deleteById(id: string): Promise<boolean> {
    const deleted = await this.tenantQuery
      .table(this.tableName)
      .where('id', id)
      .del();

    return deleted > 0;
  }

  /**
   * Delete records by criteria
   */
  async deleteWhere(where: Record<string, any>): Promise<number> {
    return this.tenantQuery
      .table(this.tableName)
      .where(where)
      .del();
  }

  /**
   * Soft delete (requires deleted_at column)
   */
  async softDeleteById(id: string): Promise<T | null> {
    return this.updateById(id, { deleted_at: new Date() } as any);
  }

  /**
   * Upsert (insert or update)
   */
  async upsert(
    data: Omit<T, 'created_at' | 'updated_at'>,
    conflictColumns: string[] = ['id']
  ): Promise<T> {
    const insertData = {
      ...data,
      tenant_id: this.tenantQuery.getTenantId(),
      created_at: new Date(),
      updated_at: new Date(),
    };

    const updateData = {
      ...data,
      updated_at: new Date(),
    };

    const [result] = await this.tenantQuery
      .table<T>(this.tableName)
      .insert(insertData)
      .onConflict(conflictColumns)
      .merge(updateData)
      .returning('*');

    return result;
  }

  /**
   * Paginate results
   */
  async paginate(
    page: number = 1,
    pageSize: number = 10,
    options: Omit<FindOptions, 'limit' | 'offset'> = {}
  ): Promise<{
    data: T[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  }> {
    const offset = (page - 1) * pageSize;
    const total = await this.count(options.where);
    const data = await this.findAll({
      ...options,
      limit: pageSize,
      offset,
    });

    return {
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * Execute raw query within tenant context
   */
  async raw<T = any>(sql: string, bindings?: any[]): Promise<T> {
    const result = await this.tenantQuery.raw(sql, bindings);
    return result.rows || result;
  }

  /**
   * Generate unique ID
   */
  protected generateId(): string {
    // You can use uuid v4, nanoid, or other ID generation methods
    return require('crypto').randomUUID();
  }

  /**
   * Get table name
   */
  getTableName(): string {
    return this.tableName;
  }

  /**
   * Get tenant ID
   */
  getTenantId(): string {
    return this.tenantQuery.getTenantId();
  }
}
```

### 2. Specific Repository Example

```typescript
// libs/modules/user/user-repository.ts
import { Injectable } from '@nestjs/common';
import { BaseTenantRepository } from '../../core/database/base-tenant-repository';
import { TenantQueryBuilder } from '../../core/database/tenant-query-builder';

export interface User {
  id: string;
  tenant_id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  status: 'active' | 'inactive' | 'suspended';
  last_login_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserData {
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  status?: 'active' | 'inactive';
}

@Injectable()
export class UserRepository extends BaseTenantRepository<User> {
  constructor(tenantQuery: TenantQueryBuilder) {
    super('users', tenantQuery);
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.findOne({ email });
  }

  /**
   * Find active users
   */
  async findActiveUsers(limit?: number): Promise<User[]> {
    return this.findAll({
      where: { status: 'active' },
      orderBy: 'created_at',
      orderDirection: 'desc',
      limit,
    });
  }

  /**
   * Update last login
   */
  async updateLastLogin(userId: string): Promise<User | null> {
    return this.updateById(userId, {
      last_login_at: new Date(),
    });
  }

  /**
   * Search users by name or email
   */
  async searchUsers(query: string, limit: number = 10): Promise<User[]> {
    return this.tenantQuery
      .table<User>(this.tableName)
      .where('first_name', 'ilike', `%${query}%`)
      .orWhere('last_name', 'ilike', `%${query}%`)
      .orWhere('email', 'ilike', `%${query}%`)
      .limit(limit)
      .select('*');
  }

  /**
   * Get user stats
   */
  async getUserStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    suspended: number;
  }> {
    const [total, active, inactive, suspended] = await Promise.all([
      this.count(),
      this.count({ status: 'active' }),
      this.count({ status: 'inactive' }),
      this.count({ status: 'suspended' }),
    ]);

    return { total, active, inactive, suspended };
  }

  /**
   * Create user with validation
   */
  async createUser(userData: CreateUserData): Promise<User> {
    // Check if email already exists
    const existingUser = await this.findByEmail(userData.email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    return this.create({
      ...userData,
      status: userData.status || 'active',
    });
  }
}
```

## Service Layer

### 1. Base Tenant Service

```typescript
// libs/core/tenant/base-tenant-service.ts
import { Injectable } from '@nestjs/common';
import { TenantQueryFactory } from '../database/tenant-query-factory';
import { TenantContext } from './types';

@Injectable()
export abstract class BaseTenantService {
  constructor(
    protected queryFactory: TenantQueryFactory,
    protected tenant: TenantContext
  ) {}

  protected getTenantQuery() {
    return this.queryFactory.createTenantQuery(this.tenant);
  }

  protected getAdminQuery() {
    return this.queryFactory.createAdminQuery();
  }

  protected getTenant(): TenantContext {
    return this.tenant;
  }
}
```

### 2. User Service Example

```typescript
// libs/modules/user/user-service.ts
import { Injectable } from '@nestjs/common';
import { BaseTenantService } from '../../core/tenant/base-tenant-service';
import { UserRepository, CreateUserData, User } from './user-repository';
import { TenantQueryFactory } from '../../core/database/tenant-query-factory';
import { TenantContext } from '../../core/tenant/types';

@Injectable()
export class UserService extends BaseTenantService {
  private userRepository: UserRepository;

  constructor(
    queryFactory: TenantQueryFactory,
    tenant: TenantContext
  ) {
    super(queryFactory, tenant);
    this.userRepository = new UserRepository(this.getTenantQuery());
  }

  async createUser(userData: CreateUserData): Promise<User> {
    // Check tenant limits
    const userCount = await this.userRepository.count();
    const maxUsers = this.tenant.config.limits.maxUsers;

    if (userCount >= maxUsers) {
      throw new Error(`User limit exceeded. Maximum ${maxUsers} users allowed.`);
    }

    // Hash password
    const passwordHash = await this.hashPassword(userData.password_hash);

    return this.userRepository.createUser({
      ...userData,
      password_hash: passwordHash,
    });
  }

  async getUserById(id: string): Promise<User | null> {
    return this.userRepository.findById(id);
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return this.userRepository.findByEmail(email);
  }

  async getActiveUsers(limit?: number): Promise<User[]> {
    return this.userRepository.findActiveUsers(limit);
  }

  async searchUsers(query: string, limit?: number): Promise<User[]> {
    return this.userRepository.searchUsers(query, limit);
  }

  async updateUser(id: string, data: Partial<CreateUserData>): Promise<User | null> {
    if (data.password_hash) {
      data.password_hash = await this.hashPassword(data.password_hash);
    }

    return this.userRepository.updateById(id, data);
  }

  async deleteUser(id: string): Promise<boolean> {
    return this.userRepository.deleteById(id);
  }

  async getUsersPaginated(page: number = 1, pageSize: number = 10) {
    return this.userRepository.paginate(page, pageSize, {
      orderBy: 'created_at',
      orderDirection: 'desc',
    });
  }

  async getUserStats() {
    return this.userRepository.getUserStats();
  }

  private async hashPassword(password: string): Promise<string> {
    // Implement password hashing
    const bcrypt = require('bcrypt');
    return bcrypt.hash(password, 10);
  }
}
```

## CRUD Operations

### 1. Controller with Tenant Context

```typescript
// apps/api/src/modules/user/user-controller.ts
import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req } from '@nestjs/common';
import { UserService } from '../../../../libs/modules/user/user-service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

interface TenantRequest extends Request {
  tenant: TenantContext;
}

@ApiTags('users')
@Controller('users')
export class UserController {
  constructor(private userService: UserService) {}

  @Get()
  @ApiOperation({ summary: 'Get all users' })
  async getUsers(
    @Query('page') page: number = 1,
    @Query('pageSize') pageSize: number = 10,
    @Query('search') search?: string,
    @Req() req: TenantRequest
  ) {
    // Service is automatically scoped to tenant from middleware
    if (search) {
      return this.userService.searchUsers(search);
    }

    return this.userService.getUsersPaginated(page, pageSize);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get user statistics' })
  async getUserStats() {
    return this.userService.getUserStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  async getUserById(@Param('id') id: string) {
    const user = await this.userService.getUserById(id);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  @Post()
  @ApiOperation({ summary: 'Create new user' })
  async createUser(@Body() userData: CreateUserData) {
    return this.userService.createUser(userData);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update user' })
  async updateUser(
    @Param('id') id: string,
    @Body() userData: Partial<CreateUserData>
  ) {
    const user = await this.userService.updateUser(id, userData);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete user' })
  async deleteUser(@Param('id') id: string) {
    const deleted = await this.userService.deleteUser(id);
    if (!deleted) {
      throw new Error('User not found');
    }
    return { success: true };
  }
}
```

### 2. Dependency Injection Setup

```typescript
// apps/api/src/modules/user/user-module.ts
import { Module } from '@nestjs/common';
import { UserController } from './user-controller';
import { UserService } from '../../../../libs/modules/user/user-service';
import { TenantQueryFactory } from '../../../../libs/core/database/tenant-query-factory';

@Module({
  controllers: [UserController],
  providers: [
    {
      provide: UserService,
      useFactory: (queryFactory: TenantQueryFactory, tenant: TenantContext) => {
        return new UserService(queryFactory, tenant);
      },
      inject: [TenantQueryFactory, 'TENANT_CONTEXT'],
    },
  ],
})
export class UserModule {}
```

## Advanced Patterns

### 1. Tenant-Aware Middleware

```typescript
// apps/api/src/middleware/tenant-middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantService } from '../../../libs/modules/tenant/tenant-service';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private tenantService: TenantService) {}

  async use(req: Request & { tenant?: TenantContext }, res: Response, next: NextFunction) {
    try {
      const tenantId = this.extractTenantId(req);
      
      if (tenantId) {
        const tenant = await this.tenantService.findById(tenantId);
        if (tenant && tenant.status === 'active') {
          req.tenant = tenant;
        }
      }
      
      next();
    } catch (error) {
      next(error);
    }
  }

  private extractTenantId(req: Request): string | null {
    // Extract from subdomain
    const host = req.get('host');
    if (host) {
      const subdomain = host.split('.')[0];
      if (subdomain !== 'www' && subdomain !== 'api') {
        return subdomain;
      }
    }

    // Extract from header
    const tenantHeader = req.get('X-Tenant-ID');
    if (tenantHeader) {
      return tenantHeader;
    }

    return null;
  }
}
```

### 2. Tenant-Scoped Module

```typescript
// libs/core/tenant/tenant-scoped-module.ts
import { Module, DynamicModule, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { TenantQueryFactory } from '../database/tenant-query-factory';

@Module({})
export class TenantScopedModule {
  static forFeature(providers: any[]): DynamicModule {
    return {
      module: TenantScopedModule,
      providers: [
        ...providers,
        {
          provide: 'TENANT_CONTEXT',
          useFactory: (req: any) => req.tenant,
          inject: [REQUEST],
          scope: Scope.REQUEST,
        },
      ],
      exports: providers,
    };
  }
}
```

## Testing

### 1. Repository Testing

```typescript
// libs/modules/user/user-repository.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { UserRepository } from './user-repository';
import { TenantQueryBuilder } from '../../core/database/tenant-query-builder';
import { createTestTenant, createTestKnex } from '../../core/testing/test-helpers';

describe('UserRepository', () => {
  let repository: UserRepository;
  let tenantQuery: TenantQueryBuilder;
  let knex: any;

  beforeEach(async () => {
    knex = createTestKnex();
    const tenant = createTestTenant();
    tenantQuery = new TenantQueryBuilder(knex, tenant);
    repository = new UserRepository(tenantQuery);
  });

  afterEach(async () => {
    await knex.destroy();
  });

  describe('createUser', () => {
    it('should create a user with tenant_id', async () => {
      const userData = {
        email: 'test@example.com',
        password_hash: 'hashed',
        first_name: 'John',
        last_name: 'Doe',
      };

      knex.mock.expects('insert').resolves([{ id: '123', ...userData, tenant_id: 'tenant-1' }]);

      const user = await repository.createUser(userData);

      expect(user.tenant_id).toBe('tenant-1');
      expect(user.email).toBe(userData.email);
    });
  });

  describe('findByEmail', () => {
    it('should find user by email within tenant', async () => {
      const user = { id: '123', email: 'test@example.com', tenant_id: 'tenant-1' };
      
      knex.mock.expects('where').twice().returnsThis();
      knex.mock.expects('first').resolves(user);

      const result = await repository.findByEmail('test@example.com');

      expect(result).toEqual(user);
    });
  });
});
```

### 2. Service Testing

```typescript
// libs/modules/user/user-service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user-service';
import { TenantQueryFactory } from '../../core/database/tenant-query-factory';
import { createTestTenant } from '../../core/testing/test-helpers';

describe('UserService', () => {
  let service: UserService;
  let mockQueryFactory: jest.Mocked<TenantQueryFactory>;

  beforeEach(async () => {
    mockQueryFactory = {
      createTenantQuery: jest.fn(),
      createAdminQuery: jest.fn(),
    } as any;

    const tenant = createTestTenant();
    service = new UserService(mockQueryFactory, tenant);
  });

  describe('createUser', () => {
    it('should enforce tenant user limits', async () => {
      // Mock repository to return count at limit
      const mockRepo = {
        count: jest.fn().mockResolvedValue(100), // At limit
      };

      mockQueryFactory.createTenantQuery.mockReturnValue({
        getTenantQuery: () => mockRepo,
      } as any);

      const userData = {
        email: 'test@example.com',
        password_hash: 'password',
        first_name: 'John',
        last_name: 'Doe',
      };

      await expect(service.createUser(userData))
        .rejects
        .toThrow('User limit exceeded');
    });
  });
});
```

## Best Practices

### 1. Safety Rules

```typescript
// Never do this - bypasses tenant isolation
const users = await knex('users').select('*'); // ❌ DANGEROUS!

// Always use tenant query builder
const users = await tenantQuery.table('users').select('*'); // ✅ SAFE

// Use repository pattern for consistency
const users = await userRepository.findAll(); // ✅ RECOMMENDED
```

### 2. Error Handling

```typescript
// libs/core/tenant/tenant-error-handler.ts
export class TenantError extends Error {
  constructor(
    message: string,
    public tenantId?: string,
    public code?: string
  ) {
    super(message);
    this.name = 'TenantError';
  }
}

export class TenantNotFoundError extends TenantError {
  constructor(tenantId: string) {
    super(`Tenant ${tenantId} not found`, tenantId, 'TENANT_NOT_FOUND');
  }
}

export class TenantLimitExceededError extends TenantError {
  constructor(tenantId: string, resource: string, limit: number) {
    super(`${resource} limit exceeded (${limit})`, tenantId, 'LIMIT_EXCEEDED');
  }
}
```

### 3. Performance Optimization

```typescript
// Connection pooling per tenant
class TenantConnectionPool {
  private pools = new Map<string, Knex>();

  getConnection(tenant: TenantContext): Knex {
    if (!this.pools.has(tenant.id)) {
      this.pools.set(tenant.id, this.createConnection(tenant));
    }
    return this.pools.get(tenant.id)!;
  }

  // Cleanup idle connections
  async cleanupIdleConnections(): Promise<void> {
    // Implementation
  }
}
```

### 4. Monitoring and Logging

```typescript
// libs/core/tenant/tenant-logger.ts
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class TenantLogger extends Logger {
  constructor(private tenantId: string) {
    super();
  }

  log(message: string, context?: string) {
    super.log(`[Tenant: ${this.tenantId}] ${message}`, context);
  }

  error(message: string, trace?: string, context?: string) {
    super.error(`[Tenant: ${this.tenantId}] ${message}`, trace, context);
  }

  warn(message: string, context?: string) {
    super.warn(`[Tenant: ${this.tenantId}] ${message}`, context);
  }
}
```

## Conclusion

This Knex.js Multi-Tenancy blueprint provides:

- **Type-Safe Operations** - Full TypeScript support with proper typing
- **Automatic Tenant Isolation** - No manual tenant_id management required
- **Flexible Architecture** - Supports all tenancy strategies
- **Easy CRUD** - Simple repository pattern with built-in operations
- **Safety First** - Prevents accidental cross-tenant access
- **Performance Optimized** - Connection pooling and query optimization
- **Testing Ready** - Comprehensive test examples and helpers

Start with the shared database strategy for simplicity, then migrate to schema or database per tenant as your application scales.
