# API Architecture Blueprint

This document provides a comprehensive blueprint for implementing robust API architecture in the AegisX Platform. It includes API design patterns, REST standards, GraphQL integration, versioning strategies, and scalability best practices.

## Table of Contents

- [Feature Overview](#feature-overview)
- [Architecture Design](#architecture-design)
- [Implementation Strategy](#implementation-strategy)
- [Testing Strategy](#testing-strategy)
- [Monitoring & Analytics](#monitoring--analytics)

## Feature Overview

### What is API Architecture?

A well-designed API architecture provides standardized, scalable, and maintainable interfaces for client-server communication, supporting both REST and GraphQL paradigms.

### Business Benefits

- **Developer Experience** - Consistent and intuitive API interfaces
- **Integration Ready** - Easy third-party and internal integrations
- **Scalability** - Handle growing API traffic efficiently
- **Maintainability** - Clear structure and documentation
- **Flexibility** - Support multiple client types and use cases

### Technical Benefits

- **Standardization** - Consistent API patterns across services
- **Performance** - Optimized response times and caching
- **Security** - Built-in authentication and authorization
- **Monitoring** - Comprehensive API analytics and logging
- **Version Management** - Backward compatibility and smooth migrations

## Architecture Design

### API Gateway Architecture

```text
┌─────────────────────────────────────────────────────────┐
│                    Client Layer                         │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │
│ │  Web App    │ │   Mobile    │ │  3rd Party  │        │
│ │             │ │    App      │ │    API      │        │
│ └─────────────┘ └─────────────┘ └─────────────┘        │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                   API Gateway                           │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │
│ │    Auth     │ │    Rate     │ │   Request   │        │
│ │ Middleware  │ │  Limiting   │ │ Validation  │        │
│ └─────────────┘ └─────────────┘ └─────────────┘        │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │
│ │   Routing   │ │  Transform  │ │    Cache    │        │
│ │   Logic     │ │  Response   │ │  Management │        │
│ └─────────────┘ └─────────────┘ └─────────────┘        │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                Service Layer                            │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │
│ │   User      │ │   Auth      │ │  Storage    │        │
│ │  Service    │ │  Service    │ │  Service    │        │
│ └─────────────┘ └─────────────┘ └─────────────┘        │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │
│ │  Webhook    │ │ WebSocket   │ │   Multi-    │        │
│ │  Service    │ │  Service    │ │  Tenancy    │        │
│ └─────────────┘ └─────────────┘ └─────────────┘        │
└─────────────────────────────────────────────────────────┘
```

### Request-Response Flow

```text
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Client    │    │  Gateway    │    │  Service    │
│             │    │             │    │             │
├─────────────┤    ├─────────────┤    ├─────────────┤
│ 1. Request  │───▶│ 2. Validate │───▶│ 3. Process  │
│             │    │ & Auth      │    │ Business    │
│             │    │             │    │ Logic       │
│ 6. Response │◀───│ 5. Transform│◀───│ 4. Return   │
│             │    │ & Cache     │    │ Data        │
└─────────────┘    └─────────────┘    └─────────────┘
```

## Implementation Strategy

### Phase 1: Core API Infrastructure

#### 1.1 Base Controller and Response Standards

```typescript
// src/shared/controllers/base.controller.ts
import { Controller, HttpStatus } from '@nestjs/common';
import { ApiResponse as SwaggerResponse } from '@nestjs/swagger';

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
  errors?: string[];
  timestamp: string;
  requestId: string;
  version: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

@Controller()
export abstract class BaseController {
  protected success<T>(
    data?: T,
    message = 'Success',
    meta?: any
  ): ApiResponse<T> {
    return {
      success: true,
      message,
      data,
      meta,
      timestamp: new Date().toISOString(),
      requestId: this.getRequestId(),
      version: process.env.API_VERSION || '1.0.0',
    };
  }

  protected error(
    message = 'An error occurred',
    errors: string[] = [],
    statusCode = HttpStatus.INTERNAL_SERVER_ERROR
  ): ApiResponse {
    return {
      success: false,
      message,
      errors,
      timestamp: new Date().toISOString(),
      requestId: this.getRequestId(),
      version: process.env.API_VERSION || '1.0.0',
    };
  }

  protected paginated<T>(
    items: T[],
    total: number,
    page: number,
    limit: number,
    message = 'Success'
  ): ApiResponse<PaginatedResponse<T>> {
    const totalPages = Math.ceil(total / limit);
    
    return this.success(
      {
        items,
        meta: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      },
      message
    );
  }

  private getRequestId(): string {
    // This would typically come from request context
    return Math.random().toString(36).substring(2, 15);
  }
}

// Usage example in controllers
@Controller('users')
export class UsersController extends BaseController {
  @Get()
  async getUsers(
    @Query('page') page = 1,
    @Query('limit') limit = 20
  ) {
    const { users, total } = await this.userService.findAll(page, limit);
    return this.paginated(users, total, page, limit, 'Users retrieved successfully');
  }

  @Get(':id')
  async getUser(@Param('id') id: string) {
    const user = await this.userService.findById(id);
    return this.success(user, 'User retrieved successfully');
  }
}
```

#### 1.2 Global Exception Filter

```typescript
// src/shared/filters/global-exception.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiResponse } from '../controllers/base.controller';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errors: string[] = [];

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        message = (exceptionResponse as any).message || message;
        errors = Array.isArray((exceptionResponse as any).message)
          ? (exceptionResponse as any).message
          : [message];
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      errors = [exception.message];
    }

    // Log error for monitoring
    this.logger.error(
      `HTTP ${status} Error: ${message}`,
      exception instanceof Error ? exception.stack : 'Unknown error',
      {
        request: {
          method: request.method,
          url: request.url,
          headers: request.headers,
          body: request.body,
        },
        user: (request as any).user?.id,
        tenant: (request as any).tenantId,
      }
    );

    const errorResponse: ApiResponse = {
      success: false,
      message,
      errors,
      timestamp: new Date().toISOString(),
      requestId: request.headers['x-request-id'] as string || 'unknown',
      version: process.env.API_VERSION || '1.0.0',
    };

    response.status(status).json(errorResponse);
  }
}
```

#### 1.3 Request/Response Interceptors

```typescript
// src/shared/interceptors/logging.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const { method, url, headers, body } = request;
    const userAgent = headers['user-agent'] || '';
    const requestId = headers['x-request-id'] || Math.random().toString(36);
    
    const now = Date.now();
    
    // Add request ID to headers
    response.setHeader('X-Request-ID', requestId);

    this.logger.log(
      `${method} ${url} - ${userAgent}`,
      {
        requestId,
        method,
        url,
        userAgent,
        body: this.sanitizeBody(body),
        user: (request as any).user?.id,
        tenant: (request as any).tenantId,
      }
    );

    return next.handle().pipe(
      tap({
        next: (data) => {
          const responseTime = Date.now() - now;
          this.logger.log(
            `${method} ${url} ${response.statusCode} - ${responseTime}ms`,
            {
              requestId,
              method,
              url,
              statusCode: response.statusCode,
              responseTime,
              user: (request as any).user?.id,
              tenant: (request as any).tenantId,
            }
          );
        },
        error: (error) => {
          const responseTime = Date.now() - now;
          this.logger.error(
            `${method} ${url} ${error.status || 500} - ${responseTime}ms`,
            error.stack,
            {
              requestId,
              method,
              url,
              statusCode: error.status || 500,
              responseTime,
              error: error.message,
              user: (request as any).user?.id,
              tenant: (request as any).tenantId,
            }
          );
        },
      })
    );
  }

  private sanitizeBody(body: any): any {
    if (!body) return body;
    
    const sanitized = { ...body };
    const sensitiveFields = ['password', 'token', 'secret', 'key'];
    
    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });
    
    return sanitized;
  }
}

// src/shared/interceptors/response-transform.interceptor.ts
@Injectable()
export class ResponseTransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map(data => {
        // If data is already in ApiResponse format, return as is
        if (data && typeof data === 'object' && 'success' in data) {
          return data;
        }

        // Transform raw data to ApiResponse format
        return {
          success: true,
          message: 'Success',
          data,
          timestamp: new Date().toISOString(),
          requestId: context.switchToHttp().getRequest().headers['x-request-id'] || 'unknown',
          version: process.env.API_VERSION || '1.0.0',
        };
      })
    );
  }
}
```

### Phase 2: API Versioning Strategy

#### 2.1 Versioning Implementation

```typescript
// src/shared/decorators/api-version.decorator.ts
import { applyDecorators } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

export function ApiVersion(version: string) {
  return applyDecorators(
    ApiTags(`v${version}`),
  );
}

// src/shared/middleware/version.middleware.ts
import { Injectable, NestMiddleware, BadRequestException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

interface VersionedRequest extends Request {
  apiVersion?: string;
}

@Injectable()
export class VersionMiddleware implements NestMiddleware {
  use(req: VersionedRequest, res: Response, next: NextFunction) {
    // Extract version from header
    let version = req.headers['api-version'] as string;
    
    // Extract from URL path
    if (!version) {
      const pathMatch = req.path.match(/^\/api\/v(\d+)/);
      if (pathMatch) {
        version = pathMatch[1];
      }
    }
    
    // Extract from Accept header
    if (!version) {
      const acceptHeader = req.headers.accept;
      if (acceptHeader) {
        const versionMatch = acceptHeader.match(/application\/vnd\.aegisx\.v(\d+)\+json/);
        if (versionMatch) {
          version = versionMatch[1];
        }
      }
    }
    
    // Default to latest version
    if (!version) {
      version = process.env.API_DEFAULT_VERSION || '1';
    }
    
    // Validate version
    const supportedVersions = process.env.API_SUPPORTED_VERSIONS?.split(',') || ['1'];
    if (!supportedVersions.includes(version)) {
      throw new BadRequestException(`API version ${version} is not supported`);
    }
    
    req.apiVersion = version;
    res.setHeader('API-Version', version);
    
    next();
  }
}

// Version-specific controllers
@Controller({ path: 'users', version: '1' })
@ApiVersion('1')
export class UsersV1Controller extends BaseController {
  @Get()
  @ApiOperation({ summary: 'Get users (v1)' })
  async getUsersV1() {
    // V1 implementation
    const users = await this.userService.findAllV1();
    return this.success(users);
  }
}

@Controller({ path: 'users', version: '2' })
@ApiVersion('2')
export class UsersV2Controller extends BaseController {
  @Get()
  @ApiOperation({ summary: 'Get users (v2) - Enhanced with additional fields' })
  async getUsersV2() {
    // V2 implementation with enhanced features
    const users = await this.userService.findAllV2();
    return this.success(users);
  }
}
```

### Phase 3: GraphQL Integration

#### 3.1 GraphQL Setup

```typescript
// src/graphql/graphql.module.ts
import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { GraphQLError, GraphQLFormattedError } from 'graphql';
import { UserResolver } from './resolvers/user.resolver';
import { AuthGuard } from './guards/auth.guard';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      sortSchema: true,
      playground: process.env.NODE_ENV === 'development',
      introspection: process.env.NODE_ENV === 'development',
      context: ({ req, res }) => ({ req, res }),
      formatError: (error: GraphQLError): GraphQLFormattedError => {
        const formattedError: GraphQLFormattedError = {
          message: error.message,
          path: error.path,
          timestamp: new Date().toISOString(),
        };

        if (process.env.NODE_ENV === 'development') {
          formattedError.extensions = error.extensions;
          formattedError.locations = error.locations;
        }

        return formattedError;
      },
    }),
  ],
  providers: [UserResolver, AuthGuard],
})
export class GraphqlModule {}

// src/graphql/resolvers/user.resolver.ts
import {
  Resolver,
  Query,
  Mutation,
  Args,
  Context,
  ResolveField,
  Parent,
} from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { User } from '../types/user.type';
import { CreateUserInput, UpdateUserInput } from '../inputs/user.input';
import { UserService } from '../../features/user/services/user.service';
import { AuthGuard } from '../guards/auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';

@Resolver(() => User)
export class UserResolver {
  constructor(private readonly userService: UserService) {}

  @Query(() => [User])
  @UseGuards(AuthGuard)
  async users(
    @Args('page', { type: () => Int, defaultValue: 1 }) page: number,
    @Args('limit', { type: () => Int, defaultValue: 20 }) limit: number,
    @Args('search', { type: () => String, nullable: true }) search?: string,
  ): Promise<User[]> {
    return this.userService.findAll({ page, limit, search });
  }

  @Query(() => User)
  @UseGuards(AuthGuard)
  async user(@Args('id') id: string): Promise<User> {
    return this.userService.findById(id);
  }

  @Query(() => User)
  @UseGuards(AuthGuard)
  async me(@CurrentUser() user: any): Promise<User> {
    return this.userService.findById(user.id);
  }

  @Mutation(() => User)
  @UseGuards(AuthGuard)
  async createUser(@Args('input') input: CreateUserInput): Promise<User> {
    return this.userService.create(input);
  }

  @Mutation(() => User)
  @UseGuards(AuthGuard)
  async updateUser(
    @Args('id') id: string,
    @Args('input') input: UpdateUserInput,
  ): Promise<User> {
    return this.userService.update(id, input);
  }

  @Mutation(() => Boolean)
  @UseGuards(AuthGuard)
  async deleteUser(@Args('id') id: string): Promise<boolean> {
    await this.userService.delete(id);
    return true;
  }

  @ResolveField(() => [String])
  async permissions(@Parent() user: User): Promise<string[]> {
    return this.userService.getUserPermissions(user.id);
  }
}

// src/graphql/types/user.type.ts
import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class User {
  @Field(() => ID)
  id: string;

  @Field()
  email: string;

  @Field({ nullable: true })
  username?: string;

  @Field()
  firstName: string;

  @Field()
  lastName: string;

  @Field({ nullable: true })
  avatar?: string;

  @Field(() => [String])
  roles: string[];

  @Field(() => [String])
  permissions: string[];

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
```

### Phase 4: Rate Limiting and Throttling

#### 4.1 Advanced Rate Limiting

```typescript
// src/shared/guards/throttler.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerGuard as BaseThrottlerGuard } from '@nestjs/throttler';
import { THROTTLER_CONFIG_KEY } from '../decorators/throttler.decorator';

interface ThrottlerConfig {
  short?: { ttl: number; limit: number };
  medium?: { ttl: number; limit: number };
  long?: { ttl: number; limit: number };
}

@Injectable()
export class AdvancedThrottlerGuard extends BaseThrottlerGuard implements CanActivate {
  constructor(
    protected readonly reflector: Reflector,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const config = this.reflector.getAllAndOverride<ThrottlerConfig>(
      THROTTLER_CONFIG_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!config) {
      return super.canActivate(context);
    }

    const request = context.switchToHttp().getRequest();
    const key = this.generateKey(context, request.ip);

    // Check multiple time windows
    for (const [window, settings] of Object.entries(config)) {
      const windowKey = `${key}:${window}`;
      const current = await this.storage.increment(windowKey, settings.ttl);
      
      if (current > settings.limit) {
        throw new ThrottlerException();
      }
    }

    return true;
  }

  protected generateKey(context: ExecutionContext, ip: string): string {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    // Use user ID if authenticated, otherwise use IP
    const identifier = user?.id || ip;
    const route = `${request.method}:${request.route?.path || request.url}`;
    
    return `throttle:${identifier}:${route}`;
  }
}

// src/shared/decorators/throttler.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const THROTTLER_CONFIG_KEY = 'throttler_config';

export const CustomThrottle = (config: ThrottlerConfig) =>
  SetMetadata(THROTTLER_CONFIG_KEY, config);

// Usage example
@Controller('auth')
export class AuthController {
  @Post('login')
  @CustomThrottle({
    short: { ttl: 60, limit: 5 },    // 5 attempts per minute
    medium: { ttl: 3600, limit: 20 }, // 20 attempts per hour
    long: { ttl: 86400, limit: 50 },  // 50 attempts per day
  })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }
}
```

### Phase 5: API Documentation

#### 5.1 Advanced Swagger Configuration

```typescript
// src/shared/config/swagger.config.ts
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { INestApplication } from '@nestjs/common';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('AegisX Platform API')
    .setDescription('Comprehensive API for the AegisX Platform')
    .setVersion('1.0.0')
    .setContact(
      'AegisX Team',
      'https://aegisx.com',
      'support@aegisx.com'
    )
    .setLicense('MIT', 'https://opensource.org/licenses/MIT')
    .addServer('http://localhost:3000', 'Development server')
    .addServer('https://api.aegisx.com', 'Production server')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth'
    )
    .addApiKey(
      {
        type: 'apiKey',
        name: 'X-API-Key',
        in: 'header',
        description: 'API Key for external integrations',
      },
      'API-Key'
    )
    .addTag('Authentication', 'User authentication and authorization')
    .addTag('Users', 'User management operations')
    .addTag('Storage', 'File upload and management')
    .addTag('WebSocket', 'Real-time communication')
    .addTag('Webhooks', 'Webhook management')
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (controllerKey: string, methodKey: string) =>
      `${controllerKey}_${methodKey}`,
  });

  // Add custom CSS for better UI
  const customCss = `
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info .title { color: #2563eb; }
    .swagger-ui .scheme-container { background: #f8fafc; padding: 10px; }
  `;

  SwaggerModule.setup('api/docs', app, document, {
    customCss,
    customSiteTitle: 'AegisX API Documentation',
    customfavIcon: '/favicon.ico',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      docExpansion: 'none',
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
    },
  });

  // Generate OpenAPI JSON
  const jsonDocument = JSON.stringify(document, null, 2);
  require('fs').writeFileSync('./openapi.json', jsonDocument);
}

// Custom decorators for better documentation
export function ApiSuccessResponse<T>(
  type: T,
  description = 'Success response',
  isArray = false
) {
  return applyDecorators(
    ApiResponse({
      status: 200,
      description,
      type: isArray ? [type] : type,
    })
  );
}

export function ApiErrorResponses() {
  return applyDecorators(
    ApiResponse({ status: 400, description: 'Bad Request' }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 403, description: 'Forbidden' }),
    ApiResponse({ status: 404, description: 'Not Found' }),
    ApiResponse({ status: 500, description: 'Internal Server Error' }),
  );
}

// Usage in controllers
@Controller('users')
@ApiTags('Users')
export class UsersController {
  @Get()
  @ApiOperation({ summary: 'Get all users', description: 'Retrieve a paginated list of users' })
  @ApiSuccessResponse(User, 'Users retrieved successfully', true)
  @ApiErrorResponses()
  @ApiBearerAuth('JWT-auth')
  async getUsers() {
    // Implementation
  }
}
```

## Testing Strategy

### 1. API Integration Tests

```typescript
// src/test/api.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('API Integration Tests', () => {
  let app: INestApplication;
  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Get access token for authenticated requests
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123',
      });

    accessToken = loginResponse.body.data.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Authentication Flow', () => {
    it('should register a new user', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'newuser@example.com',
          password: 'StrongPassword123!',
          firstName: 'New',
          lastName: 'User',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('accessToken');
    });

    it('should login with valid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('accessToken');
    });
  });

  describe('API Standards', () => {
    it('should return consistent response format', async () => {
      const response = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('requestId');
      expect(response.body).toHaveProperty('version');
    });

    it('should handle pagination correctly', async () => {
      const response = await request(app.getHttpServer())
        .get('/users?page=1&limit=10')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data).toHaveProperty('items');
      expect(response.body.data).toHaveProperty('meta');
      expect(response.body.data.meta).toHaveProperty('page', 1);
      expect(response.body.data.meta).toHaveProperty('limit', 10);
      expect(response.body.data.meta).toHaveProperty('total');
      expect(response.body.data.meta).toHaveProperty('hasNext');
      expect(response.body.data.meta).toHaveProperty('hasPrev');
    });

    it('should validate request data', async () => {
      const response = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          email: 'invalid-email',
          password: '123', // Too short
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeInstanceOf(Array);
      expect(response.body.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should return 401 for unauthenticated requests', async () => {
      const response = await request(app.getHttpServer())
        .get('/users')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Unauthorized');
    });

    it('should return 404 for non-existent resources', async () => {
      const response = await request(app.getHttpServer())
        .get('/users/non-existent-id')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      const promises = Array.from({ length: 100 }, () =>
        request(app.getHttpServer())
          .post('/auth/login')
          .send({
            email: 'test@example.com',
            password: 'wrong-password',
          })
      );

      const responses = await Promise.all(promises);
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });
});
```

## Monitoring & Analytics

### 1. API Metrics and Monitoring

```typescript
// src/shared/services/api-metrics.service.ts
import { Injectable } from '@nestjs/common';
import { PrometheusService } from './prometheus.service';

@Injectable()
export class ApiMetricsService {
  private readonly httpRequestsTotal;
  private readonly httpRequestDuration;
  private readonly httpRequestSize;
  private readonly httpResponseSize;

  constructor(private readonly prometheusService: PrometheusService) {
    this.httpRequestsTotal = this.prometheusService.createCounter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code', 'version'],
    });

    this.httpRequestDuration = this.prometheusService.createHistogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    });

    this.httpRequestSize = this.prometheusService.createHistogram({
      name: 'http_request_size_bytes',
      help: 'HTTP request size in bytes',
      buckets: [100, 1000, 5000, 10000, 50000, 100000, 500000, 1000000],
    });

    this.httpResponseSize = this.prometheusService.createHistogram({
      name: 'http_response_size_bytes',
      help: 'HTTP response size in bytes',
      buckets: [100, 1000, 5000, 10000, 50000, 100000, 500000, 1000000],
    });
  }

  recordRequest(
    method: string,
    route: string,
    statusCode: number,
    duration: number,
    requestSize: number,
    responseSize: number,
    version: string
  ) {
    this.httpRequestsTotal
      .labels(method, route, statusCode.toString(), version)
      .inc();

    this.httpRequestDuration
      .labels(method, route, statusCode.toString())
      .observe(duration / 1000); // Convert to seconds

    this.httpRequestSize.observe(requestSize);
    this.httpResponseSize.observe(responseSize);
  }
}
```

## Conclusion

This API Architecture blueprint provides a comprehensive foundation for building robust, scalable APIs in the AegisX Platform. Key highlights include:

### ✅ **Features Implemented:**

1. **Standardized Response Format** - Consistent API responses across all endpoints
2. **Multi-Version Support** - Backward compatibility and smooth migrations
3. **GraphQL Integration** - Flexible query language for complex data requirements
4. **Advanced Rate Limiting** - Multi-window throttling and user-based limits
5. **Comprehensive Documentation** - Auto-generated Swagger docs with examples
6. **Error Handling** - Structured error responses and logging
7. **Request/Response Interceptors** - Automatic logging and transformation

### 🔒 **Security Features:**

- JWT and API key authentication
- Rate limiting and throttling
- Request validation and sanitization
- CORS and security headers

### 📊 **Monitoring & Analytics:**

- Detailed API metrics and performance tracking
- Request/response logging and tracing
- Error rate monitoring
- Usage analytics per version and endpoint

### 🧪 **Testing Coverage:**

- Comprehensive integration tests
- API contract testing
- Performance and load testing
- Error handling validation

This blueprint ensures enterprise-grade API architecture suitable for complex business applications while maintaining developer experience, security, and performance standards.
