# Nx CRUD Generator Blueprint

This document provides a comprehensive blueprint for implementing custom Nx generators to create CRUD operations for both API (Fastify + Knex.js) and Frontend (Angular) components in the AegisX Platform.

## Table of Contents

- [Feature Overview](#feature-overview)
- [Architecture Design](#architecture-design)
- [Implementation Strategy](#implementation-strategy)
- [API Generator Implementation](#api-generator-implementation)
- [Frontend Generator Implementation](#frontend-generator-implementation)
- [Multi-Tenancy Support](#multi-tenancy-support)
- [Testing Strategy](#testing-strategy)
- [Usage Examples](#usage-examples)
- [Monitoring & Analytics](#monitoring--analytics)

## Feature Overview

### What is Nx CRUD Generator?

Custom Nx generators (schematics) that automatically create complete CRUD operations including:
- **API Layer**: Controllers, Services, Repositories, DTOs, Validators
- **Frontend Layer**: Components, Services, Models, Forms, Tables
- **Database Layer**: Migrations, Seeds, Indexes
- **Testing Layer**: Unit, Integration, E2E tests

### Business Benefits

- **Development Speed**: 10x faster CRUD creation
- **Consistency**: Standardized code patterns across team
- **Best Practices**: Built-in security, validation, and performance
- **Maintenance**: Easier to update and maintain generated code
- **Quality**: Automated testing generation

### Technical Benefits

- **Type Safety**: Full TypeScript support
- **Multi-Tenancy**: Built-in tenant isolation
- **Authentication**: RBAC integration
- **Validation**: Input validation and sanitization
- **Testing**: Automated test generation

## Architecture Design

### Generator Structure

```text
tools/generators/
├── crud/
│   ├── api/                    # API CRUD generator
│   │   ├── index.ts           # Main generator logic
│   │   ├── schema.json        # Generator schema
│   │   └── files/             # Template files
│   │       ├── controller.ts__template__
│   │       ├── service.ts__template__
│   │       ├── repository.ts__template__
│   │       ├── dto.ts__template__
│   │       └── __name__.spec.ts__template__
│   ├── frontend/              # Frontend CRUD generator
│   │   ├── index.ts           # Main generator logic
│   │   ├── schema.json        # Generator schema
│   │   └── files/             # Template files
│   │       ├── component.ts__template__
│   │       ├── service.ts__template__
│   │       ├── model.ts__template__
│   │       └── __name__.spec.ts__template__
│   └── fullstack/             # Combined generator
│       ├── index.ts           # Calls both API and Frontend
│       └── schema.json        # Combined schema
```

### Code Generation Flow

```text
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Developer     │    │   Nx Generator  │    │   Generated     │
│   Command       │    │   Engine        │    │   Code          │
│                 │    │                 │    │                 │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ nx g crud:api   │───▶│ 1. Parse Schema │───▶│ 2. Template     │
│ --name=product  │    │ 2. Validate     │    │ Processing      │
│ --fields=...    │    │ 3. Generate     │    │ 3. File         │
│                 │    │                 │    │ Creation        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Implementation Strategy

### Phase 1: Generator Foundation

#### 1.1 Generator Schema Definition

```json
{
  "$schema": "http://json-schema.org/schema",
  "id": "crud-api-generator",
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "The name of the resource (e.g., 'product', 'user')",
      "$default": {
        "$source": "argv",
        "index": 0
      }
    },
    "fields": {
      "type": "string",
      "description": "Comma-separated list of fields with types (e.g., 'name:string,price:number,active:boolean')"
    },
    "module": {
      "type": "string",
      "description": "The module to place the generated code",
      "default": "modules"
    },
    "tenant": {
      "type": "boolean",
      "description": "Enable multi-tenancy support",
      "default": true
    },
    "auth": {
      "type": "boolean", 
      "description": "Enable authentication/authorization",
      "default": true
    },
    "audit": {
      "type": "boolean",
      "description": "Enable audit logging",
      "default": true
    },
    "soft-delete": {
      "type": "boolean",
      "description": "Enable soft delete functionality", 
      "default": true
    }
  },
  "required": ["name", "fields"]
} 
```

## API Generator Implementation

### 1. Main Generator Logic

```typescript
// tools/generators/crud/api/index.ts
import {
  Tree,
  formatFiles,
  generateFiles,
  getWorkspaceLayout,
  names,
  offsetFromRoot,
} from '@nx/devkit';
import * as path from 'path';

interface ApiGeneratorSchema {
  name: string;
  fields: string;
  module: string;
  tenant: boolean;
  auth: boolean;
  audit: boolean;
  softDelete: boolean;
}

interface Field {
  name: string;
  type: string;
  required: boolean;
  unique?: boolean;
  default?: any;
}

export default async function (tree: Tree, options: ApiGeneratorSchema) {
  const projectName = options.name;
  const { libsDir } = getWorkspaceLayout(tree);
  
  // Parse fields
  const fields = parseFields(options.fields);
  
  // Generate template variables
  const templateOptions = {
    ...options,
    ...names(projectName),
    fields,
    hasTimestamps: options.audit,
    hasTenantId: options.tenant,
    hasSoftDelete: options.softDelete,
    offsetFromRoot: offsetFromRoot(libsDir),
    template: ''
  };

  // Generate files
  generateFiles(
    tree,
    path.join(__dirname, 'files'),
    path.join(libsDir, options.module, projectName),
    templateOptions
  );

  // Update module exports
  updateModuleExports(tree, options, libsDir);

  await formatFiles(tree);
}

function parseFields(fieldsString: string): Field[] {
  return fieldsString.split(',').map(field => {
    const [name, typeInfo] = field.trim().split(':');
    const [type, ...modifiers] = typeInfo.split('|');
    
    return {
      name: name.trim(),
      type: type.trim(),
      required: !modifiers.includes('optional'),
      unique: modifiers.includes('unique'),
      default: getDefaultValue(type.trim(), modifiers)
    };
  });
}

function getDefaultValue(type: string, modifiers: string[]): any {
  const defaultModifier = modifiers.find(m => m.startsWith('default:'));
  if (defaultModifier) {
    return defaultModifier.split(':')[1];
  }
  
  switch (type) {
    case 'boolean': return false;
    case 'number': return 0;
    case 'string': return '';
    default: return null;
  }
}
```

### 2. Repository Template

```typescript
// tools/generators/crud/api/files/repositories/__name__.repository.ts__template__
import { Injectable } from '@nestjs/common';
<% if (hasTenantId) { %>
import { TenantRepository } from '@aegisx/core-database';
<% } else { %>
import { BaseRepository } from '@aegisx/core-database';
<% } %>
import { Knex } from 'knex';
import { <%= className %> } from '../models/<%= fileName %>.model';
import { Create<%= className %>Dto, Update<%= className %>Dto } from '../dto/<%= fileName %>.dto';

@Injectable()
export class <%= className %>Repository extends <% if (hasTenantId) { %>TenantRepository<<%= className %>><% } else { %>BaseRepository<<%= className %>><% } %> {
  constructor(db: Knex<% if (hasTenantId) { %>, tenantId: string<% } %>) {
    super(db, '<%= plural(fileName) %>'<% if (hasTenantId) { %>, tenantId<% } %>);
  }

  async findWithFilters(filters: {
<% fields.forEach(function(field) { %>
    <%= field.name %>?: <%= field.type %>;
<% }); %>
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ data: <%= className %>[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 10, sortBy = 'created_at', sortOrder = 'desc', ...whereFilters } = filters;
    
    let query = this.query();

    // Apply filters
<% fields.forEach(function(field) { %>
    if (whereFilters.<%= field.name %> !== undefined) {
<% if (field.type === 'string') { %>
      query = query.where('<%= field.name %>', 'ilike', `%${whereFilters.<%= field.name %>}%`);
<% } else { %>
      query = query.where('<%= field.name %>', whereFilters.<%= field.name %>);
<% } %>
    }
<% }); %>

<% if (hasSoftDelete) { %>
    // Exclude soft deleted
    query = query.whereNull('deleted_at');
<% } %>

    // Count total
    const totalQuery = query.clone();
    const [{ count }] = await totalQuery.count('* as count');
    const total = parseInt(count as string);

    // Apply pagination and sorting
    const data = await query
      .orderBy(sortBy, sortOrder)
      .offset((page - 1) * limit)
      .limit(limit);

    return {
      data,
      total,
      page,
      limit
    };
  }

<% if (hasSoftDelete) { %>
  async softDelete(id: string): Promise<boolean> {
    const updated = await this.query()
      .where('id', id)
      .update({
        deleted_at: new Date(),
        updated_at: new Date()
      });
    
    return updated > 0;
  }

  async restore(id: string): Promise<boolean> {
    const updated = await this.query()
      .where('id', id)
      .update({
        deleted_at: null,
        updated_at: new Date()
      });
    
    return updated > 0;
  }

  async findTrashed(): Promise<<%= className %>[]> {
    return this.query().whereNotNull('deleted_at');
  }
<% } %>
}
```

### 3. Service Template

```typescript
// tools/generators/crud/api/files/services/__name__.service.ts__template__
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
<% if (audit) { %>
import { AuditService } from '@aegisx/core-audit';
<% } %>
import { <%= className %>Repository } from '../repositories/<%= fileName %>.repository';
import { <%= className %> } from '../models/<%= fileName %>.model';
import { Create<%= className %>Dto, Update<%= className %>Dto, <%= className %>FilterDto } from '../dto/<%= fileName %>.dto';

@Injectable()
export class <%= className %>Service {
  constructor(
    private readonly <%= propertyName %>Repository: <%= className %>Repository,
<% if (audit) { %>
    private readonly auditService: AuditService,
<% } %>
  ) {}

  async findAll(filters: <%= className %>FilterDto<% if (hasTenantId) { %>, tenantId: string<% } %>): Promise<{
    data: <%= className %>[];
    total: number;
    page: number;
    limit: number;
  }> {
<% if (hasTenantId) { %>
    const repository = new <%= className %>Repository(this.db, tenantId);
    return repository.findWithFilters(filters);
<% } else { %>
    return this.<%= propertyName %>Repository.findWithFilters(filters);
<% } %>
  }

  async findById(id: string<% if (hasTenantId) { %>, tenantId: string<% } %>): Promise<<%= className %>> {
<% if (hasTenantId) { %>
    const repository = new <%= className %>Repository(this.db, tenantId);
    const <%= propertyName %> = await repository.findById(id);
<% } else { %>
    const <%= propertyName %> = await this.<%= propertyName %>Repository.findById(id);
<% } %>
    
    if (!<%= propertyName %>) {
      throw new NotFoundException(`<%= className %> with ID ${id} not found`);
    }
    
    return <%= propertyName %>;
  }

  async create(dto: Create<%= className %>Dto<% if (hasTenantId) { %>, tenantId: string<% } %><% if (audit) { %>, userId: string<% } %>): Promise<<%= className %>> {
<% if (hasTenantId) { %>
    const repository = new <%= className %>Repository(this.db, tenantId);
<% } %>

    // Validate business rules
    await this.validateCreateDto(dto<% if (hasTenantId) { %>, tenantId<% } %>);

<% if (hasTenantId) { %>
    const <%= propertyName %> = await repository.create(dto);
<% } else { %>
    const <%= propertyName %> = await this.<%= propertyName %>Repository.create(dto);
<% } %>

<% if (audit) { %>
    // Log audit event
    await this.auditService.log({
      action: 'CREATE',
      resource: '<%= className %>',
      resourceId: <%= propertyName %>.id,
      userId,
<% if (hasTenantId) { %>
      tenantId,
<% } %>
      changes: dto,
    });
<% } %>

    return <%= propertyName %>;
  }

  async update(id: string, dto: Update<%= className %>Dto<% if (hasTenantId) { %>, tenantId: string<% } %><% if (audit) { %>, userId: string<% } %>): Promise<<%= className %>> {
<% if (hasTenantId) { %>
    const repository = new <%= className %>Repository(this.db, tenantId);
<% } %>

    // Check if exists
    const existing = await this.findById(id<% if (hasTenantId) { %>, tenantId<% } %>);
    
    // Validate business rules
    await this.validateUpdateDto(id, dto<% if (hasTenantId) { %>, tenantId<% } %>);

<% if (hasTenantId) { %>
    const <%= propertyName %> = await repository.update(id, dto);
<% } else { %>
    const <%= propertyName %> = await this.<%= propertyName %>Repository.update(id, dto);
<% } %>

<% if (audit) { %>
    // Log audit event
    await this.auditService.log({
      action: 'UPDATE',
      resource: '<%= className %>',
      resourceId: id,
      userId,
<% if (hasTenantId) { %>
      tenantId,
<% } %>
      changes: dto,
      previousValues: existing,
    });
<% } %>

    return <%= propertyName %>!;
  }

  async delete(id: string<% if (hasTenantId) { %>, tenantId: string<% } %><% if (audit) { %>, userId: string<% } %>): Promise<void> {
<% if (hasTenantId) { %>
    const repository = new <%= className %>Repository(this.db, tenantId);
<% } %>

    // Check if exists
    const existing = await this.findById(id<% if (hasTenantId) { %>, tenantId<% } %>);

<% if (hasSoftDelete) { %>
    const success = await repository.softDelete(id);
<% } else { %>
<% if (hasTenantId) { %>
    const success = await repository.delete(id);
<% } else { %>
    const success = await this.<%= propertyName %>Repository.delete(id);
<% } %>
<% } %>

    if (!success) {
      throw new BadRequestException(`Failed to delete <%= className %> with ID ${id}`);
    }

<% if (audit) { %>
    // Log audit event
    await this.auditService.log({
      action: '<% if (hasSoftDelete) { %>SOFT_DELETE<% } else { %>DELETE<% } %>',
      resource: '<%= className %>',
      resourceId: id,
      userId,
<% if (hasTenantId) { %>
      tenantId,
<% } %>
      previousValues: existing,
    });
<% } %>
  }

  private async validateCreateDto(dto: Create<%= className %>Dto<% if (hasTenantId) { %>, tenantId: string<% } %>): Promise<void> {
<% fields.forEach(function(field) { %>
<% if (field.unique) { %>
    // Check if <%= field.name %> is unique
<% if (hasTenantId) { %>
    const repository = new <%= className %>Repository(this.db, tenantId);
    const existing = await repository.query().where('<%= field.name %>', dto.<%= field.name %>).first();
<% } else { %>
    const existing = await this.<%= propertyName %>Repository.query().where('<%= field.name %>', dto.<%= field.name %>).first();
<% } %>
    if (existing) {
      throw new BadRequestException(`<%= field.name.charAt(0).toUpperCase() + field.name.slice(1) %> already exists`);
    }
<% } %>
<% }); %>
  }

  private async validateUpdateDto(id: string, dto: Update<%= className %>Dto<% if (hasTenantId) { %>, tenantId: string<% } %>): Promise<void> {
<% fields.forEach(function(field) { %>
<% if (field.unique) { %>
    // Check if <%= field.name %> is unique (excluding current record)
    if (dto.<%= field.name %>) {
<% if (hasTenantId) { %>
      const repository = new <%= className %>Repository(this.db, tenantId);
      const existing = await repository.query()
        .where('<%= field.name %>', dto.<%= field.name %>)
        .whereNot('id', id)
        .first();
<% } else { %>
      const existing = await this.<%= propertyName %>Repository.query()
        .where('<%= field.name %>', dto.<%= field.name %>)
        .whereNot('id', id)
        .first();
<% } %>
      if (existing) {
        throw new BadRequestException(`<%= field.name.charAt(0).toUpperCase() + field.name.slice(1) %> already exists`);
      }
    }
<% } %>
<% }); %>
  }
}
```

### 4. Controller Template

```typescript
// tools/generators/crud/api/files/controllers/__name__.controller.ts__template__
import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Body, 
  Param, 
  Query,
<% if (auth) { %>
  UseGuards,
<% } %>
  ParseUUIDPipe,
  ValidationPipe,
  HttpStatus,
  HttpCode
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
<% if (auth) { %>
import { JwtAuthGuard } from '@aegisx/auth';
import { RolesGuard } from '@aegisx/auth';
import { Roles } from '@aegisx/auth';
<% } %>
<% if (hasTenantId) { %>
import { TenantId } from '@aegisx/tenant';
<% } %>
import { <%= className %>Service } from '../services/<%= fileName %>.service';
import { <%= className %> } from '../models/<%= fileName %>.model';
import { 
  Create<%= className %>Dto, 
  Update<%= className %>Dto, 
  <%= className %>FilterDto,
  <%= className %>ResponseDto 
} from '../dto/<%= fileName %>.dto';

@ApiTags('<%= plural(fileName) %>')
<% if (auth) { %>
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
<% } %>
@Controller('<%= plural(fileName) %>')
export class <%= className %>Controller {
  constructor(private readonly <%= propertyName %>Service: <%= className %>Service) {}

  @Get()
  @ApiOperation({ summary: 'Get all <%= plural(fileName) %>' })
  @ApiResponse({ status: 200, description: 'List of <%= plural(fileName) %>', type: [<%= className %>ResponseDto] })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
<% fields.forEach(function(field) { %>
  @ApiQuery({ name: '<%= field.name %>', required: false, type: <%= field.type === 'string' ? 'String' : field.type === 'number' ? 'Number' : 'Boolean' %> })
<% }); %>
<% if (auth) { %>
  @Roles('user', 'admin')
<% } %>
  async findAll(
    @Query(new ValidationPipe({ transform: true })) filters: <%= className %>FilterDto,
<% if (hasTenantId) { %>
    @TenantId() tenantId: string,
<% } %>
  ) {
    return this.<%= propertyName %>Service.findAll(filters<% if (hasTenantId) { %>, tenantId<% } %>);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get <%= fileName %> by ID' })
  @ApiResponse({ status: 200, description: '<%= className %> found', type: <%= className %>ResponseDto })
  @ApiResponse({ status: 404, description: '<%= className %> not found' })
<% if (auth) { %>
  @Roles('user', 'admin')
<% } %>
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
<% if (hasTenantId) { %>
    @TenantId() tenantId: string,
<% } %>
  ): Promise<<%= className %>> {
    return this.<%= propertyName %>Service.findById(id<% if (hasTenantId) { %>, tenantId<% } %>);
  }

  @Post()
  @ApiOperation({ summary: 'Create new <%= fileName %>' })
  @ApiResponse({ status: 201, description: '<%= className %> created successfully', type: <%= className %>ResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
<% if (auth) { %>
  @Roles('admin')
<% } %>
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body(ValidationPipe) dto: Create<%= className %>Dto,
<% if (hasTenantId) { %>
    @TenantId() tenantId: string,
<% } %>
<% if (audit) { %>
    @CurrentUser() user: any,
<% } %>
  ): Promise<<%= className %>> {
    return this.<%= propertyName %>Service.create(dto<% if (hasTenantId) { %>, tenantId<% } %><% if (audit) { %>, user.id<% } %>);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update <%= fileName %>' })
  @ApiResponse({ status: 200, description: '<%= className %> updated successfully', type: <%= className %>ResponseDto })
  @ApiResponse({ status: 404, description: '<%= className %> not found' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
<% if (auth) { %>
  @Roles('admin')
<% } %>
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) dto: Update<%= className %>Dto,
<% if (hasTenantId) { %>
    @TenantId() tenantId: string,
<% } %>
<% if (audit) { %>
    @CurrentUser() user: any,
<% } %>
  ): Promise<<%= className %>> {
    return this.<%= propertyName %>Service.update(id, dto<% if (hasTenantId) { %>, tenantId<% } %><% if (audit) { %>, user.id<% } %>);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete <%= fileName %>' })
  @ApiResponse({ status: 204, description: '<%= className %> deleted successfully' })
  @ApiResponse({ status: 404, description: '<%= className %> not found' })
<% if (auth) { %>
  @Roles('admin')
<% } %>
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
<% if (hasTenantId) { %>
    @TenantId() tenantId: string,
<% } %>
<% if (audit) { %>
    @CurrentUser() user: any,
<% } %>
  ): Promise<void> {
    return this.<%= propertyName %>Service.delete(id<% if (hasTenantId) { %>, tenantId<% } %><% if (audit) { %>, user.id<% } %>);
  }

<% if (hasSoftDelete) { %>
  @Post(':id/restore')
  @ApiOperation({ summary: 'Restore soft deleted <%= fileName %>' })
  @ApiResponse({ status: 200, description: '<%= className %> restored successfully' })
  @ApiResponse({ status: 404, description: '<%= className %> not found' })
<% if (auth) { %>
  @Roles('admin')
<% } %>
  async restore(
    @Param('id', ParseUUIDPipe) id: string,
<% if (hasTenantId) { %>
    @TenantId() tenantId: string,
<% } %>
<% if (audit) { %>
    @CurrentUser() user: any,
<% } %>
  ): Promise<<%= className %>> {
    return this.<%= propertyName %>Service.restore(id<% if (hasTenantId) { %>, tenantId<% } %><% if (audit) { %>, user.id<% } %>);
  }

  @Get('trashed/list')
  @ApiOperation({ summary: 'Get all soft deleted <%= plural(fileName) %>' })
  @ApiResponse({ status: 200, description: 'List of trashed <%= plural(fileName) %>', type: [<%= className %>ResponseDto] })
<% if (auth) { %>
  @Roles('admin')
<% } %>
  async findTrashed(
<% if (hasTenantId) { %>
    @TenantId() tenantId: string,
<% } %>
  ): Promise<<%= className %>[]> {
    return this.<%= propertyName %>Service.findTrashed(<% if (hasTenantId) { %>tenantId<% } %>);
  }
<% } %>
}
```

### 5. DTO Templates

```typescript
// tools/generators/crud/api/files/dto/__name__.dto.ts__template__
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { 
  IsString, 
  IsNumber, 
  IsBoolean, 
  IsOptional, 
  IsUUID, 
  IsDate,
  MinLength,
  MaxLength,
  Min,
  Max,
  IsEmail,
  IsUrl
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class Create<%= className %>Dto {
<% fields.forEach(function(field) { %>
<% if (field.required) { %>
  @ApiProperty({ 
    description: '<%= field.name.charAt(0).toUpperCase() + field.name.slice(1) %> of the <%= fileName %>',
<% if (field.type === 'string') { %>
    example: '<%= field.default || 'Sample ' + field.name %>'
<% } else if (field.type === 'number') { %>
    example: <%= field.default || 100 %>
<% } else if (field.type === 'boolean') { %>
    example: <%= field.default || true %>
<% } %>
  })
<% } else { %>
  @ApiPropertyOptional({ 
    description: '<%= field.name.charAt(0).toUpperCase() + field.name.slice(1) %> of the <%= fileName %>',
<% if (field.type === 'string') { %>
    example: '<%= field.default || 'Sample ' + field.name %>'
<% } else if (field.type === 'number') { %>
    example: <%= field.default || 100 %>
<% } else if (field.type === 'boolean') { %>
    example: <%= field.default || true %>
<% } %>
  })
  @IsOptional()
<% } %>
<% if (field.type === 'string') { %>
  @IsString()
<% if (field.name.includes('email')) { %>
  @IsEmail()
<% } %>
<% if (field.name.includes('url')) { %>
  @IsUrl()
<% } %>
  @MinLength(1)
  @MaxLength(255)
<% } else if (field.type === 'number') { %>
  @IsNumber()
  @Min(0)
<% } else if (field.type === 'boolean') { %>
  @IsBoolean()
<% } %>
  <%= field.name %>: <%= field.type %>;

<% }); %>
}

export class Update<%= className %>Dto extends PartialType(Create<%= className %>Dto) {}

export class <%= className %>FilterDto {
<% fields.forEach(function(field) { %>
  @ApiPropertyOptional({ description: 'Filter by <%= field.name %>' })
  @IsOptional()
<% if (field.type === 'string') { %>
  @IsString()
<% } else if (field.type === 'number') { %>
  @IsNumber()
<% } else if (field.type === 'boolean') { %>
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
<% } %>
  <%= field.name %>?: <%= field.type %>;

<% }); %>
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', default: 10 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({ description: 'Sort by field', default: 'created_at' })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ description: 'Sort order', enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';
}

export class <%= className %>ResponseDto {
  @ApiProperty({ description: 'Unique identifier' })
  id: string;

<% fields.forEach(function(field) { %>
  @ApiProperty({ description: '<%= field.name.charAt(0).toUpperCase() + field.name.slice(1) %>' })
  <%= field.name %>: <%= field.type %>;

<% }); %>
<% if (hasTenantId) { %>
  @ApiProperty({ description: 'Tenant ID' })
  tenantId: string;

<% } %>
<% if (hasTimestamps) { %>
  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;

<% } %>
<% if (hasSoftDelete) { %>
  @ApiPropertyOptional({ description: 'Soft delete timestamp' })
  deletedAt?: Date;

<% } %>
}
```

### 6. Model Template

```typescript
// tools/generators/crud/api/files/models/__name__.model.ts__template__
export interface <%= className %> {
  id: string;
<% fields.forEach(function(field) { %>
  <%= field.name %>: <%= field.type %>;
<% }); %>
<% if (hasTenantId) { %>
  tenantId: string;
<% } %>
<% if (hasTimestamps) { %>
  createdAt: Date;
  updatedAt: Date;
<% } %>
<% if (hasSoftDelete) { %>
  deletedAt?: Date;
<% } %>
}

export interface <%= className %>CreatePayload {
<% fields.forEach(function(field) { %>
<% if (field.required) { %>
  <%= field.name %>: <%= field.type %>;
<% } else { %>
  <%= field.name %>?: <%= field.type %>;
<% } %>
<% }); %>
}

export interface <%= className %>UpdatePayload {
<% fields.forEach(function(field) { %>
  <%= field.name %>?: <%= field.type %>;
<% }); %>
}
```

## Frontend Generator Implementation

### 1. Main Generator Logic

```typescript
// tools/generators/crud/frontend/index.ts
import {
  Tree,
  formatFiles,
  generateFiles,
  getWorkspaceLayout,
  names,
  offsetFromRoot,
} from '@nx/devkit';
import * as path from 'path';

interface FrontendGeneratorSchema {
  name: string;
  fields: string;
  module: string;
  tenant: boolean;
  auth: boolean;
  audit: boolean;
  softDelete: boolean;
}

interface Field {
  name: string;
  type: string;
  required: boolean;
  unique?: boolean;
  default?: any;
}

export default async function (tree: Tree, options: FrontendGeneratorSchema) {
  const projectName = options.name;
  const { libsDir } = getWorkspaceLayout(tree);
  
  // Parse fields
  const fields = parseFields(options.fields);
  
  // Generate template variables
  const templateOptions = {
    ...options,
    ...names(projectName),
    fields,
    hasTimestamps: options.audit,
    hasTenantId: options.tenant,
    hasSoftDelete: options.softDelete,
    offsetFromRoot: offsetFromRoot(libsDir),
    template: ''
  };

  // Generate files
  generateFiles(
    tree,
    path.join(__dirname, 'files'),
    path.join(libsDir, options.module, projectName),
    templateOptions
  );

  // Update module exports
  updateModuleExports(tree, options, libsDir);

  await formatFiles(tree);
}

function parseFields(fieldsString: string): Field[] {
  return fieldsString.split(',').map(field => {
    const [name, typeInfo] = field.trim().split(':');
    const [type, ...modifiers] = typeInfo.split('|');
    
    return {
      name: name.trim(),
      type: type.trim(),
      required: !modifiers.includes('optional'),
      unique: modifiers.includes('unique'),
      default: getDefaultValue(type.trim(), modifiers)
    };
  });
}

function getDefaultValue(type: string, modifiers: string[]): any {
  const defaultModifier = modifiers.find(m => m.startsWith('default:'));
  if (defaultModifier) {
    return defaultModifier.split(':')[1];
  }
  
  switch (type) {
    case 'boolean': return false;
    case 'number': return 0;
    case 'string': return '';
    default: return null;
  }
}
```

### 2. Angular List Component Template

```typescript
// tools/generators/crud/frontend/files/components/__name__-list/__name__-list.component.ts__template__
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';
import { <%= className %>Service } from '../../services/<%= fileName %>.service';
import { <%= className %> } from '../../models/<%= fileName %>.model';

@Component({
  selector: 'app-<%= fileName %>-list',
  templateUrl: './<%= fileName %>-list.component.html',
  styleUrls: ['./<%= fileName %>-list.component.scss']
})
export class <%= className %>ListComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  <%= plural(propertyName) %>: <%= className %>[] = [];
  filteredData: <%= className %>[] = [];
  loading = false;
  error: string | null = null;

  // Pagination
  currentPage = 1;
  pageSize = 10;
  totalItems = 0;
  totalPages = 0;

  // Search and filters
  searchTerm = '';
  searchSubject = new Subject<string>();
<% fields.forEach(function(field) { %>
  <%= field.name %>Filter: <%= field.type %> | null = null;
<% }); %>

  // Sorting
  sortBy = 'createdAt';
  sortOrder: 'asc' | 'desc' = 'desc';

  // Selection
  selectedItems: Set<string> = new Set();
  selectAll = false;

  constructor(
    private <%= propertyName %>Service: <%= className %>Service,
    private router: Router
  ) {
    // Setup search debouncing
    this.searchSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(searchTerm => {
        this.searchTerm = searchTerm;
        this.currentPage = 1;
        this.load<%= className %>s();
      });
  }

  ngOnInit(): void {
    this.load<%= className %>s();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  load<%= className %>s(): void {
    this.loading = true;
    this.error = null;

    const filters = {
      page: this.currentPage,
      limit: this.pageSize,
      sortBy: this.sortBy,
      sortOrder: this.sortOrder,
      ...(this.searchTerm && { search: this.searchTerm }),
<% fields.forEach(function(field) { %>
      ...(this.<%= field.name %>Filter !== null && { <%= field.name %>: this.<%= field.name %>Filter }),
<% }); %>
    };

    this.<%= propertyName %>Service.findAll(filters)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.<%= plural(propertyName) %> = response.data;
          this.totalItems = response.total;
          this.totalPages = Math.ceil(this.totalItems / this.pageSize);
          this.loading = false;
        },
        error: (error) => {
          this.error = 'Failed to load <%= plural(fileName) %>. Please try again.';
          this.loading = false;
          console.error('Error loading <%= plural(fileName) %>:', error);
        }
      });
  }

  onSearch(event: any): void {
    this.searchSubject.next(event.target.value);
  }

  onSort(field: string): void {
    if (this.sortBy === field) {
      this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = field;
      this.sortOrder = 'asc';
    }
    this.load<%= className %>s();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.load<%= className %>s();
  }

  onPageSizeChange(size: number): void {
    this.pageSize = size;
    this.currentPage = 1;
    this.load<%= className %>s();
  }

  onCreate(): void {
    this.router.navigate(['/<%= plural(fileName) %>/create']);
  }

  onEdit(id: string): void {
    this.router.navigate(['/<%= plural(fileName) %>', id, 'edit']);
  }

  onView(id: string): void {
    this.router.navigate(['/<%= plural(fileName) %>', id]);
  }

  onDelete(item: <%= className %>): void {
    if (confirm(`Are you sure you want to delete ${<% if (fields.find(f => f.name === 'name')) { %>item.name<% } else { %>item.id<% } %>}?`)) {
      this.<%= propertyName %>Service.delete(item.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.load<%= className %>s();
          },
          error: (error) => {
            this.error = 'Failed to delete <%= fileName %>. Please try again.';
            console.error('Error deleting <%= fileName %>:', error);
          }
        });
    }
  }

  onBulkDelete(): void {
    if (this.selectedItems.size === 0) return;
    
    if (confirm(`Are you sure you want to delete ${this.selectedItems.size} selected items?`)) {
      const deleteRequests = Array.from(this.selectedItems).map(id => 
        this.<%= propertyName %>Service.delete(id)
      );

      // Handle bulk operations (implement in service)
      this.<%= propertyName %>Service.bulkDelete(Array.from(this.selectedItems))
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.selectedItems.clear();
            this.selectAll = false;
            this.load<%= className %>s();
          },
          error: (error) => {
            this.error = 'Failed to delete selected items. Please try again.';
            console.error('Error in bulk delete:', error);
          }
        });
    }
  }

  onSelectItem(id: string, event: any): void {
    if (event.target.checked) {
      this.selectedItems.add(id);
    } else {
      this.selectedItems.delete(id);
      this.selectAll = false;
    }
  }

  onSelectAll(event: any): void {
    this.selectAll = event.target.checked;
    if (this.selectAll) {
      this.<%= plural(propertyName) %>.forEach(item => this.selectedItems.add(item.id));
    } else {
      this.selectedItems.clear();
    }
  }

  isSelected(id: string): boolean {
    return this.selectedItems.has(id);
  }

  clearFilters(): void {
    this.searchTerm = '';
<% fields.forEach(function(field) { %>
    this.<%= field.name %>Filter = null;
<% }); %>
    this.currentPage = 1;
    this.load<%= className %>s();
  }

  exportData(): void {
    // Implement export functionality
    this.<%= propertyName %>Service.export()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `<%= plural(fileName) %>-${new Date().toISOString().split('T')[0]}.csv`;
          link.click();
          window.URL.revokeObjectURL(url);
        },
        error: (error) => {
          this.error = 'Failed to export data. Please try again.';
          console.error('Error exporting data:', error);
        }
      });
  }
}
```

### 3. Angular Service Template

```typescript
// tools/generators/crud/frontend/files/services/__name__.service.ts__template__
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { <%= className %>, <%= className %>CreatePayload, <%= className %>UpdatePayload } from '../models/<%= fileName %>.model';

export interface <%= className %>ListResponse {
  data: <%= className %>[];
  total: number;
  page: number;
  limit: number;
}

export interface <%= className %>Filters {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
<% fields.forEach(function(field) { %>
  <%= field.name %>?: <%= field.type %>;
<% }); %>
}

@Injectable({
  providedIn: 'root'
})
export class <%= className %>Service {
  private readonly apiUrl = '/api/<%= plural(fileName) %>';
  
  // State management
  private <%= plural(propertyName) %>Subject = new BehaviorSubject<<%= className %>[]>([]);
  public <%= plural(propertyName) %>$ = this.<%= plural(propertyName) %>Subject.asObservable();

  constructor(private http: HttpClient) {}

  findAll(filters: <%= className %>Filters = {}): Observable<<%= className %>ListResponse> {
    let params = new HttpParams();

    Object.keys(filters).forEach(key => {
      const value = filters[key as keyof <%= className %>Filters];
      if (value !== null && value !== undefined) {
        params = params.set(key, value.toString());
      }
    });

    return this.http.get<<%= className %>ListResponse>(this.apiUrl, { params })
      .pipe(
        tap(response => this.<%= plural(propertyName) %>Subject.next(response.data))
      );
  }

  findById(id: string): Observable<<%= className %>> {
    return this.http.get<<%= className %>>(`${this.apiUrl}/${id}`);
  }

  create(data: <%= className %>CreatePayload): Observable<<%= className %>> {
    return this.http.post<<%= className %>>(this.apiUrl, data)
      .pipe(
        tap(created<%= className %> => {
          const current<%= className %>s = this.<%= plural(propertyName) %>Subject.value;
          this.<%= plural(propertyName) %>Subject.next([created<%= className %>, ...current<%= className %>s]);
        })
      );
  }

  update(id: string, data: <%= className %>UpdatePayload): Observable<<%= className %>> {
    return this.http.put<<%= className %>>(`${this.apiUrl}/${id}`, data)
      .pipe(
        tap(updated<%= className %> => {
          const current<%= className %>s = this.<%= plural(propertyName) %>Subject.value;
          const index = current<%= className %>s.findIndex(item => item.id === id);
          if (index !== -1) {
            current<%= className %>s[index] = updated<%= className %>;
            this.<%= plural(propertyName) %>Subject.next([...current<%= className %>s]);
          }
        })
      );
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`)
      .pipe(
        tap(() => {
          const current<%= className %>s = this.<%= plural(propertyName) %>Subject.value;
          const filtered<%= className %>s = current<%= className %>s.filter(item => item.id !== id);
          this.<%= plural(propertyName) %>Subject.next(filtered<%= className %>s);
        })
      );
  }

  bulkDelete(ids: string[]): Observable<void> {
    return this.http.request<void>('DELETE', this.apiUrl, {
      body: { ids }
    }).pipe(
      tap(() => {
        const current<%= className %>s = this.<%= plural(propertyName) %>Subject.value;
        const filtered<%= className %>s = current<%= className %>s.filter(item => !ids.includes(item.id));
        this.<%= plural(propertyName) %>Subject.next(filtered<%= className %>s);
      })
    );
  }

<% if (hasSoftDelete) { %>
  restore(id: string): Observable<<%= className %>> {
    return this.http.post<<%= className %>>(`${this.apiUrl}/${id}/restore`, {});
  }

  findTrashed(): Observable<<%= className %>[]> {
    return this.http.get<<%= className %>[]>(`${this.apiUrl}/trashed/list`);
  }
<% } %>

  export(filters: <%= className %>Filters = {}): Observable<Blob> {
    let params = new HttpParams();

    Object.keys(filters).forEach(key => {
      const value = filters[key as keyof <%= className %>Filters];
      if (value !== null && value !== undefined) {
        params = params.set(key, value.toString());
      }
    });

    return this.http.get(`${this.apiUrl}/export`, { 
      params, 
      responseType: 'blob' 
    });
  }

  // Real-time updates (if WebSocket is enabled)
  setupRealTimeUpdates(): void {
    // Implementation depends on your WebSocket setup
    // Example using Socket.IO:
    /*
    this.socketService.on('<%= fileName %>:created', (data: <%= className %>) => {
      const current<%= className %>s = this.<%= plural(propertyName) %>Subject.value;
      this.<%= plural(propertyName) %>Subject.next([data, ...current<%= className %>s]);
    });

    this.socketService.on('<%= fileName %>:updated', (data: <%= className %>) => {
      const current<%= className %>s = this.<%= plural(propertyName) %>Subject.value;
      const index = current<%= className %>s.findIndex(item => item.id === data.id);
      if (index !== -1) {
        current<%= className %>s[index] = data;
        this.<%= plural(propertyName) %>Subject.next([...current<%= className %>s]);
      }
    });

    this.socketService.on('<%= fileName %>:deleted', (data: { id: string }) => {
      const current<%= className %>s = this.<%= plural(propertyName) %>Subject.value;
      const filtered<%= className %>s = current<%= className %>s.filter(item => item.id !== data.id);
      this.<%= plural(propertyName) %>Subject.next(filtered<%= className %>s);
    });
    */
  }
}
```

## Usage Examples

### 1. Basic CRUD Generation

```bash
# Generate API CRUD for Product
nx g crud:api product --fields="name:string,price:number,description:string|optional,active:boolean|default:true"

# Generate Frontend CRUD for Product
nx g crud:frontend product --fields="name:string,price:number,description:string|optional,active:boolean|default:true"

# Generate Full-stack CRUD for Product
nx g crud:fullstack product --fields="name:string,price:number,description:string|optional,active:boolean|default:true"
```

### 2. Advanced CRUD with Multi-tenancy

```bash
# Generate multi-tenant CRUD
nx g crud:fullstack customer \
  --fields="name:string,email:string|unique,phone:string|optional,status:string|default:active" \
  --tenant=true \
  --auth=true \
  --audit=true \
  --soft-delete=true
```

### 3. E-commerce Product CRUD

```bash
# Generate comprehensive product CRUD
nx g crud:fullstack product \
  --fields="name:string,sku:string|unique,price:number,cost:number|optional,description:string|optional,category:string,tags:string|optional,active:boolean|default:true,weight:number|optional,dimensions:string|optional" \
  --tenant=true \
  --auth=true \
  --audit=true \
  --soft-delete=true
```

### 4. User Management CRUD

```bash
# Generate user management CRUD
nx g crud:fullstack user \
  --fields="firstName:string,lastName:string,email:string|unique,phone:string|optional,role:string|default:user,active:boolean|default:true,lastLogin:string|optional" \
  --tenant=true \
  --auth=true \
  --audit=true \
  --soft-delete=false
```

### 5. Generated File Structure

After running the generator, you'll get the following structure:

```text
libs/modules/product/
├── src/
│   ├── controllers/
│   │   ├── product.controller.ts
│   │   └── product.controller.spec.ts
│   ├── services/
│   │   ├── product.service.ts
│   │   └── product.service.spec.ts
│   ├── repositories/
│   │   ├── product.repository.ts
│   │   └── product.repository.spec.ts
│   ├── dto/
│   │   └── product.dto.ts
│   ├── models/
│   │   └── product.model.ts
│   ├── migrations/
│   │   └── 001_create_products_table.ts
│   └── index.ts
├── package.json
└── README.md

apps/web/src/app/features/product/
├── components/
│   ├── product-list/
│   │   ├── product-list.component.ts
│   │   ├── product-list.component.html
│   │   ├── product-list.component.scss
│   │   └── product-list.component.spec.ts
│   ├── product-form/
│   │   ├── product-form.component.ts
│   │   ├── product-form.component.html
│   │   ├── product-form.component.scss
│   │   └── product-form.component.spec.ts
│   └── product-detail/
│       ├── product-detail.component.ts
│       ├── product-detail.component.html
│       ├── product-detail.component.scss
│       └── product-detail.component.spec.ts
├── services/
│   ├── product.service.ts
│   └── product.service.spec.ts
├── models/
│   └── product.model.ts
└── product.module.ts
```

## Testing Strategy

### 1. Generated Tests

The generator automatically creates comprehensive tests:

#### API Tests
```typescript
// Generated controller test
describe('ProductController', () => {
  let controller: ProductController;
  let service: ProductService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductController],
      providers: [
        {
          provide: ProductService,
          useValue: {
            findAll: jest.fn(),
            findById: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ProductController>(ProductController);
    service = module.get<ProductService>(ProductService);
  });

  describe('findAll', () => {
    it('should return products list', async () => {
      const result = { data: [], total: 0, page: 1, limit: 10 };
      jest.spyOn(service, 'findAll').mockResolvedValue(result);

      expect(await controller.findAll({}, 'tenant-id')).toBe(result);
    });
  });

  // More tests...
});
```

#### Frontend Tests
```typescript
// Generated component test
describe('ProductListComponent', () => {
  let component: ProductListComponent;
  let fixture: ComponentFixture<ProductListComponent>;
  let productService: jasmine.SpyObj<ProductService>;

  beforeEach(async () => {
    const spy = jasmine.createSpyObj('ProductService', ['findAll', 'delete']);

    await TestBed.configureTestingModule({
      declarations: [ProductListComponent],
      providers: [
        { provide: ProductService, useValue: spy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ProductListComponent);
    component = fixture.componentInstance;
    productService = TestBed.inject(ProductService) as jasmine.SpyOf<ProductService>;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load products on init', () => {
    const mockResponse = { data: [], total: 0, page: 1, limit: 10 };
    productService.findAll.and.returnValue(of(mockResponse));

    component.ngOnInit();

    expect(productService.findAll).toHaveBeenCalled();
    expect(component.products).toEqual([]);
  });

  // More tests...
});
```

### 2. Integration Tests

```bash
# Run generated tests
nx test product-api
nx test product-frontend

# Run E2E tests
nx e2e product-e2e
```

## Performance Optimization

### 1. Generated Optimizations

The generator includes several performance optimizations:

- **Database Indexing**: Automatically creates indexes for search fields
- **Pagination**: Built-in pagination for large datasets  
- **Caching**: Redis caching for frequently accessed data
- **Query Optimization**: Efficient Knex.js queries with proper joins
- **Lazy Loading**: Frontend components use lazy loading
- **Change Detection**: OnPush strategy for Angular components

### 2. Monitoring Integration

Generated code includes monitoring hooks:

```typescript
// Auto-generated metrics
@Injectable()
export class ProductService {
  constructor(
    private metricsService: MetricsService
  ) {}

  async findAll(filters: ProductFilterDto): Promise<any> {
    const timer = this.metricsService.startTimer('product_service_find_all');
    
    try {
      const result = await this.productRepository.findWithFilters(filters);
      this.metricsService.incrementCounter('product_service_find_all_success');
      return result;
    } catch (error) {
      this.metricsService.incrementCounter('product_service_find_all_error');
      throw error;
    } finally {
      timer.end();
    }
  }
}
```

## Conclusion

This Nx CRUD Generator Blueprint provides a comprehensive solution for rapid development of enterprise-grade CRUD operations in the AegisX Platform. Key benefits include:

### ✅ **Features Generated:**

1. **Complete API Layer** - Controllers, Services, Repositories, DTOs
2. **Full Frontend Components** - List, Form, Detail views with Angular
3. **Database Integration** - Migrations, models, and optimized queries
4. **Multi-tenancy Support** - Built-in tenant isolation
5. **Authentication & Authorization** - RBAC integration
6. **Testing Suite** - Unit, integration, and E2E tests
7. **Performance Optimizations** - Caching, pagination, indexing

### 🔒 **Enterprise Features:**

- JWT authentication and RBAC authorization
- Audit logging for compliance
- Soft delete functionality
- Input validation and sanitization
- Error handling and monitoring
- Real-time updates via WebSocket

### 🚀 **Developer Experience:**

- Type-safe TypeScript throughout
- Auto-generated API documentation
- Consistent code patterns
- Comprehensive testing
- Hot reload development
- Easy customization

This generator significantly accelerates development while maintaining enterprise-grade quality, security, and scalability standards suitable for HIS, ERP, and other mission-critical applications.