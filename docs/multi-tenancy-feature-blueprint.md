# Multi-Tenancy Feature Blueprint

This document provides a comprehensive blueprint for implementing multi-tenancy as a feature in the AegisX Platform. It includes architectural patterns, implementation steps, code templates, and best practices.

## Table of Contents

- [Feature Overview](#feature-overview)
- [Architecture Patterns](#architecture-patterns)
- [Implementation Strategy](#implementation-strategy)
- [Implementation Strategy](#implementation-strategy)
- [Security Implementation](#security-implementation)
- [Security Implementation](#security-implementation)
- [Configuration Management](#configuration-management)
- [Testing Strategy](#testing-strategy)
- [Migration Guide](#migration-guide)
- [Monitoring & Metrics](#monitoring--metrics)

## Feature Overview

### What is Multi-Tenancy?

Multi-tenancy is an architecture pattern where a single instance of the application serves multiple tenants (customers/organizations) while keeping their data and configurations isolated.

### Business Benefits

- **Cost Efficiency**: Shared infrastructure reduces operational costs
- **Scalability**: Easier to scale and maintain a single application instance
- **Faster Deployment**: New tenants can be onboarded without new deployments
- **Centralized Updates**: Features and bug fixes are deployed to all tenants simultaneously

### Technical Benefits

- **Resource Optimization**: Better utilization of server resources
- **Maintenance**: Single codebase to maintain and update
- **Monitoring**: Centralized logging and monitoring
- **Compliance**: Easier to implement security and compliance measures

## Architecture Patterns

### 1. Database Per Tenant (Highest Isolation)

```text
┌─────────────────┐    ┌─────────────┐
│   Application   │    │   Tenant A  │
│     Server      │────│  Database   │
│                 │    └─────────────┘
│                 │    ┌─────────────┐
│                 │────│   Tenant B  │
└─────────────────┘    │  Database   │
                       └─────────────┘
```

**Pros**: Complete data isolation, easy backup/restore per tenant
**Cons**: Higher resource usage, complex maintenance

### 2. Schema Per Tenant (Medium Isolation)

```text
┌─────────────────┐    ┌─────────────┐
│   Application   │    │  Database   │
│     Server      │────│ ┌─────────┐ │
│                 │    │ │Schema_A │ │
│                 │    │ ├─────────┤ │
└─────────────────┘    │ │Schema_B │ │
                       │ └─────────┘ │
                       └─────────────┘
```

**Pros**: Good isolation, shared infrastructure
**Cons**: Schema management complexity

### 3. Shared Database with Row-Level Security (Lowest Isolation)

```text
┌─────────────────┐    ┌─────────────┐
│   Application   │    │  Database   │
│     Server      │────│ ┌─────────┐ │
│                 │    │ │ Table   │ │
│                 │    │ │tenant_id│ │
└─────────────────┘    │ └─────────┘ │
                       └─────────────┘
```

**Pros**: Resource efficient, simple deployment
**Cons**: Risk of data leakage, complex queries

## Implementation Strategy

### Phase 1: Foundation Setup

#### 1.1 Tenant Management System

```typescript
// src/features/tenancy/types/tenant.types.ts
export interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  status: TenantStatus;
  plan: TenantPlan;
  settings: TenantSettings;
  createdAt: Date;
  updatedAt: Date;
}

export enum TenantStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  PENDING = 'pending',
  DELETED = 'deleted'
}

export enum TenantPlan {
  BASIC = 'basic',
  PRO = 'pro',
  ENTERPRISE = 'enterprise'
}

export interface TenantSettings {
  maxUsers: number;
  storageLimit: number; // in MB
  features: string[];
  customDomain?: string;
  branding?: TenantBranding;
}

export interface TenantBranding {
  logo?: string;
  primaryColor?: string;
  secondaryColor?: string;
  favicon?: string;
}
```

#### 1.2 Tenant Context Middleware

```typescript
// src/features/tenancy/middleware/tenant-context.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantService } from '../services/tenant.service';

export interface TenantRequest extends Request {
  tenant?: Tenant;
  tenantId?: string;
}

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(private readonly tenantService: TenantService) {}

  async use(req: TenantRequest, res: Response, next: NextFunction) {
    try {
      const tenantId = this.extractTenantId(req);
      
      if (tenantId) {
        const tenant = await this.tenantService.findById(tenantId);
        if (tenant && tenant.status === TenantStatus.ACTIVE) {
          req.tenant = tenant;
          req.tenantId = tenantId;
        }
      }
      
      next();
    } catch (error) {
      next(error);
    }
  }

  private extractTenantId(req: Request): string | null {
    // Method 1: Subdomain extraction
    const host = req.get('host');
    if (host) {
      const subdomain = host.split('.')[0];
      if (subdomain !== 'www' && subdomain !== 'api') {
        return subdomain;
      }
    }

    // Method 2: Header-based
    const tenantHeader = req.get('X-Tenant-ID');
    if (tenantHeader) {
      return tenantHeader;
    }

    // Method 3: Path-based
    const pathMatch = req.path.match(/^\/tenants\/([^\/]+)/);
    if (pathMatch) {
      return pathMatch[1];
    }

    return null;
  }
}
```

### Phase 2: Database Layer Implementation

#### 2.1 Database Connection Manager

```typescript
// src/features/tenancy/services/database-connection.service.ts
import { Injectable } from '@nestjs/common';
import { Connection, createConnection, getConnection } from 'typeorm';
import { Tenant } from '../types/tenant.types';

@Injectable()
export class DatabaseConnectionService {
  private connections = new Map<string, Connection>();

  async getTenantConnection(tenant: Tenant): Promise<Connection> {
    const connectionName = `tenant_${tenant.id}`;
    
    if (this.connections.has(connectionName)) {
      return this.connections.get(connectionName)!;
    }

    const connection = await this.createTenantConnection(tenant);
    this.connections.set(connectionName, connection);
    
    return connection;
  }

  private async createTenantConnection(tenant: Tenant): Promise<Connection> {
    const config = this.getTenantDatabaseConfig(tenant);
    
    return createConnection({
      name: `tenant_${tenant.id}`,
      type: 'postgres',
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      database: config.database,
      entities: ['src/**/*.entity{.ts,.js}'],
      synchronize: false,
      migrations: ['src/migrations/**/*{.ts,.js}'],
      migrationsRun: true,
    });
  }

  private getTenantDatabaseConfig(tenant: Tenant) {
    // Strategy 1: Database per tenant
    if (process.env.TENANCY_STRATEGY === 'database_per_tenant') {
      return {
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '5432'),
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: `tenant_${tenant.id}`,
      };
    }

    // Strategy 2: Schema per tenant
    if (process.env.TENANCY_STRATEGY === 'schema_per_tenant') {
      return {
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '5432'),
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        schema: `tenant_${tenant.id}`,
      };
    }

    // Default: Shared database
    return {
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    };
  }
}
```

#### 2.2 Tenant-Aware Repository Base

```typescript
// src/features/tenancy/repositories/tenant-aware.repository.ts
import { Repository, EntityManager } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { TenantRequest } from '../middleware/tenant-context.middleware';

@Injectable()
export abstract class TenantAwareRepository<T> {
  constructor(
    protected readonly repository: Repository<T>,
    protected readonly entityManager: EntityManager,
  ) {}

  protected addTenantFilter(req: TenantRequest, queryBuilder: any) {
    if (req.tenantId && process.env.TENANCY_STRATEGY === 'shared_database') {
      queryBuilder.andWhere('tenantId = :tenantId', { tenantId: req.tenantId });
    }
    return queryBuilder;
  }

  async findByTenant(req: TenantRequest, options: any = {}) {
    const queryBuilder = this.repository.createQueryBuilder('entity');
    this.addTenantFilter(req, queryBuilder);
    
    if (options.where) {
      queryBuilder.andWhere(options.where);
    }
    
    return queryBuilder.getMany();
  }

  async createForTenant(req: TenantRequest, data: Partial<T>) {
    if (process.env.TENANCY_STRATEGY === 'shared_database') {
      (data as any).tenantId = req.tenantId;
    }
    
    return this.repository.save(data as any);
  }
}
```

### Phase 3: Service Layer Implementation

#### 3.1 Tenant Service

```typescript
// src/features/tenancy/services/tenant.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../entities/tenant.entity';
import { CreateTenantDto, UpdateTenantDto } from '../dto/tenant.dto';
import { DatabaseConnectionService } from './database-connection.service';

@Injectable()
export class TenantService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    private readonly dbConnectionService: DatabaseConnectionService,
  ) {}

  async create(createTenantDto: CreateTenantDto): Promise<Tenant> {
    const tenant = this.tenantRepository.create(createTenantDto);
    const savedTenant = await this.tenantRepository.save(tenant);
    
    // Initialize tenant database/schema
    await this.initializeTenantDatabase(savedTenant);
    
    return savedTenant;
  }

  async findById(id: string): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({ 
      where: { id },
      relations: ['users', 'subscriptions'] 
    });
    
    if (!tenant) {
      throw new NotFoundException(`Tenant with ID ${id} not found`);
    }
    
    return tenant;
  }

  async findBySubdomain(subdomain: string): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({ 
      where: { subdomain } 
    });
    
    if (!tenant) {
      throw new NotFoundException(`Tenant with subdomain ${subdomain} not found`);
    }
    
    return tenant;
  }

  async update(id: string, updateTenantDto: UpdateTenantDto): Promise<Tenant> {
    const tenant = await this.findById(id);
    Object.assign(tenant, updateTenantDto);
    return this.tenantRepository.save(tenant);
  }

  async suspend(id: string): Promise<Tenant> {
    const tenant = await this.findById(id);
    tenant.status = TenantStatus.SUSPENDED;
    return this.tenantRepository.save(tenant);
  }

  async activate(id: string): Promise<Tenant> {
    const tenant = await this.findById(id);
    tenant.status = TenantStatus.ACTIVE;
    return this.tenantRepository.save(tenant);
  }

  private async initializeTenantDatabase(tenant: Tenant): Promise<void> {
    try {
      const connection = await this.dbConnectionService.getTenantConnection(tenant);
      await connection.runMigrations();
      
      // Seed initial data if needed
      await this.seedTenantData(tenant);
    } catch (error) {
      throw new Error(`Failed to initialize tenant database: ${error.message}`);
    }
  }

  private async seedTenantData(tenant: Tenant): Promise<void> {
    // Add any initial data seeding logic here
    // For example: default roles, settings, etc.
  }
}
```

#### 3.2 Tenant-Aware Service Base

```typescript
// src/features/tenancy/services/tenant-aware.service.ts
import { Injectable } from '@nestjs/common';
import { TenantRequest } from '../middleware/tenant-context.middleware';
import { DatabaseConnectionService } from './database-connection.service';

@Injectable()
export abstract class TenantAwareService {
  constructor(
    protected readonly dbConnectionService: DatabaseConnectionService,
  ) {}

  protected async getRepository<T>(req: TenantRequest, entityClass: any) {
    const connection = await this.dbConnectionService.getTenantConnection(req.tenant!);
    return connection.getRepository(entityClass);
  }

  protected validateTenantAccess(req: TenantRequest): void {
    if (!req.tenant || !req.tenantId) {
      throw new Error('Tenant context not found');
    }
  }
}
```

### Phase 4: API Layer Implementation

#### 4.1 Tenant Controller

```typescript
// src/features/tenancy/controllers/tenant.controller.ts
import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Body, 
  Param, 
  UseGuards,
  Req 
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TenantService } from '../services/tenant.service';
import { CreateTenantDto, UpdateTenantDto } from '../dto/tenant.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { TenantRequest } from '../middleware/tenant-context.middleware';

@ApiTags('tenants')
@Controller('tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Post()
  @Roles('super-admin')
  @ApiOperation({ summary: 'Create a new tenant' })
  @ApiResponse({ status: 201, description: 'Tenant created successfully' })
  async create(@Body() createTenantDto: CreateTenantDto) {
    return this.tenantService.create(createTenantDto);
  }

  @Get(':id')
  @Roles('super-admin', 'tenant-admin')
  @ApiOperation({ summary: 'Get tenant by ID' })
  async findById(@Param('id') id: string) {
    return this.tenantService.findById(id);
  }

  @Get()
  @Roles('super-admin')
  @ApiOperation({ summary: 'Get all tenants' })
  async findAll() {
    return this.tenantService.findAll();
  }

  @Put(':id')
  @Roles('super-admin', 'tenant-admin')
  @ApiOperation({ summary: 'Update tenant' })
  async update(
    @Param('id') id: string,
    @Body() updateTenantDto: UpdateTenantDto,
    @Req() req: TenantRequest,
  ) {
    // Ensure tenant admins can only update their own tenant
    if (req.user.role === 'tenant-admin' && req.tenantId !== id) {
      throw new ForbiddenException('Cannot update other tenant');
    }
    
    return this.tenantService.update(id, updateTenantDto);
  }

  @Put(':id/suspend')
  @Roles('super-admin')
  @ApiOperation({ summary: 'Suspend tenant' })
  async suspend(@Param('id') id: string) {
    return this.tenantService.suspend(id);
  }

  @Put(':id/activate')
  @Roles('super-admin')
  @ApiOperation({ summary: 'Activate tenant' })
  async activate(@Param('id') id: string) {
    return this.tenantService.activate(id);
  }
}
```

#### 4.2 Tenant-Aware Controller Base

```typescript
// src/features/tenancy/controllers/tenant-aware.controller.ts
import { Controller, UseGuards, Req } from '@nestjs/common';
import { TenantRequest } from '../middleware/tenant-context.middleware';
import { TenantGuard } from '../guards/tenant.guard';

@UseGuards(TenantGuard)
export abstract class TenantAwareController {
  protected getTenantId(req: TenantRequest): string {
    if (!req.tenantId) {
      throw new Error('Tenant context not found');
    }
    return req.tenantId;
  }

  protected getTenant(req: TenantRequest) {
    if (!req.tenant) {
      throw new Error('Tenant context not found');
    }
    return req.tenant;
  }
}
```

### Phase 5: Frontend Integration

#### 5.1 Tenant Context Provider (React)

```typescript
// src/contexts/TenantContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Tenant } from '../types/tenant.types';
import { tenantService } from '../services/tenant.service';

interface TenantContextValue {
  tenant: Tenant | null;
  isLoading: boolean;
  error: string | null;
  switchTenant: (tenantId: string) => Promise<void>;
}

const TenantContext = createContext<TenantContextValue | undefined>(undefined);

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ 
  children 
}) => {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initializeTenant();
  }, []);

  const initializeTenant = async () => {
    try {
      setIsLoading(true);
      const currentTenant = await tenantService.getCurrentTenant();
      setTenant(currentTenant);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const switchTenant = async (tenantId: string) => {
    try {
      setIsLoading(true);
      const newTenant = await tenantService.switchTenant(tenantId);
      setTenant(newTenant);
      // Reload the page to apply tenant-specific settings
      window.location.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <TenantContext.Provider 
      value={{ tenant, isLoading, error, switchTenant }}
    >
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
};
```

#### 5.2 Tenant-Aware HTTP Client

```typescript
// src/services/tenant-http.service.ts
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

class TenantHttpService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.REACT_APP_API_URL,
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor to add tenant context
    this.client.interceptors.request.use((config) => {
      const tenantId = this.getCurrentTenantId();
      
      if (tenantId) {
        // Add tenant ID to headers
        config.headers['X-Tenant-ID'] = tenantId;
        
        // Or add to subdomain
        if (config.url && !config.url.startsWith('http')) {
          const baseURL = `https://${tenantId}.${process.env.REACT_APP_DOMAIN}`;
          config.baseURL = baseURL;
        }
      }

      return config;
    });

    // Response interceptor for tenant-specific error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 403 && 
            error.response?.data?.code === 'TENANT_ACCESS_DENIED') {
          // Handle tenant access issues
          this.handleTenantAccessError();
        }
        return Promise.reject(error);
      }
    );
  }

  private getCurrentTenantId(): string | null {
    // Get from localStorage, context, or URL
    return localStorage.getItem('tenantId') || 
           this.extractTenantFromUrl();
  }

  private extractTenantFromUrl(): string | null {
    const subdomain = window.location.hostname.split('.')[0];
    return subdomain !== 'www' ? subdomain : null;
  }

  private handleTenantAccessError() {
    // Redirect to tenant selection or login
    window.location.href = '/tenant-selection';
  }

  // Public methods
  get(url: string, config?: AxiosRequestConfig) {
    return this.client.get(url, config);
  }

  post(url: string, data?: any, config?: AxiosRequestConfig) {
    return this.client.post(url, data, config);
  }

  put(url: string, data?: any, config?: AxiosRequestConfig) {
    return this.client.put(url, data, config);
  }

  delete(url: string, config?: AxiosRequestConfig) {
    return this.client.delete(url, config);
  }
}

export const tenantHttpService = new TenantHttpService();
```

## Security Implementation

### 1. Tenant Isolation Security

```typescript
// src/features/tenancy/guards/tenant.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { TenantRequest } from '../middleware/tenant-context.middleware';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<TenantRequest>();
    
    // Ensure tenant context exists
    if (!request.tenant || !request.tenantId) {
      throw new ForbiddenException('Tenant context required');
    }

    // Verify user has access to this tenant
    if (request.user && request.user.tenantId !== request.tenantId) {
      throw new ForbiddenException('Access to this tenant is not allowed');
    }

    return true;
  }
}
```

### 2. Data Encryption per Tenant

```typescript
// src/features/tenancy/services/tenant-encryption.service.ts
import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class TenantEncryptionService {
  private getEncryptionKey(tenantId: string): string {
    const baseKey = process.env.ENCRYPTION_SECRET;
    return crypto.pbkdf2Sync(tenantId, baseKey, 10000, 32, 'sha512').toString('hex');
  }

  encrypt(data: string, tenantId: string): string {
    const key = this.getEncryptionKey(tenantId);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-cbc', key);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  }

  decrypt(encryptedData: string, tenantId: string): string {
    const key = this.getEncryptionKey(tenantId);
    const [ivHex, encrypted] = encryptedData.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    
    const decipher = crypto.createDecipher('aes-256-cbc', key);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}
```

## Configuration Management

### 1. Environment Configuration

```typescript
// src/features/tenancy/config/tenancy.config.ts
export interface TenancyConfig {
  strategy: 'database_per_tenant' | 'schema_per_tenant' | 'shared_database';
  identification: 'subdomain' | 'header' | 'path';
  defaultTenant?: string;
  tenantCacheEnabled: boolean;
  tenantCacheTtl: number;
}

export const tenancyConfig = (): TenancyConfig => ({
  strategy: process.env.TENANCY_STRATEGY as any || 'shared_database',
  identification: process.env.TENANCY_IDENTIFICATION as any || 'subdomain',
  defaultTenant: process.env.DEFAULT_TENANT,
  tenantCacheEnabled: process.env.TENANT_CACHE_ENABLED === 'true',
  tenantCacheTtl: parseInt(process.env.TENANT_CACHE_TTL || '3600'),
});
```

### 2. Tenant-Specific Configuration

```typescript
// src/features/tenancy/services/tenant-config.service.ts
import { Injectable } from '@nestjs/common';
import { TenantRequest } from '../middleware/tenant-context.middleware';

@Injectable()
export class TenantConfigService {
  private configCache = new Map<string, any>();

  async getConfig<T>(req: TenantRequest, key: string, defaultValue?: T): Promise<T> {
    const cacheKey = `${req.tenantId}:${key}`;
    
    if (this.configCache.has(cacheKey)) {
      return this.configCache.get(cacheKey);
    }

    const config = await this.fetchTenantConfig(req.tenantId!, key);
    const value = config || defaultValue;
    
    this.configCache.set(cacheKey, value);
    
    return value;
  }

  async setConfig(req: TenantRequest, key: string, value: any): Promise<void> {
    await this.saveTenantConfig(req.tenantId!, key, value);
    
    const cacheKey = `${req.tenantId}:${key}`;
    this.configCache.set(cacheKey, value);
  }

  private async fetchTenantConfig(tenantId: string, key: string): Promise<any> {
    // Implementation depends on your storage strategy
    // Could be database, Redis, or file-based
  }

  private async saveTenantConfig(tenantId: string, key: string, value: any): Promise<void> {
    // Implementation depends on your storage strategy
  }
}
```

## Testing Strategy

### 1. Unit Tests for Multi-Tenancy

```typescript
// src/features/tenancy/tests/tenant.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { TenantService } from '../services/tenant.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Tenant } from '../entities/tenant.entity';

describe('TenantService', () => {
  let service: TenantService;
  let mockRepository: any;

  beforeEach(async () => {
    mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantService,
        {
          provide: getRepositoryToken(Tenant),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<TenantService>(TenantService);
  });

  describe('create', () => {
    it('should create a new tenant', async () => {
      const createTenantDto = {
        name: 'Test Tenant',
        subdomain: 'test',
        plan: 'basic',
      };

      const tenant = { id: '1', ...createTenantDto };
      mockRepository.create.mockReturnValue(tenant);
      mockRepository.save.mockResolvedValue(tenant);

      const result = await service.create(createTenantDto);

      expect(mockRepository.create).toHaveBeenCalledWith(createTenantDto);
      expect(mockRepository.save).toHaveBeenCalledWith(tenant);
      expect(result).toEqual(tenant);
    });
  });

  describe('findBySubdomain', () => {
    it('should find tenant by subdomain', async () => {
      const tenant = { id: '1', subdomain: 'test' };
      mockRepository.findOne.mockResolvedValue(tenant);

      const result = await service.findBySubdomain('test');

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { subdomain: 'test' }
      });
      expect(result).toEqual(tenant);
    });

    it('should throw NotFoundException if tenant not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findBySubdomain('nonexistent'))
        .rejects.toThrow('Tenant with subdomain nonexistent not found');
    });
  });
});
```

### 2. Integration Tests

```typescript
// src/features/tenancy/tests/tenant-integration.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../../app.module';

describe('Tenant Integration', () => {
  let app: INestApplication;
  let tenantId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Tenant Creation Flow', () => {
    it('should create a new tenant', async () => {
      const createTenantDto = {
        name: 'Integration Test Tenant',
        subdomain: 'integration-test',
        plan: 'basic',
      };

      const response = await request(app.getHttpServer())
        .post('/tenants')
        .send(createTenantDto)
        .expect(201);

      expect(response.body).toMatchObject(createTenantDto);
      expect(response.body.id).toBeDefined();
      tenantId = response.body.id;
    });

    it('should access tenant via subdomain', async () => {
      const response = await request(app.getHttpServer())
        .get('/tenants/current')
        .set('Host', 'integration-test.example.com')
        .expect(200);

      expect(response.body.subdomain).toBe('integration-test');
    });

    it('should isolate tenant data', async () => {
      // Create data for tenant 1
      await request(app.getHttpServer())
        .post('/users')
        .set('Host', 'integration-test.example.com')
        .send({ name: 'Tenant 1 User', email: 'user1@test.com' })
        .expect(201);

      // Try to access from different tenant context
      const response = await request(app.getHttpServer())
        .get('/users')
        .set('Host', 'other-tenant.example.com')
        .expect(200);

      expect(response.body).toHaveLength(0); // Should not see tenant 1's data
    });
  });
});
```

## Migration Guide

### 1. Migrating Existing Single-Tenant App

```typescript
// migration/001-add-tenant-support.ts
import { MigrationInterface, QueryRunner, Table, Column } from 'typeorm';

export class AddTenantSupport1640000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create tenants table
    await queryRunner.createTable(
      new Table({
        name: 'tenants',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'subdomain',
            type: 'varchar',
            length: '100',
            isUnique: true,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['active', 'suspended', 'pending', 'deleted'],
            default: "'active'",
          },
          {
            name: 'plan',
            type: 'enum',
            enum: ['basic', 'pro', 'enterprise'],
            default: "'basic'",
          },
          {
            name: 'settings',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Add tenant_id to existing tables
    const existingTables = ['users', 'orders', 'products']; // Add your tables
    
    for (const tableName of existingTables) {
      await queryRunner.addColumn(
        tableName,
        new Column({
          name: 'tenant_id',
          type: 'uuid',
          isNullable: true, // Initially nullable for migration
        }),
      );

      // Add foreign key constraint
      await queryRunner.query(`
        ALTER TABLE ${tableName} 
        ADD CONSTRAINT fk_${tableName}_tenant 
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      `);
    }

    // Create default tenant for existing data
    await queryRunner.query(`
      INSERT INTO tenants (id, name, subdomain, status, plan) 
      VALUES (uuid_generate_v4(), 'Default Tenant', 'default', 'active', 'enterprise')
    `);

    // Update existing records with default tenant
    const defaultTenantId = await queryRunner.query(
      "SELECT id FROM tenants WHERE subdomain = 'default'"
    );
    
    for (const tableName of existingTables) {
      await queryRunner.query(`
        UPDATE ${tableName} 
        SET tenant_id = '${defaultTenantId[0].id}' 
        WHERE tenant_id IS NULL
      `);

      // Make tenant_id NOT NULL after migration
      await queryRunner.query(`
        ALTER TABLE ${tableName} 
        ALTER COLUMN tenant_id SET NOT NULL
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const existingTables = ['users', 'orders', 'products'];
    
    for (const tableName of existingTables) {
      await queryRunner.query(`
        ALTER TABLE ${tableName} 
        DROP CONSTRAINT fk_${tableName}_tenant
      `);
      
      await queryRunner.dropColumn(tableName, 'tenant_id');
    }
    
    await queryRunner.dropTable('tenants');
  }
}
```

### 2. Data Migration Script

```typescript
// scripts/migrate-to-multitenancy.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { TenantService } from '../src/features/tenancy/services/tenant.service';
import { DataSource } from 'typeorm';

async function migrateToMultiTenancy() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const tenantService = app.get(TenantService);
  const dataSource = app.get(DataSource);

  try {
    console.log('Starting multi-tenancy migration...');

    // Step 1: Create tenant for existing data
    const defaultTenant = await tenantService.create({
      name: 'Legacy Tenant',
      subdomain: 'legacy',
      plan: 'enterprise',
      status: 'active',
    });

    console.log(`Created default tenant: ${defaultTenant.id}`);

    // Step 2: Update all existing records
    const tables = ['users', 'orders', 'products'];
    
    for (const table of tables) {
      const result = await dataSource.query(`
        UPDATE ${table} 
        SET tenant_id = $1 
        WHERE tenant_id IS NULL
      `, [defaultTenant.id]);
      
      console.log(`Updated ${result.affectedRows} records in ${table}`);
    }

    console.log('Multi-tenancy migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await app.close();
  }
}

migrateToMultiTenancy()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

## Monitoring & Metrics

### 1. Tenant-Specific Metrics

```typescript
// src/features/tenancy/services/tenant-metrics.service.ts
import { Injectable } from '@nestjs/common';
import { PrometheusService } from '../../../shared/services/prometheus.service';

@Injectable()
export class TenantMetricsService {
  private readonly tenantRequestCounter;
  private readonly tenantDbConnections;
  private readonly tenantUserCount;

  constructor(private readonly prometheusService: PrometheusService) {
    this.tenantRequestCounter = this.prometheusService.createCounter({
      name: 'tenant_requests_total',
      help: 'Total number of requests per tenant',
      labelNames: ['tenant_id', 'method', 'status'],
    });

    this.tenantDbConnections = this.prometheusService.createGauge({
      name: 'tenant_db_connections',
      help: 'Number of database connections per tenant',
      labelNames: ['tenant_id'],
    });

    this.tenantUserCount = this.prometheusService.createGauge({
      name: 'tenant_active_users',
      help: 'Number of active users per tenant',
      labelNames: ['tenant_id'],
    });
  }

  recordRequest(tenantId: string, method: string, status: number) {
    this.tenantRequestCounter
      .labels(tenantId, method, status.toString())
      .inc();
  }

  updateDbConnections(tenantId: string, count: number) {
    this.tenantDbConnections
      .labels(tenantId)
      .set(count);
  }

  updateActiveUsers(tenantId: string, count: number) {
    this.tenantUserCount
      .labels(tenantId)
      .set(count);
  }
}
```

### 2. Health Checks

```typescript
// src/features/tenancy/health/tenant-health.indicator.ts
import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { TenantService } from '../services/tenant.service';
import { DatabaseConnectionService } from '../services/database-connection.service';

@Injectable()
export class TenantHealthIndicator extends HealthIndicator {
  constructor(
    private readonly tenantService: TenantService,
    private readonly dbConnectionService: DatabaseConnectionService,
  ) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const activeTenants = await this.tenantService.getActiveTenantCount();
      const healthyConnections = await this.checkTenantConnections();
      
      const result = this.getStatus(key, true, {
        activeTenants,
        healthyConnections,
      });

      return result;
    } catch (error) {
      throw new HealthCheckError('Tenant health check failed', error);
    }
  }

  private async checkTenantConnections(): Promise<number> {
    // Check a sample of tenant connections
    const sampleTenants = await this.tenantService.getSampleTenants(5);
    let healthyCount = 0;

    for (const tenant of sampleTenants) {
      try {
        const connection = await this.dbConnectionService.getTenantConnection(tenant);
        if (connection.isConnected) {
          healthyCount++;
        }
      } catch (error) {
        // Log error but continue checking other tenants
        console.error(`Tenant ${tenant.id} connection check failed:`, error);
      }
    }

    return healthyCount;
  }
}
```

## Best Practices & Recommendations

### 1. Performance Optimization

- **Connection Pooling**: Use separate connection pools per tenant
- **Caching**: Implement tenant-aware caching strategies
- **Lazy Loading**: Load tenant data only when needed
- **Database Indexing**: Add indexes on tenant_id columns

### 2. Security Guidelines

- **Data Isolation**: Always filter by tenant_id in queries
- **Access Control**: Implement tenant-aware authorization
- **Encryption**: Use tenant-specific encryption keys
- **Audit Logging**: Log all tenant-related operations

### 3. Scalability Considerations

- **Database Sharding**: Plan for horizontal scaling
- **Load Balancing**: Distribute tenant load across servers
- **Resource Limits**: Implement per-tenant resource quotas
- **Monitoring**: Track tenant-specific metrics

### 4. Development Guidelines

- **Code Organization**: Keep tenant logic in dedicated modules
- **Testing**: Write tenant-specific test cases
- **Documentation**: Document tenant isolation strategies
- **Code Reviews**: Focus on data isolation in reviews

## Conclusion

This blueprint provides a comprehensive foundation for implementing multi-tenancy in the AegisX Platform. The modular approach allows for gradual implementation and easy customization based on specific requirements.

Key benefits of this implementation:

1. **Flexible Architecture**: Supports multiple tenancy strategies
2. **Security First**: Built-in data isolation and security measures
3. **Developer Friendly**: Clear abstractions and reusable components
4. **Production Ready**: Includes monitoring, testing, and migration tools
5. **Scalable**: Designed to handle growth in tenants and data

Remember to adapt the implementation based on your specific use case, performance requirements, and compliance needs.
