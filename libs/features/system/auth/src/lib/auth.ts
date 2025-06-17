// Auth feature exports
export { authPlugin as default } from './plugin';
export { authPlugin } from './plugin';
export type { AuthPluginOptions } from './plugin';

// Routes and handlers
export { authRoutes } from './routes/auth.routes';
export { AuthHandlers } from './handlers/auth.handlers';

// Services and repositories
export { AuthService } from './services/auth.service';
export { UserRepository } from './repositories/user.repository';

// Configuration
export { 
  registerAuthServices,
  initializeAuthServices,
  cleanupAuthServices
} from './config/auth.config';

// Types and interfaces
export type {
  LoginCredentials,
  AuthResult,
  UserData
} from './services/auth.service';

export type {
  DbUser,
  DbRefreshToken,
  CreateUserInput
} from './repositories/user.repository';

// Export schemas and types
export * from './schemas';

// Export errors (with explicit naming to avoid conflicts)
export {
  AuthError,
  ValidationError,
  UnauthorizedError,
  ConflictError,
  TokenExpiredError,
  InvalidTokenError,
  formatError,
  handleAuthError
} from './errors/auth.errors';

export type { ErrorResponse as AuthErrorResponse } from './errors/auth.errors';

// Re-export core services for convenience
export { TokenService } from '@aegisx/core-auth';
