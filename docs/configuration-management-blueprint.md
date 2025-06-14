# Configuration Management Feature Blueprint

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Feature Flags](#feature-flags)
- [Environment Configuration](#environment-configuration)
- [System Settings](#system-settings)
- [Theme & Branding](#theme--branding)
- [Configuration API](#configuration-api)
- [Testing Strategy](#testing-strategy)

## Overview

### Purpose

Comprehensive configuration management system สำหรับ AegisX Platform ที่รองรับ feature flags, environment settings, tenant customization, และ system-wide configuration พร้อมด้วย real-time updates และ security controls

### Key Features

- **Feature Flags** - A/B testing, gradual rollouts, kill switches
- **Environment Configuration** - Per-environment settings management
- **System Settings** - Global platform configuration
- **Tenant Customization** - Per-tenant branding และ settings
- **Real-time Updates** - Hot configuration reload
- **Permission Control** - Role-based configuration access
- **Configuration Validation** - Schema validation และ safety checks
- **Audit Trail** - Change tracking และ rollback capabilities

### Business Value

- เปิดใช้ A/B testing และ gradual feature rollouts
- ลดความเสี่ยงจาก deployment ด้วย kill switches
- รองรับ tenant customization และ white-labeling
- ปรับปรุง operational efficiency ด้วย real-time configuration

## Architecture

### System Overview

```text
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Admin UI      │───▶│  Configuration  │───▶│   Application   │
│   & API         │    │    Manager      │    │   Runtime       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                               │                        │
                               ▼                        ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   Config Store  │    │     Cache       │
                       │   (Database)    │    │   (Redis)       │
                       └─────────────────┘    └─────────────────┘
```

### Core Components

- **Configuration Manager** - Central configuration orchestration
- **Feature Flag Engine** - Feature toggle management
- **Validation Engine** - Schema validation และ safety checks
- **Cache Manager** - High-performance configuration caching
- **Event System** - Real-time configuration updates
- **Audit Logger** - Change tracking และ compliance

### Database Schema

```typescript
// Feature Flags
interface FeatureFlag {
  id: string;
  name: string;
  key: string; // feature.user_dashboard.new_ui
  description: string;
  type: 'boolean' | 'string' | 'number' | 'json';
  defaultValue: any;
  isActive: boolean;
  rolloutPercentage: number; // 0-100
  targetAudience?: {
    userIds?: string[];
    userGroups?: string[];
    tenantIds?: string[];
    userAttributes?: Record<string, any>;
  };
  environment: 'development' | 'staging' | 'production' | 'all';
  expiresAt?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// System Settings
interface SystemSetting {
  id: string;
  category: string; // auth, email, storage, etc.
  key: string;
  name: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'json' | 'encrypted';
  value: any;
  defaultValue: any;
  validationSchema?: any; // JSON Schema
  isPublic: boolean; // Can be accessed by frontend
  requiresRestart: boolean;
  environment: string;
  updatedBy: string;
  updatedAt: Date;
}

// Tenant Configuration
interface TenantConfiguration {
  id: string;
  tenantId: string;
  category: string; // branding, features, limits
  settings: Record<string, any>;
  branding?: {
    logoUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
    customCss?: string;
    favicon?: string;
    appName?: string;
  };
  features?: Record<string, boolean>;
  limits?: {
    maxUsers?: number;
    maxStorage?: number;
    maxApiCalls?: number;
  };
  updatedBy: string;
  updatedAt: Date;
}
```

## Feature Flags

### Feature Flag Engine

```typescript
// src/features/config/services/feature-flag.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeatureFlag } from '../entities/feature-flag.entity';
import { CacheService } from '../../../core/cache/cache.service';

@Injectable()
export class FeatureFlagService {
  constructor(
    @InjectRepository(FeatureFlag)
    private featureFlagRepository: Repository<FeatureFlag>,
    private cacheService: CacheService,
  ) {}

  async isFeatureEnabled(
    flagKey: string,
    context: {
      userId?: string;
      tenantId?: string;
      userAttributes?: Record<string, any>;
      environment?: string;
    }
  ): Promise<boolean> {
    const flag = await this.getFeatureFlag(flagKey, context.environment);

    if (!flag || !flag.isActive) {
      return false;
    }

    // Check expiration
    if (flag.expiresAt && new Date() > flag.expiresAt) {
      return false;
    }

    // Check target audience
    if (flag.targetAudience && !this.isUserInTargetAudience(flag.targetAudience, context)) {
      return false;
    }

    // Check rollout percentage
    if (flag.rolloutPercentage < 100) {
      const userHash = this.hashString(`${flagKey}:${context.userId || 'anonymous'}`);
      const userPercentile = userHash % 100;
      if (userPercentile >= flag.rolloutPercentage) {
        return false;
      }
    }

    return this.evaluateFlag(flag, context);
  }

  async getFeatureFlagValue<T = any>(
    flagKey: string,
    context: {
      userId?: string;
      tenantId?: string;
      userAttributes?: Record<string, any>;
      environment?: string;
    },
    defaultValue?: T
  ): Promise<T> {
    const enabled = await this.isFeatureEnabled(flagKey, context);
    
    if (!enabled) {
      return defaultValue as T;
    }

    const flag = await this.getFeatureFlag(flagKey, context.environment);
    return flag?.value !== undefined ? flag.value : defaultValue;
  }

  private async getFeatureFlag(flagKey: string, environment?: string): Promise<FeatureFlag | null> {
    const cacheKey = `feature_flag:${flagKey}:${environment || 'all'}`;
    
    let flag = await this.cacheService.get<FeatureFlag>(cacheKey);
    
    if (!flag) {
      flag = await this.featureFlagRepository.findOne({
        where: [
          { key: flagKey, environment: environment || 'all' },
          { key: flagKey, environment: 'all' },
        ],
        order: { environment: 'DESC' }, // Prefer specific environment over 'all'
      });

      if (flag) {
        await this.cacheService.set(cacheKey, flag, 300); // Cache for 5 minutes
      }
    }

    return flag;
  }

  private isUserInTargetAudience(
    targetAudience: FeatureFlag['targetAudience'],
    context: { userId?: string; tenantId?: string; userAttributes?: Record<string, any> }
  ): boolean {
    if (!targetAudience) return true;

    // Check user IDs
    if (targetAudience.userIds && context.userId) {
      if (targetAudience.userIds.includes(context.userId)) {
        return true;
      }
    }

    // Check tenant IDs
    if (targetAudience.tenantIds && context.tenantId) {
      if (targetAudience.tenantIds.includes(context.tenantId)) {
        return true;
      }
    }

    // Check user attributes
    if (targetAudience.userAttributes && context.userAttributes) {
      for (const [key, value] of Object.entries(targetAudience.userAttributes)) {
        if (context.userAttributes[key] === value) {
          return true;
        }
      }
    }

    return false;
  }

  private evaluateFlag(flag: FeatureFlag, context: any): boolean {
    switch (flag.type) {
      case 'boolean':
        return Boolean(flag.defaultValue);
      case 'string':
      case 'number':
      case 'json':
        return true; // Feature is enabled, value is available
      default:
        return Boolean(flag.defaultValue);
    }
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  // Admin methods
  async createFeatureFlag(flagData: Partial<FeatureFlag>): Promise<FeatureFlag> {
    const flag = this.featureFlagRepository.create(flagData);
    const savedFlag = await this.featureFlagRepository.save(flag);
    
    // Invalidate cache
    await this.invalidateFeatureFlagCache(savedFlag.key);
    
    return savedFlag;
  }

  async updateFeatureFlag(flagId: string, updates: Partial<FeatureFlag>): Promise<FeatureFlag> {
    await this.featureFlagRepository.update(flagId, updates);
    const flag = await this.featureFlagRepository.findOne({ where: { id: flagId } });
    
    if (flag) {
      await this.invalidateFeatureFlagCache(flag.key);
    }
    
    return flag!;
  }

  private async invalidateFeatureFlagCache(flagKey: string): Promise<void> {
    const patterns = [
      `feature_flag:${flagKey}:*`,
    ];
    
    for (const pattern of patterns) {
      await this.cacheService.deletePattern(pattern);
    }
  }
}
```

### Feature Flag Decorator

```typescript
// src/features/config/decorators/feature-flag.decorator.ts
import { SetMetadata, applyDecorators } from '@nestjs/common';
import { UseGuards } from '@nestjs/common';
import { FeatureFlagGuard } from '../guards/feature-flag.guard';

export const FEATURE_FLAG_KEY = 'feature_flag';

export function RequireFeatureFlag(flagKey: string, defaultValue: boolean = false) {
  return applyDecorators(
    SetMetadata(FEATURE_FLAG_KEY, { flagKey, defaultValue }),
    UseGuards(FeatureFlagGuard),
  );
}

// Usage example:
// @RequireFeatureFlag('user.dashboard.new_ui')
// @Get('dashboard')
// async getDashboard() { ... }
```

### Feature Flag Guard

```typescript
// src/features/config/guards/feature-flag.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureFlagService } from '../services/feature-flag.service';
import { FEATURE_FLAG_KEY } from '../decorators/feature-flag.decorator';

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private featureFlagService: FeatureFlagService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const featureFlagMeta = this.reflector.getAllAndOverride(FEATURE_FLAG_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!featureFlagMeta) {
      return true; // No feature flag requirement
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    const flagContext = {
      userId: user?.id,
      tenantId: user?.tenantId,
      userAttributes: user?.attributes,
      environment: process.env.NODE_ENV,
    };

    const isEnabled = await this.featureFlagService.isFeatureEnabled(
      featureFlagMeta.flagKey,
      flagContext
    );

    if (!isEnabled && !featureFlagMeta.defaultValue) {
      throw new ForbiddenException('Feature not available');
    }

    return true;
  }
}
```

## Environment Configuration

### Environment Configuration Service

```typescript
// src/features/config/services/environment-config.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import * as Joi from 'joi';

@Injectable()
export class EnvironmentConfigService {
  private configSchema = Joi.object({
    NODE_ENV: Joi.string().valid('development', 'staging', 'production').required(),
    PORT: Joi.number().default(3000),
    
    // Database
    DATABASE_URL: Joi.string().required(),
    DATABASE_SSL: Joi.boolean().default(false),
    
    // Redis
    REDIS_URL: Joi.string().required(),
    
    // JWT
    JWT_SECRET: Joi.string().min(32).required(),
    JWT_EXPIRES_IN: Joi.string().default('15m'),
    JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
    
    // Email
    SMTP_HOST: Joi.string().required(),
    SMTP_PORT: Joi.number().default(587),
    SMTP_USERNAME: Joi.string().required(),
    SMTP_PASSWORD: Joi.string().required(),
    SMTP_FROM: Joi.string().email().required(),
    
    // Storage
    MINIO_ENDPOINT: Joi.string().required(),
    MINIO_ACCESS_KEY: Joi.string().required(),
    MINIO_SECRET_KEY: Joi.string().required(),
    MINIO_BUCKET: Joi.string().default('aegisx-storage'),
    
    // Feature Flags
    ENABLE_FEATURE_FLAGS: Joi.boolean().default(true),
    
    // Security
    BCRYPT_ROUNDS: Joi.number().min(10).max(15).default(12),
    RATE_LIMIT_WINDOW: Joi.number().default(15 * 60 * 1000), // 15 minutes
    RATE_LIMIT_MAX: Joi.number().default(100),
    
    // Monitoring
    ENABLE_METRICS: Joi.boolean().default(true),
    METRICS_PORT: Joi.number().default(9090),
  });

  constructor(private nestConfigService: NestConfigService) {
    this.validateConfiguration();
  }

  private validateConfiguration(): void {
    const config = this.getAllConfig();
    const { error } = this.configSchema.validate(config, {
      allowUnknown: true,
      abortEarly: false,
    });

    if (error) {
      throw new Error(`Configuration validation failed: ${error.message}`);
    }
  }

  get<T = any>(key: string, defaultValue?: T): T {
    return this.nestConfigService.get<T>(key, defaultValue);
  }

  getOrThrow<T = any>(key: string): T {
    const value = this.nestConfigService.get<T>(key);
    if (value === undefined || value === null) {
      throw new Error(`Configuration key "${key}" is required but not set`);
    }
    return value;
  }

  private getAllConfig(): Record<string, any> {
    return process.env;
  }

  isDevelopment(): boolean {
    return this.get('NODE_ENV') === 'development';
  }

  isProduction(): boolean {
    return this.get('NODE_ENV') === 'production';
  }

  isStaging(): boolean {
    return this.get('NODE_ENV') === 'staging';
  }

  getDatabaseConfig() {
    return {
      url: this.getOrThrow('DATABASE_URL'),
      ssl: this.get('DATABASE_SSL', false),
      logging: this.isDevelopment(),
      synchronize: this.isDevelopment(),
    };
  }

  getRedisConfig() {
    return {
      url: this.getOrThrow('REDIS_URL'),
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
    };
  }

  getJwtConfig() {
    return {
      secret: this.getOrThrow('JWT_SECRET'),
      signOptions: {
        expiresIn: this.get('JWT_EXPIRES_IN', '15m'),
      },
      refreshExpiresIn: this.get('JWT_REFRESH_EXPIRES_IN', '7d'),
    };
  }
}
```

## System Settings

### System Settings Service

```typescript
// src/features/config/services/system-settings.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemSetting } from '../entities/system-setting.entity';
import { CacheService } from '../../../core/cache/cache.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as Joi from 'joi';

@Injectable()
export class SystemSettingsService {
  private settingsCache = new Map<string, any>();

  constructor(
    @InjectRepository(SystemSetting)
    private settingsRepository: Repository<SystemSetting>,
    private cacheService: CacheService,
    private eventEmitter: EventEmitter2,
  ) {
    this.loadSettingsIntoCache();
  }

  async getSetting<T = any>(key: string, defaultValue?: T): Promise<T> {
    // Check memory cache first
    if (this.settingsCache.has(key)) {
      return this.settingsCache.get(key);
    }

    // Check Redis cache
    const cacheKey = `system_setting:${key}`;
    let setting = await this.cacheService.get<SystemSetting>(cacheKey);

    if (!setting) {
      // Load from database
      setting = await this.settingsRepository.findOne({
        where: { key, environment: process.env.NODE_ENV || 'development' },
      });

      if (setting) {
        await this.cacheService.set(cacheKey, setting, 3600); // Cache for 1 hour
      }
    }

    const value = setting ? this.deserializeValue(setting.value, setting.type) : defaultValue;
    
    // Store in memory cache
    this.settingsCache.set(key, value);
    
    return value;
  }

  async getPublicSettings(): Promise<Record<string, any>> {
    const publicSettings = await this.settingsRepository.find({
      where: { 
        isPublic: true, 
        environment: process.env.NODE_ENV || 'development' 
      },
    });

    const result: Record<string, any> = {};
    for (const setting of publicSettings) {
      result[setting.key] = this.deserializeValue(setting.value, setting.type);
    }

    return result;
  }

  async updateSetting(
    key: string, 
    value: any, 
    updatedBy: string
  ): Promise<SystemSetting> {
    const setting = await this.settingsRepository.findOne({
      where: { key, environment: process.env.NODE_ENV || 'development' },
    });

    if (!setting) {
      throw new Error(`Setting "${key}" not found`);
    }

    // Validate value
    if (setting.validationSchema) {
      const schema = this.parseValidationSchema(setting.validationSchema);
      const { error } = schema.validate(value);
      if (error) {
        throw new Error(`Validation failed: ${error.message}`);
      }
    }

    // Serialize value
    const serializedValue = this.serializeValue(value, setting.type);

    // Update setting
    await this.settingsRepository.update(setting.id, {
      value: serializedValue,
      updatedBy,
      updatedAt: new Date(),
    });

    // Clear caches
    await this.invalidateSettingCache(key);

    // Emit event for real-time updates
    this.eventEmitter.emit('system.setting.updated', {
      key,
      value,
      oldValue: this.deserializeValue(setting.value, setting.type),
      requiresRestart: setting.requiresRestart,
    });

    return await this.settingsRepository.findOne({ where: { id: setting.id } })!;
  }

  async createSetting(settingData: Partial<SystemSetting>): Promise<SystemSetting> {
    const setting = this.settingsRepository.create({
      ...settingData,
      environment: settingData.environment || process.env.NODE_ENV || 'development',
    });

    return await this.settingsRepository.save(setting);
  }

  private async loadSettingsIntoCache(): Promise<void> {
    const settings = await this.settingsRepository.find({
      where: { environment: process.env.NODE_ENV || 'development' },
    });

    for (const setting of settings) {
      const value = this.deserializeValue(setting.value, setting.type);
      this.settingsCache.set(setting.key, value);
    }
  }

  private async invalidateSettingCache(key: string): Promise<void> {
    this.settingsCache.delete(key);
    await this.cacheService.delete(`system_setting:${key}`);
  }

  private serializeValue(value: any, type: string): string {
    switch (type) {
      case 'string':
        return String(value);
      case 'number':
        return String(Number(value));
      case 'boolean':
        return String(Boolean(value));
      case 'json':
        return JSON.stringify(value);
      case 'encrypted':
        // Implement encryption here
        return this.encrypt(String(value));
      default:
        return String(value);
    }
  }

  private deserializeValue(value: string, type: string): any {
    switch (type) {
      case 'string':
        return value;
      case 'number':
        return Number(value);
      case 'boolean':
        return value === 'true';
      case 'json':
        try {
          return JSON.parse(value);
        } catch {
          return null;
        }
      case 'encrypted':
        return this.decrypt(value);
      default:
        return value;
    }
  }

  private parseValidationSchema(schema: any): Joi.Schema {
    // Convert stored schema to Joi schema
    // This is a simplified implementation
    return Joi.any();
  }

  private encrypt(value: string): string {
    // Implement encryption
    return value; // Placeholder
  }

  private decrypt(value: string): string {
    // Implement decryption
    return value; // Placeholder
  }
}
```

## Theme & Branding

### Tenant Branding Service

```typescript
// src/features/config/services/tenant-branding.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantConfiguration } from '../entities/tenant-configuration.entity';
import { StorageService } from '../../../core/storage/storage.service';

interface BrandingConfig {
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  customCss?: string;
  favicon?: string;
  appName?: string;
  customDomain?: string;
  emailTemplateStyle?: {
    headerColor?: string;
    buttonColor?: string;
    fontFamily?: string;
  };
}

@Injectable()
export class TenantBrandingService {
  constructor(
    @InjectRepository(TenantConfiguration)
    private configRepository: Repository<TenantConfiguration>,
    private storageService: StorageService,
  ) {}

  async getBranding(tenantId: string): Promise<BrandingConfig> {
    const config = await this.configRepository.findOne({
      where: { tenantId, category: 'branding' },
    });

    return config?.branding || this.getDefaultBranding();
  }

  async updateBranding(
    tenantId: string, 
    branding: Partial<BrandingConfig>,
    updatedBy: string
  ): Promise<BrandingConfig> {
    let config = await this.configRepository.findOne({
      where: { tenantId, category: 'branding' },
    });

    if (!config) {
      config = this.configRepository.create({
        tenantId,
        category: 'branding',
        settings: {},
        branding: {},
      });
    }

    // Validate colors
    if (branding.primaryColor) {
      this.validateColor(branding.primaryColor);
    }
    if (branding.secondaryColor) {
      this.validateColor(branding.secondaryColor);
    }

    // Update branding
    config.branding = {
      ...config.branding,
      ...branding,
    };

    config.updatedBy = updatedBy;
    config.updatedAt = new Date();

    await this.configRepository.save(config);

    return config.branding;
  }

  async uploadLogo(
    tenantId: string, 
    file: Express.Multer.File
  ): Promise<string> {
    // Validate image
    if (!this.isValidImageFile(file)) {
      throw new Error('Invalid image file');
    }

    // Upload to storage
    const fileName = `tenants/${tenantId}/branding/logo-${Date.now()}.${this.getFileExtension(file.originalname)}`;
    
    const uploadResult = await this.storageService.uploadFile({
      fileName,
      fileBuffer: file.buffer,
      contentType: file.mimetype,
      isPublic: true,
    });

    return uploadResult.url;
  }

  async generateCSS(tenantId: string): Promise<string> {
    const branding = await this.getBranding(tenantId);

    return `
      :root {
        --primary-color: ${branding.primaryColor || '#007bff'};
        --secondary-color: ${branding.secondaryColor || '#6c757d'};
        --logo-url: url('${branding.logoUrl || ''}');
      }

      .navbar-brand img {
        max-height: 40px;
        width: auto;
      }

      .btn-primary {
        background-color: var(--primary-color);
        border-color: var(--primary-color);
      }

      .btn-primary:hover {
        background-color: color-mix(in srgb, var(--primary-color) 85%, black);
        border-color: color-mix(in srgb, var(--primary-color) 85%, black);
      }

      ${branding.customCss || ''}
    `;
  }

  private getDefaultBranding(): BrandingConfig {
    return {
      primaryColor: '#007bff',
      secondaryColor: '#6c757d',
      appName: 'AegisX Platform',
    };
  }

  private validateColor(color: string): void {
    const colorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    if (!colorRegex.test(color)) {
      throw new Error('Invalid color format. Use hex color (e.g., #FF0000)');
    }
  }

  private isValidImageFile(file: Express.Multer.File): boolean {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/svg+xml'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    return allowedTypes.includes(file.mimetype) && file.size <= maxSize;
  }

  private getFileExtension(filename: string): string {
    return filename.split('.').pop()?.toLowerCase() || '';
  }
}
```

## Configuration API

### Configuration Controller

```typescript
// src/features/config/controllers/config.controller.ts
import { Controller, Get, Post, Put, Body, Param, UseGuards, Request, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { RequireRole } from '../../auth/decorators/require-role.decorator';
import { FeatureFlagService } from '../services/feature-flag.service';
import { SystemSettingsService } from '../services/system-settings.service';
import { TenantBrandingService } from '../services/tenant-branding.service';

@Controller('config')
@UseGuards(JwtAuthGuard)
export class ConfigController {
  constructor(
    private featureFlagService: FeatureFlagService,
    private systemSettingsService: SystemSettingsService,
    private tenantBrandingService: TenantBrandingService,
  ) {}

  @Get('features/:flagKey')
  async getFeatureFlag(@Param('flagKey') flagKey: string, @Request() req) {
    const context = {
      userId: req.user.id,
      tenantId: req.user.tenantId,
      userAttributes: req.user.attributes,
      environment: process.env.NODE_ENV,
    };

    const isEnabled = await this.featureFlagService.isFeatureEnabled(flagKey, context);
    const value = await this.featureFlagService.getFeatureFlagValue(flagKey, context);

    return { enabled: isEnabled, value };
  }

  @Get('settings/public')
  async getPublicSettings() {
    return await this.systemSettingsService.getPublicSettings();
  }

  @Get('settings/:key')
  @UseGuards(RolesGuard)
  @RequireRole('admin')
  async getSetting(@Param('key') key: string) {
    const value = await this.systemSettingsService.getSetting(key);
    return { key, value };
  }

  @Put('settings/:key')
  @UseGuards(RolesGuard)
  @RequireRole('admin')
  async updateSetting(
    @Param('key') key: string,
    @Body() body: { value: any },
    @Request() req
  ) {
    const setting = await this.systemSettingsService.updateSetting(
      key, 
      body.value, 
      req.user.id
    );
    return setting;
  }

  @Get('branding')
  async getBranding(@Request() req) {
    return await this.tenantBrandingService.getBranding(req.user.tenantId);
  }

  @Put('branding')
  @UseGuards(RolesGuard)
  @RequireRole('tenant_admin')
  async updateBranding(@Body() branding: any, @Request() req) {
    return await this.tenantBrandingService.updateBranding(
      req.user.tenantId,
      branding,
      req.user.id
    );
  }

  @Post('branding/logo')
  @UseGuards(RolesGuard)
  @RequireRole('tenant_admin')
  @UseInterceptors(FileInterceptor('logo'))
  async uploadLogo(@UploadedFile() file: Express.Multer.File, @Request() req) {
    const logoUrl = await this.tenantBrandingService.uploadLogo(req.user.tenantId, file);
    return { logoUrl };
  }

  @Get('branding/css')
  async getBrandingCSS(@Request() req) {
    const css = await this.tenantBrandingService.generateCSS(req.user.tenantId);
    return { css };
  }

  // Admin endpoints for feature flags
  @Post('admin/features')
  @UseGuards(RolesGuard)
  @RequireRole('system_admin')
  async createFeatureFlag(@Body() flagData: any, @Request() req) {
    return await this.featureFlagService.createFeatureFlag({
      ...flagData,
      createdBy: req.user.id,
    });
  }

  @Put('admin/features/:flagId')
  @UseGuards(RolesGuard)
  @RequireRole('system_admin')
  async updateFeatureFlag(@Param('flagId') flagId: string, @Body() updates: any) {
    return await this.featureFlagService.updateFeatureFlag(flagId, updates);
  }
}
```

## Testing Strategy

### Configuration Tests

```typescript
// src/features/config/services/feature-flag.service.spec.ts
describe('FeatureFlagService', () => {
  let service: FeatureFlagService;
  let repository: jest.Mocked<Repository<FeatureFlag>>;
  let cacheService: jest.Mocked<CacheService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        FeatureFlagService,
        {
          provide: getRepositoryToken(FeatureFlag),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            deletePattern: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<FeatureFlagService>(FeatureFlagService);
    repository = module.get(getRepositoryToken(FeatureFlag));
    cacheService = module.get(CacheService);
  });

  describe('isFeatureEnabled', () => {
    it('should return true when feature is enabled', async () => {
      const flag = {
        id: '1',
        key: 'test.feature',
        isActive: true,
        rolloutPercentage: 100,
        defaultValue: true,
        type: 'boolean',
        environment: 'development',
      } as FeatureFlag;

      repository.findOne.mockResolvedValue(flag);

      const result = await service.isFeatureEnabled('test.feature', {
        userId: 'user1',
        environment: 'development',
      });

      expect(result).toBe(true);
    });

    it('should respect rollout percentage', async () => {
      const flag = {
        id: '1',
        key: 'test.feature',
        isActive: true,
        rolloutPercentage: 50,
        defaultValue: true,
        type: 'boolean',
        environment: 'development',
      } as FeatureFlag;

      repository.findOne.mockResolvedValue(flag);

      // Test with deterministic user ID that should be in 50% rollout
      const result = await service.isFeatureEnabled('test.feature', {
        userId: 'user1',
        environment: 'development',
      });

      expect(typeof result).toBe('boolean');
    });

    it('should check target audience', async () => {
      const flag = {
        id: '1',
        key: 'test.feature',
        isActive: true,
        rolloutPercentage: 100,
        defaultValue: true,
        type: 'boolean',
        environment: 'development',
        targetAudience: {
          userIds: ['user1', 'user2'],
        },
      } as FeatureFlag;

      repository.findOne.mockResolvedValue(flag);

      const result1 = await service.isFeatureEnabled('test.feature', {
        userId: 'user1',
        environment: 'development',
      });

      const result2 = await service.isFeatureEnabled('test.feature', {
        userId: 'user3',
        environment: 'development',
      });

      expect(result1).toBe(true);
      expect(result2).toBe(false);
    });
  });
});
```
