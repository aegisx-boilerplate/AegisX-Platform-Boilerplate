# @aegisx/core-auth

🔐 **AegisX Core Authentication Library**

JWT-based authentication system designed specifically for Fastify applications in the AegisX platform ecosystem.

## 🚀 Features

- **JWT Token Management** - Access & refresh tokens with configurable expiry
- **Fastify Integration** - Native Fastify plugin with decorators and hooks
- **Security First** - Timing-safe comparisons, secure token generation
- **TypeScript Support** - Full type safety and IntelliSense
- **Session Tracking** - Optional session fingerprinting and management
- **Flexible Configuration** - Environment-based JWT configuration
- **Error Handling** - Comprehensive error types for different scenarios

## 📦 Installation

```bash
npm install @aegisx/core-auth
```

## ⚡ Quick Start

### 1. Configure Authentication

```typescript
import { AuthConfig } from '@aegisx/core-auth';

const authConfig: AuthConfig = {
  jwt: {
    secret: process.env.JWT_SECRET!, // Min 32 characters
    accessTokenExpiry: '15m',
    refreshTokenExpiry: '7d', 
    issuer: 'aegisx-platform',
    algorithm: 'HS256'
  },
  security: {
    maxLoginAttempts: 5,
    lockoutDuration: 15, // minutes
    passwordMinLength: 8,
    requireEmailVerification: true
  }
};
```

### 2. Register Fastify Plugin

```typescript
import Fastify from 'fastify';
import authPlugin from '@aegisx/core-auth/plugins/fastify-auth';

const fastify = Fastify();

// Register the auth plugin
await fastify.register(authPlugin, authConfig);

// Now you have access to authentication methods
```

### 3. Protect Routes

```typescript
// Protected route requiring JWT
fastify.get('/protected', {
  preHandler: [fastify.authenticate]
}, async (request, reply) => {
  // request.user is automatically populated
  return { message: `Hello ${request.user.email}!` };
});

// Optional authentication
fastify.get('/optional', {
  preHandler: [fastify.optionalAuth]
}, async (request, reply) => {
  const user = request.user; // May be undefined
  return { 
    message: user ? `Hello ${user.email}!` : 'Hello guest!' 
  };
});
```

## 🛠️ Core Components

### TokenService
- JWT generation and verification
- Access/refresh token management
- Token extraction and validation

### FastifyAuthPlugin
- Native Fastify integration
- Request decorators (user, sessionId)
- Pre-handler hooks for authentication

### JwtUtils
- Security utilities and helpers
- Configuration validation
- Session fingerprinting

## 📋 Usage Examples

### Generate Tokens
```typescript
const tokenService = new TokenService(authConfig);
const tokens = tokenService.generateTokenPair('user-123', 'user@example.com');
```

### Protect Routes
```typescript
fastify.get('/profile', {
  preHandler: [fastify.authenticate]
}, async (request, reply) => {
  return { user: request.user };
});
```

### Token Refresh
```typescript
fastify.post('/auth/refresh', async (request, reply) => {
  const { refreshToken } = request.body;
  const payload = fastify.tokenService.verifyRefreshToken(refreshToken);
  const tokens = fastify.tokenService.generateTokenPair(payload.sub, payload.email);
  return { tokens };
});
```

## 🔐 Security Features

- Cryptographically secure token generation
- Timing-safe string comparisons
- Session fingerprinting
- IP address tracking
- Configurable token expiry
- JWT ID (jti) for token tracking

## 🏗️ Integration

Works seamlessly with other AegisX core libraries:
- `@aegisx/core-config` - Configuration management
- `@aegisx/core-logger` - Authentication logging
- `@aegisx/core-rbac` - Role-based authorization
- `@aegisx/core-errors` - Error handling

## 📚 Documentation

- [Authentication Feature Blueprint](../../docs/authentication-feature-blueprint.md)
- [API Architecture Blueprint](../../docs/api-architecture-blueprint.md)

## 🧪 Building & Testing

```bash
# Build the library
nx build core-auth

# Run unit tests  
nx test core-auth

# Run with coverage
nx test core-auth --coverage
```
