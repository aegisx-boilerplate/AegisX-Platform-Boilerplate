# Auth Schemas

This directory contains TypeBox schemas for authentication endpoints, providing type-safe validation and OpenAPI documentation.

## Schema Files

### `auth.schemas.ts`
Contains all authentication-related schemas:

#### Request Schemas
- `LoginSchema` - User login credentials
- `RegisterSchema` - User registration data
- `RefreshTokenSchema` - Token refresh request

#### Response Schemas
- `UserSchema` - User information
- `AuthResponseSchema` - Authentication response with tokens
- `TokenResponseSchema` - Token refresh response
- `MessageResponseSchema` - Generic message response

#### Error Schemas
- `ErrorSchema` - Standard error response
- `ValidationErrorSchema` - Validation error with field details

## Usage

### In Routes
```typescript
import {
  LoginSchema,
  AuthResponseSchema,
  ErrorSchema
} from '../schemas';

fastify.post('/login', {
  schema: {
    body: LoginSchema,
    response: {
      200: AuthResponseSchema,
      401: ErrorSchema
    }
  }
}, handler);
```

### In Handlers
```typescript
import { LoginRequest, AuthResponse } from '../schemas';

async function login(
  request: FastifyRequest<{ Body: LoginRequest }>,
  reply: FastifyReply
): Promise<AuthResponse> {
  // Handler implementation
}
```

## Benefits

- ✅ **Type Safety** - TypeScript types generated from schemas
- ✅ **Validation** - Automatic request/response validation
- ✅ **Documentation** - OpenAPI/Swagger documentation
- ✅ **Reusability** - Schemas can be imported and reused
- ✅ **Maintenance** - Single source of truth for data structures

## Schema Features

### Built-in Validation
- Email format validation
- String length constraints
- Required/optional fields
- Custom descriptions for documentation

### OpenAPI Integration
- Schema IDs for OpenAPI references
- Titles and descriptions
- Response code mapping
- Field-level documentation
