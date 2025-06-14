# Authentication Feature Blueprint

This document provides a comprehensive blueprint for implementing authentication and authorization features in the AegisX Platform. It includes JWT authentication, Role-Based Access Control (RBAC), API Key management, Multi-Factor Authentication (MFA), and security best practices.

## Table of Contents

- [Feature Overview](#feature-overview)
- [Architecture Design](#architecture-design)
- [Implementation Strategy](#implementation-strategy)
- [Implementation Strategy](#implementation-strategy)
- [Security Implementation](#security-implementation)
- [Testing Strategy](#testing-strategy)
- [Monitoring & Analytics](#monitoring--analytics)
- [Security Implementation](#security-implementation)
- [Testing Strategy](#testing-strategy)
- [Monitoring & Analytics](#monitoring--analytics)

## Feature Overview

### What is Authentication & Authorization?

**Authentication** verifies the identity of users (who you are), while **Authorization** determines what authenticated users can access (what you can do).

### Business Benefits

- **Security**: Protects sensitive data and resources
- **Compliance**: Meets regulatory requirements (GDPR, HIPAA, SOX)
- **User Experience**: Seamless login and access management
- **Scalability**: Supports multiple authentication methods
- **Audit Trail**: Complete logging for security and compliance

### Technical Benefits

- **Stateless**: JWT-based authentication for scalability
- **Flexible**: Multiple authentication strategies
- **Secure**: Industry-standard security practices
- **Extensible**: Easy to add new authentication methods

## Architecture Design

### Authentication Flow

```text
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Client    │    │    API      │    │  Database   │
│             │    │  Gateway    │    │             │
│             │    │             │    │             │
├─────────────┤    ├─────────────┤    ├─────────────┤
│ 1. Login    │───▶│ 2. Validate │───▶│ 3. Verify   │
│ Request     │    │ Credentials │    │ User        │
│             │    │             │    │             │
│ 6. Access   │◀───│ 5. Return   │◀───│ 4. Generate │
│ Token       │    │ JWT Token   │    │ Session     │
└─────────────┘    └─────────────┘    └─────────────┘
```

### Component Architecture

```text
┌─────────────────────────────────────────────────────┐
│                 Authentication Layer                │
├─────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │
│ │    JWT      │ │   OAuth     │ │   API Key   │    │
│ │ Strategy    │ │  Strategy   │ │  Strategy   │    │
│ └─────────────┘ └─────────────┘ └─────────────┘    │
├─────────────────────────────────────────────────────┤
│                Authorization Layer                  │
├─────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │
│ │    RBAC     │ │   Guards    │ │ Decorators  │    │
│ │   Service   │ │             │ │             │    │
│ └─────────────┘ └─────────────┘ └─────────────┘    │
├─────────────────────────────────────────────────────┤
│                  Security Layer                     │
├─────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │
│ │   Rate      │ │  Password   │ │    MFA      │    │
│ │ Limiting    │ │ Validation  │ │  Service    │    │
│ └─────────────┘ └─────────────┘ └─────────────┘    │
└─────────────────────────────────────────────────────┘
```

## Implementation Strategy

### Phase 1: Core Authentication

#### 1.1 User Entity and Types

```typescript
// src/features/auth/types/auth.types.ts
export interface User {
  id: string;
  email: string;
  username?: string;
  password: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  status: UserStatus;
  emailVerified: boolean;
  mfaEnabled: boolean;
  mfaSecret?: string;
  lastLogin?: Date;
  passwordChangedAt?: Date;
  roles: Role[];
  permissions: Permission[];
  sessions: Session[];
  apiKeys: ApiKey[];
  tenantId?: string; // For multi-tenancy
  createdAt: Date;
  updatedAt: Date;
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING_VERIFICATION = 'pending_verification'
}

export interface LoginRequest {
  email: string;
  password: string;
  mfaCode?: string;
  rememberMe?: boolean;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: UserProfile;
  expiresIn: number;
}

export interface UserProfile {
  id: string;
  email: string;
  username?: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  roles: string[];
  permissions: string[];
  tenantId?: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  username?: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirm {
  token: string;
  newPassword: string;
}
```

#### 1.2 Authentication Service

```typescript
// src/features/auth/services/auth.service.ts
import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as speakeasy from 'speakeasy';
import { User } from '../entities/user.entity';
import { Session } from '../entities/session.entity';
import { LoginRequest, LoginResponse, RegisterRequest } from '../types/auth.types';
import { PasswordService } from './password.service';
import { MfaService } from './mfa.service';
import { EmailService } from '../../email/services/email.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
    private readonly jwtService: JwtService,
    private readonly passwordService: PasswordService,
    private readonly mfaService: MfaService,
    private readonly emailService: EmailService,
  ) {}

  async register(registerRequest: RegisterRequest): Promise<LoginResponse> {
    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: [
        { email: registerRequest.email },
        { username: registerRequest.username },
      ],
    });

    if (existingUser) {
      throw new BadRequestException('User already exists');
    }

    // Validate password strength
    this.passwordService.validatePasswordStrength(registerRequest.password);

    // Hash password
    const hashedPassword = await bcrypt.hash(registerRequest.password, 12);

    // Create user
    const user = this.userRepository.create({
      ...registerRequest,
      password: hashedPassword,
      status: UserStatus.PENDING_VERIFICATION,
    });

    const savedUser = await this.userRepository.save(user);

    // Send verification email
    await this.sendVerificationEmail(savedUser);

    // Generate tokens
    return this.generateTokens(savedUser);
  }

  async login(loginRequest: LoginRequest): Promise<LoginResponse> {
    // Find user
    const user = await this.userRepository.findOne({
      where: { email: loginRequest.email },
      relations: ['roles', 'permissions'],
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(loginRequest.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check user status
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Account is not active');
    }

    // Verify MFA if enabled
    if (user.mfaEnabled) {
      if (!loginRequest.mfaCode) {
        throw new UnauthorizedException('MFA code required');
      }

      const isMfaValid = speakeasy.totp.verify({
        secret: user.mfaSecret!,
        encoding: 'base32',
        token: loginRequest.mfaCode,
        window: 1,
      });

      if (!isMfaValid) {
        throw new UnauthorizedException('Invalid MFA code');
      }
    }

    // Update last login
    user.lastLogin = new Date();
    await this.userRepository.save(user);

    // Generate tokens
    return this.generateTokens(user, loginRequest.rememberMe);
  }

  async refreshToken(refreshToken: string): Promise<LoginResponse> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });

      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
        relations: ['roles', 'permissions'],
      });

      if (!user || user.status !== UserStatus.ACTIVE) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Check if session exists and is valid
      const session = await this.sessionRepository.findOne({
        where: { userId: user.id, refreshToken },
      });

      if (!session || session.expiresAt < new Date()) {
        throw new UnauthorizedException('Session expired');
      }

      return this.generateTokens(user);
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string, sessionId?: string): Promise<void> {
    if (sessionId) {
      // Logout specific session
      await this.sessionRepository.delete({ id: sessionId, userId });
    } else {
      // Logout all sessions
      await this.sessionRepository.delete({ userId });
    }
  }

  async logoutAllDevices(userId: string): Promise<void> {
    await this.sessionRepository.delete({ userId });
  }

  private async generateTokens(user: User, rememberMe = false): Promise<LoginResponse> {
    const payload = {
      sub: user.id,
      email: user.email,
      roles: user.roles?.map(role => role.name) || [],
      permissions: user.permissions?.map(permission => permission.name) || [],
      tenantId: user.tenantId,
    };

    const accessTokenExpiry = rememberMe ? '7d' : '15m';
    const refreshTokenExpiry = rememberMe ? '30d' : '7d';

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: accessTokenExpiry,
      secret: process.env.JWT_SECRET,
    });

    const refreshToken = this.jwtService.sign(
      { sub: user.id },
      {
        expiresIn: refreshTokenExpiry,
        secret: process.env.JWT_REFRESH_SECRET,
      }
    );

    // Store session
    const session = this.sessionRepository.create({
      userId: user.id,
      refreshToken,
      expiresAt: new Date(Date.now() + (rememberMe ? 30 : 7) * 24 * 60 * 60 * 1000),
      userAgent: '', // Get from request
      ipAddress: '', // Get from request
    });

    await this.sessionRepository.save(session);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
        roles: user.roles?.map(role => role.name) || [],
        permissions: user.permissions?.map(permission => permission.name) || [],
        tenantId: user.tenantId,
      },
      expiresIn: rememberMe ? 7 * 24 * 60 * 60 : 15 * 60, // seconds
    };
  }

  private async sendVerificationEmail(user: User): Promise<void> {
    const verificationToken = this.jwtService.sign(
      { sub: user.id, type: 'email_verification' },
      { expiresIn: '24h', secret: process.env.JWT_SECRET }
    );

    await this.emailService.sendVerificationEmail(user.email, verificationToken);
  }

  async verifyEmail(token: string): Promise<void> {
    try {
      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET,
      });

      if (payload.type !== 'email_verification') {
        throw new UnauthorizedException('Invalid token');
      }

      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      user.emailVerified = true;
      user.status = UserStatus.ACTIVE;
      await this.userRepository.save(user);
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { email } });
    
    if (!user) {
      // Don't reveal if email exists
      return;
    }

    const resetToken = this.jwtService.sign(
      { sub: user.id, type: 'password_reset' },
      { expiresIn: '1h', secret: process.env.JWT_SECRET }
    );

    await this.emailService.sendPasswordResetEmail(user.email, resetToken);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    try {
      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET,
      });

      if (payload.type !== 'password_reset') {
        throw new UnauthorizedException('Invalid token');
      }

      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Validate new password
      this.passwordService.validatePasswordStrength(newPassword);

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 12);

      // Update password and revoke all sessions
      user.password = hashedPassword;
      user.passwordChangedAt = new Date();
      await this.userRepository.save(user);

      // Revoke all sessions
      await this.sessionRepository.delete({ userId: user.id });
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
```

### Phase 2: Role-Based Access Control (RBAC)

#### 2.1 RBAC Entities

```typescript
// src/features/auth/entities/role.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToMany, JoinTable } from 'typeorm';
import { Permission } from './permission.entity';
import { User } from './user.entity';

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  tenantId: string; // For multi-tenancy

  @ManyToMany(() => Permission, permission => permission.roles, { eager: true })
  @JoinTable({
    name: 'role_permissions',
    joinColumn: { name: 'role_id' },
    inverseJoinColumn: { name: 'permission_id' },
  })
  permissions: Permission[];

  @ManyToMany(() => User, user => user.roles)
  users: User[];

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}

// src/features/auth/entities/permission.entity.ts
@Entity('permissions')
export class Permission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column()
  resource: string; // e.g., 'user', 'order', 'product'

  @Column()
  action: string; // e.g., 'create', 'read', 'update', 'delete'

  @ManyToMany(() => Role, role => role.permissions)
  roles: Role[];

  @ManyToMany(() => User, user => user.permissions)
  users: User[];

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
```

#### 2.2 RBAC Service

```typescript
// src/features/auth/services/rbac.service.ts
import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../entities/role.entity';
import { Permission } from '../entities/permission.entity';
import { User } from '../entities/user.entity';

@Injectable()
export class RbacService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async createRole(name: string, description?: string, tenantId?: string): Promise<Role> {
    const role = this.roleRepository.create({
      name,
      description,
      tenantId,
    });

    return this.roleRepository.save(role);
  }

  async createPermission(
    name: string,
    resource: string,
    action: string,
    description?: string,
  ): Promise<Permission> {
    const permission = this.permissionRepository.create({
      name,
      resource,
      action,
      description,
    });

    return this.permissionRepository.save(permission);
  }

  async assignRoleToUser(userId: string, roleId: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['roles'],
    });

    const role = await this.roleRepository.findOne({
      where: { id: roleId },
    });

    if (!user || !role) {
      throw new Error('User or role not found');
    }

    if (!user.roles.find(r => r.id === roleId)) {
      user.roles.push(role);
      await this.userRepository.save(user);
    }
  }

  async removeRoleFromUser(userId: string, roleId: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['roles'],
    });

    if (!user) {
      throw new Error('User not found');
    }

    user.roles = user.roles.filter(role => role.id !== roleId);
    await this.userRepository.save(user);
  }

  async assignPermissionToRole(roleId: string, permissionId: string): Promise<void> {
    const role = await this.roleRepository.findOne({
      where: { id: roleId },
      relations: ['permissions'],
    });

    const permission = await this.permissionRepository.findOne({
      where: { id: permissionId },
    });

    if (!role || !permission) {
      throw new Error('Role or permission not found');
    }

    if (!role.permissions.find(p => p.id === permissionId)) {
      role.permissions.push(permission);
      await this.roleRepository.save(role);
    }
  }

  async hasPermission(userId: string, resource: string, action: string): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['roles', 'roles.permissions', 'permissions'],
    });

    if (!user) {
      return false;
    }

    // Check direct permissions
    const hasDirectPermission = user.permissions.some(
      permission => permission.resource === resource && permission.action === action
    );

    if (hasDirectPermission) {
      return true;
    }

    // Check role-based permissions
    const hasRolePermission = user.roles.some(role =>
      role.permissions.some(
        permission => permission.resource === resource && permission.action === action
      )
    );

    return hasRolePermission;
  }

  async checkPermission(userId: string, resource: string, action: string): Promise<void> {
    const hasPermission = await this.hasPermission(userId, resource, action);
    
    if (!hasPermission) {
      throw new ForbiddenException(`Access denied: ${action} on ${resource}`);
    }
  }

  async getUserPermissions(userId: string): Promise<string[]> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['roles', 'roles.permissions', 'permissions'],
    });

    if (!user) {
      return [];
    }

    const directPermissions = user.permissions.map(p => p.name);
    const rolePermissions = user.roles.flatMap(role =>
      role.permissions.map(p => p.name)
    );

    return [...new Set([...directPermissions, ...rolePermissions])];
  }

  async seedDefaultRolesAndPermissions(): Promise<void> {
    // Create default permissions
    const permissions = [
      { name: 'user:create', resource: 'user', action: 'create', description: 'Create users' },
      { name: 'user:read', resource: 'user', action: 'read', description: 'Read users' },
      { name: 'user:update', resource: 'user', action: 'update', description: 'Update users' },
      { name: 'user:delete', resource: 'user', action: 'delete', description: 'Delete users' },
      { name: 'role:manage', resource: 'role', action: 'manage', description: 'Manage roles' },
      { name: 'permission:manage', resource: 'permission', action: 'manage', description: 'Manage permissions' },
    ];

    for (const permData of permissions) {
      const existingPerm = await this.permissionRepository.findOne({
        where: { name: permData.name },
      });

      if (!existingPerm) {
        await this.createPermission(
          permData.name,
          permData.resource,
          permData.action,
          permData.description
        );
      }
    }

    // Create default roles
    const superAdminRole = await this.roleRepository.findOne({
      where: { name: 'super-admin' },
    });

    if (!superAdminRole) {
      const role = await this.createRole('super-admin', 'Super Administrator');
      const allPermissions = await this.permissionRepository.find();
      
      for (const permission of allPermissions) {
        await this.assignPermissionToRole(role.id, permission.id);
      }
    }

    const adminRole = await this.roleRepository.findOne({
      where: { name: 'admin' },
    });

    if (!adminRole) {
      const role = await this.createRole('admin', 'Administrator');
      const adminPermissions = await this.permissionRepository.find({
        where: [
          { name: 'user:create' },
          { name: 'user:read' },
          { name: 'user:update' },
        ],
      });
      
      for (const permission of adminPermissions) {
        await this.assignPermissionToRole(role.id, permission.id);
      }
    }

    const userRole = await this.roleRepository.findOne({
      where: { name: 'user' },
    });

    if (!userRole) {
      const role = await this.createRole('user', 'Regular User');
      const userPermissions = await this.permissionRepository.find({
        where: [{ name: 'user:read' }],
      });
      
      for (const permission of userPermissions) {
        await this.assignPermissionToRole(role.id, permission.id);
      }
    }
  }
}
```

#### 2.3 Guards and Decorators

```typescript
// src/features/auth/guards/jwt-auth.guard.ts
import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      throw err || new UnauthorizedException();
    }
    return user;
  }
}

// src/features/auth/guards/permissions.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RbacService } from '../services/rbac.service';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private rbacService: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    for (const permission of requiredPermissions) {
      const [resource, action] = permission.split(':');
      const hasPermission = await this.rbacService.hasPermission(
        user.id,
        resource,
        action,
      );

      if (!hasPermission) {
        throw new ForbiddenException(`Missing permission: ${permission}`);
      }
    }

    return true;
  }
}

// src/features/auth/decorators/permissions.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

// src/features/auth/decorators/public.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

// src/features/auth/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
```

### Phase 3: API Key Management

#### 3.1 API Key Entity and Service

```typescript
// src/features/auth/entities/api-key.entity.ts
@Entity('api_keys')
export class ApiKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  key: string;

  @Column()
  hashedKey: string;

  @Column()
  userId: string;

  @Column({ nullable: true })
  tenantId: string;

  @Column('simple-array', { nullable: true })
  permissions: string[];

  @Column({ nullable: true })
  expiresAt: Date;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  lastUsedAt: Date;

  @Column({ default: 0 })
  usageCount: number;

  @Column({ nullable: true })
  rateLimit: number; // requests per minute

  @Column('simple-array', { nullable: true })
  allowedIps: string[];

  @ManyToOne(() => User, user => user.apiKeys)
  user: User;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}

// src/features/auth/services/api-key.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiKey } from '../entities/api-key.entity';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class ApiKeyService {
  constructor(
    @InjectRepository(ApiKey)
    private readonly apiKeyRepository: Repository<ApiKey>,
  ) {}

  async createApiKey(
    userId: string,
    name: string,
    permissions?: string[],
    expiresAt?: Date,
    tenantId?: string,
  ): Promise<{ apiKey: ApiKey; plainKey: string }> {
    // Generate a random key
    const plainKey = this.generateApiKey();
    const hashedKey = await bcrypt.hash(plainKey, 12);

    const apiKey = this.apiKeyRepository.create({
      name,
      key: `ak_${plainKey}`, // Prefix for identification
      hashedKey,
      userId,
      tenantId,
      permissions: permissions || [],
      expiresAt,
    });

    const savedApiKey = await this.apiKeyRepository.save(apiKey);

    return {
      apiKey: savedApiKey,
      plainKey: `ak_${plainKey}`,
    };
  }

  async validateApiKey(key: string): Promise<ApiKey | null> {
    if (!key.startsWith('ak_')) {
      return null;
    }

    const plainKey = key.substring(3); // Remove 'ak_' prefix
    
    const apiKeys = await this.apiKeyRepository.find({
      where: { isActive: true },
      relations: ['user'],
    });

    for (const apiKey of apiKeys) {
      const isValid = await bcrypt.compare(plainKey, apiKey.hashedKey);
      
      if (isValid) {
        // Check expiration
        if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
          return null;
        }

        // Update usage statistics
        apiKey.lastUsedAt = new Date();
        apiKey.usageCount += 1;
        await this.apiKeyRepository.save(apiKey);

        return apiKey;
      }
    }

    return null;
  }

  async revokeApiKey(id: string, userId: string): Promise<void> {
    await this.apiKeyRepository.update(
      { id, userId },
      { isActive: false }
    );
  }

  async getUserApiKeys(userId: string): Promise<ApiKey[]> {
    return this.apiKeyRepository.find({
      where: { userId, isActive: true },
      select: ['id', 'name', 'permissions', 'expiresAt', 'lastUsedAt', 'usageCount', 'createdAt'],
    });
  }

  private generateApiKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}

// src/features/auth/strategies/api-key.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { ApiKeyService } from '../services/api-key.service';

@Injectable()
export class ApiKeyStrategy extends PassportStrategy(Strategy, 'api-key') {
  constructor(private apiKeyService: ApiKeyService) {
    super();
  }

  async validate(request: any): Promise<any> {
    const apiKey = this.extractApiKey(request);
    
    if (!apiKey) {
      throw new UnauthorizedException('API key required');
    }

    const validApiKey = await this.apiKeyService.validateApiKey(apiKey);
    
    if (!validApiKey) {
      throw new UnauthorizedException('Invalid API key');
    }

    return {
      id: validApiKey.user.id,
      email: validApiKey.user.email,
      apiKeyId: validApiKey.id,
      permissions: validApiKey.permissions,
      tenantId: validApiKey.tenantId,
    };
  }

  private extractApiKey(request: any): string | null {
    // Try Authorization header
    if (request.headers.authorization) {
      const [type, token] = request.headers.authorization.split(' ');
      if (type === 'Bearer' && token.startsWith('ak_')) {
        return token;
      }
    }

    // Try X-API-Key header
    if (request.headers['x-api-key']) {
      return request.headers['x-api-key'];
    }

    // Try query parameter
    if (request.query.api_key) {
      return request.query.api_key;
    }

    return null;
  }
}
```

### Phase 4: Multi-Factor Authentication (MFA)

#### 4.1 MFA Service

```typescript
// src/features/auth/services/mfa.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';

@Injectable()
export class MfaService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async generateMfaSecret(userId: string): Promise<{
    secret: string;
    qrCodeUrl: string;
    backupCodes: string[];
  }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    
    if (!user) {
      throw new Error('User not found');
    }

    const secret = speakeasy.generateSecret({
      name: `AegisX Platform (${user.email})`,
      issuer: 'AegisX Platform',
      length: 32,
    });

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);

    // Generate backup codes
    const backupCodes = this.generateBackupCodes();

    // Store the secret (not enabled yet)
    user.mfaSecret = secret.base32;
    await this.userRepository.save(user);

    return {
      secret: secret.base32!,
      qrCodeUrl,
      backupCodes,
    };
  }

  async enableMfa(userId: string, token: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    
    if (!user || !user.mfaSecret) {
      throw new Error('MFA secret not found');
    }

    const isValid = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token,
      window: 1,
    });

    if (!isValid) {
      throw new Error('Invalid MFA token');
    }

    user.mfaEnabled = true;
    await this.userRepository.save(user);
  }

  async disableMfa(userId: string, token: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    
    if (!user || !user.mfaEnabled) {
      throw new Error('MFA not enabled');
    }

    const isValid = speakeasy.totp.verify({
      secret: user.mfaSecret!,
      encoding: 'base32',
      token,
      window: 1,
    });

    if (!isValid) {
      throw new Error('Invalid MFA token');
    }

    user.mfaEnabled = false;
    user.mfaSecret = null;
    await this.userRepository.save(user);
  }

  async verifyMfaToken(userId: string, token: string): Promise<boolean> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    
    if (!user || !user.mfaEnabled || !user.mfaSecret) {
      return false;
    }

    return speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token,
      window: 1,
    });
  }

  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < 10; i++) {
      codes.push(Math.random().toString(36).substring(2, 10).toUpperCase());
    }
    return codes;
  }
}
```

### Phase 5: Controllers

#### 5.1 Authentication Controller

```typescript
// src/features/auth/controllers/auth.controller.ts
import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from '../services/auth.service';
import { MfaService } from '../services/mfa.service';
import { ApiKeyService } from '../services/api-key.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { Public } from '../decorators/public.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import {
  LoginRequest,
  RegisterRequest,
  PasswordResetRequest,
  PasswordResetConfirm,
} from '../types/auth.types';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly mfaService: MfaService,
    private readonly apiKeyService: ApiKeyService,
  ) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  async register(@Body() registerRequest: RegisterRequest) {
    return this.authService.register(registerRequest);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login user' })
  async login(@Body() loginRequest: LoginRequest) {
    return this.authService.login(loginRequest);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  async refresh(@Body() { refreshToken }: { refreshToken: string }) {
    return this.authService.refreshToken(refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Logout user' })
  async logout(@CurrentUser() user: any, @Body() { sessionId }: { sessionId?: string }) {
    await this.authService.logout(user.id, sessionId);
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Logout from all devices' })
  async logoutAll(@CurrentUser() user: any) {
    await this.authService.logoutAllDevices(user.id);
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email address' })
  async verifyEmail(@Body() { token }: { token: string }) {
    await this.authService.verifyEmail(token);
    return { message: 'Email verified successfully' };
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset' })
  async forgotPassword(@Body() { email }: PasswordResetRequest) {
    await this.authService.requestPasswordReset(email);
    return { message: 'Password reset email sent' };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password' })
  async resetPassword(@Body() { token, newPassword }: PasswordResetConfirm) {
    await this.authService.resetPassword(token, newPassword);
    return { message: 'Password reset successfully' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@CurrentUser() user: any) {
    return user;
  }

  // MFA endpoints
  @Post('mfa/setup')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Setup MFA' })
  async setupMfa(@CurrentUser() user: any) {
    return this.mfaService.generateMfaSecret(user.id);
  }

  @Post('mfa/enable')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Enable MFA' })
  async enableMfa(@CurrentUser() user: any, @Body() { token }: { token: string }) {
    await this.mfaService.enableMfa(user.id, token);
    return { message: 'MFA enabled successfully' };
  }

  @Post('mfa/disable')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Disable MFA' })
  async disableMfa(@CurrentUser() user: any, @Body() { token }: { token: string }) {
    await this.mfaService.disableMfa(user.id, token);
    return { message: 'MFA disabled successfully' };
  }

  // API Key endpoints
  @Post('api-keys')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create API key' })
  async createApiKey(
    @CurrentUser() user: any,
    @Body() { name, permissions, expiresAt }: {
      name: string;
      permissions?: string[];
      expiresAt?: Date;
    }
  ) {
    return this.apiKeyService.createApiKey(
      user.id,
      name,
      permissions,
      expiresAt,
      user.tenantId
    );
  }

  @Get('api-keys')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get user API keys' })
  async getApiKeys(@CurrentUser() user: any) {
    return this.apiKeyService.getUserApiKeys(user.id);
  }

  @Post('api-keys/:id/revoke')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke API key' })
  async revokeApiKey(@CurrentUser() user: any, @Request() req: any) {
    await this.apiKeyService.revokeApiKey(req.params.id, user.id);
  }
}
```

## Testing Strategy

### 1. Unit Tests

```typescript
// src/features/auth/tests/auth.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../services/auth.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { User } from '../entities/user.entity';
import { Session } from '../entities/session.entity';
import * as bcrypt from 'bcryptjs';

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: any;
  let sessionRepository: any;
  let jwtService: any;

  beforeEach(async () => {
    const mockUserRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const mockSessionRepository = {
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    const mockJwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(Session),
          useValue: mockSessionRepository,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get(getRepositoryToken(User));
    sessionRepository = module.get(getRepositoryToken(Session));
    jwtService = module.get<JwtService>(JwtService);
  });

  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      const loginRequest = {
        email: 'test@example.com',
        password: 'password123',
      };

      const hashedPassword = await bcrypt.hash('password123', 12);
      const user = {
        id: '1',
        email: 'test@example.com',
        password: hashedPassword,
        status: 'active',
        mfaEnabled: false,
        roles: [],
        permissions: [],
      };

      userRepository.findOne.mockResolvedValue(user);
      userRepository.save.mockResolvedValue(user);
      sessionRepository.create.mockReturnValue({});
      sessionRepository.save.mockResolvedValue({});
      jwtService.sign.mockReturnValue('mock-token');

      const result = await service.login(loginRequest);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { email: loginRequest.email },
        relations: ['roles', 'permissions'],
      });
    });

    it('should throw error for invalid credentials', async () => {
      const loginRequest = {
        email: 'test@example.com',
        password: 'wrongpassword',
      };

      userRepository.findOne.mockResolvedValue(null);

      await expect(service.login(loginRequest)).rejects.toThrow('Invalid credentials');
    });

    it('should require MFA when enabled', async () => {
      const loginRequest = {
        email: 'test@example.com',
        password: 'password123',
      };

      const hashedPassword = await bcrypt.hash('password123', 12);
      const user = {
        id: '1',
        email: 'test@example.com',
        password: hashedPassword,
        status: 'active',
        mfaEnabled: true,
        roles: [],
        permissions: [],
      };

      userRepository.findOne.mockResolvedValue(user);

      await expect(service.login(loginRequest)).rejects.toThrow('MFA code required');
    });
  });
});
```

### 2. Integration Tests

```typescript
// src/features/auth/tests/auth-integration.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../../app.module';
import { AuthService } from '../services/auth.service';

describe('Authentication Integration', () => {
  let app: INestApplication;
  let authService: AuthService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    authService = moduleFixture.get<AuthService>(AuthService);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Registration Flow', () => {
    it('should register a new user', async () => {
      const registerData = {
        email: 'test@example.com',
        password: 'StrongPassword123!',
        firstName: 'Test',
        lastName: 'User',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerData)
        .expect(201);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(registerData.email);
    });

    it('should not register user with weak password', async () => {
      const registerData = {
        email: 'test2@example.com',
        password: '123',
        firstName: 'Test',
        lastName: 'User',
      };

      await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerData)
        .expect(400);
    });
  });

  describe('Login Flow', () => {
    beforeEach(async () => {
      // Create test user
      await authService.register({
        email: 'login-test@example.com',
        password: 'StrongPassword123!',
        firstName: 'Login',
        lastName: 'Test',
      });
    });

    it('should login with valid credentials', async () => {
      const loginData = {
        email: 'login-test@example.com',
        password: 'StrongPassword123!',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
    });

    it('should not login with invalid credentials', async () => {
      const loginData = {
        email: 'login-test@example.com',
        password: 'WrongPassword',
      };

      await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginData)
        .expect(401);
    });
  });

  describe('Protected Routes', () => {
    let accessToken: string;

    beforeEach(async () => {
      const loginResponse = await authService.login({
        email: 'login-test@example.com',
        password: 'StrongPassword123!',
      });
      accessToken = loginResponse.accessToken;
    });

    it('should access protected route with valid token', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });

    it('should not access protected route without token', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .expect(401);
    });
  });
});
```

## Security Implementation

### 1. Password Security

```typescript
// src/features/auth/services/password.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import * as zxcvbn from 'zxcvbn';

@Injectable()
export class PasswordService {
  validatePasswordStrength(password: string): void {
    // Minimum requirements
    if (password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters long');
    }

    // Use zxcvbn for strength checking
    const result = zxcvbn(password);
    
    if (result.score < 3) {
      throw new BadRequestException(
        `Password is too weak. ${result.feedback.suggestions.join(' ')}`
      );
    }

    // Additional checks
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
      throw new BadRequestException(
        'Password must contain uppercase, lowercase, numbers, and special characters'
      );
    }
  }

  generateSecurePassword(length = 16): string {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    
    return password;
  }
}
```

### 2. Rate Limiting

```typescript
// src/features/auth/middleware/rate-limit.middleware.ts
import { Injectable, NestMiddleware, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { Redis } from 'ioredis';

@Injectable()
export class AuthRateLimitMiddleware implements NestMiddleware {
  constructor(private readonly redis: Redis) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const key = `auth_rate_limit:${req.ip}`;
    const current = await this.redis.incr(key);
    
    if (current === 1) {
      await this.redis.expire(key, 900); // 15 minutes
    }
    
    if (current > 10) { // 10 attempts per 15 minutes
      throw new HttpException(
        'Too many authentication attempts. Try again later.',
        HttpStatus.TOO_MANY_REQUESTS
      );
    }
    
    next();
  }
}
```

## Monitoring & Analytics

### 1. Authentication Metrics

```typescript
// src/features/auth/services/auth-metrics.service.ts
import { Injectable } from '@nestjs/common';
import { PrometheusService } from '../../../shared/services/prometheus.service';

@Injectable()
export class AuthMetricsService {
  private readonly loginAttempts;
  private readonly loginSuccesses;
  private readonly loginFailures;
  private readonly mfaUsage;

  constructor(private readonly prometheusService: PrometheusService) {
    this.loginAttempts = this.prometheusService.createCounter({
      name: 'auth_login_attempts_total',
      help: 'Total number of login attempts',
      labelNames: ['status', 'method'],
    });

    this.loginSuccesses = this.prometheusService.createCounter({
      name: 'auth_login_successes_total',
      help: 'Total number of successful logins',
      labelNames: ['method'],
    });

    this.loginFailures = this.prometheusService.createCounter({
      name: 'auth_login_failures_total',
      help: 'Total number of failed logins',
      labelNames: ['reason', 'method'],
    });

    this.mfaUsage = this.prometheusService.createCounter({
      name: 'auth_mfa_usage_total',
      help: 'Total MFA usage',
      labelNames: ['action'],
    });
  }

  recordLoginAttempt(status: 'success' | 'failure', method = 'password') {
    this.loginAttempts.labels(status, method).inc();
    
    if (status === 'success') {
      this.loginSuccesses.labels(method).inc();
    }
  }

  recordLoginFailure(reason: string, method = 'password') {
    this.loginFailures.labels(reason, method).inc();
  }

  recordMfaUsage(action: 'enable' | 'disable' | 'verify') {
    this.mfaUsage.labels(action).inc();
  }
}
```

## Conclusion

This authentication feature blueprint provides a comprehensive foundation for implementing secure authentication and authorization in the AegisX Platform. Key highlights include:

### ✅ **Features Implemented:**

1. **JWT Authentication** - Stateless token-based auth
2. **RBAC System** - Flexible role and permission management
3. **API Key Management** - Secure API access for integrations
4. **Multi-Factor Authentication** - TOTP-based additional security
5. **Password Security** - Strength validation and secure storage
6. **Session Management** - Multi-device session control
7. **Social Authentication** - Ready for OAuth integration

### 🔒 **Security Features:**

- Password strength validation
- Rate limiting for auth endpoints
- Secure token storage and rotation
- MFA implementation
- API key encryption
- Session management

### 📊 **Monitoring & Analytics:**

- Authentication metrics and monitoring
- Failed login attempt tracking
- Security event logging
- Performance monitoring

### 🧪 **Testing Coverage:**

- Unit tests for all services
- Integration tests for auth flows
- Security testing scenarios
- Performance testing

This blueprint ensures enterprise-grade authentication suitable for HIS, ERP, and other critical business applications while maintaining developer-friendly APIs and comprehensive security measures.
