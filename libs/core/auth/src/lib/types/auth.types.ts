/**
 * JWT Payload interface following JWT standard claims
 */
export interface JwtPayload {
  sub: string; // Subject (user id)
  email: string;
  iat: number; // Issued at
  exp: number; // Expires at
  iss: string; // Issuer
  type: 'access' | 'refresh';
  jti?: string; // JWT ID for tracking
}

/**
 * Token pair for authentication
 */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number; // seconds until access token expires
}

/**
 * Authentication configuration
 */
export interface AuthConfig {
  jwt: {
    secret: string;
    accessTokenExpiry: string; // e.g., '15m'
    refreshTokenExpiry: string; // e.g., '7d'
    issuer: string;
    algorithm: 'HS256' | 'HS384' | 'HS512' | 'RS256' | 'RS384' | 'RS512';
  };
  security: {
    maxLoginAttempts: number;
    lockoutDuration: number; // minutes
    passwordMinLength: number;
    requireEmailVerification: boolean;
  };
}

/**
 * Login request payload
 */
export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

/**
 * Registration request payload
 */
export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  acceptTerms: boolean;
}

/**
 * User information returned in auth responses
 */
export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  emailVerified: boolean;
  createdAt: Date;
  lastLoginAt?: Date;
}

/**
 * Complete authentication response
 */
export interface AuthResponse {
  user: AuthUser;
  tokens: TokenPair;
  message: string;
}

/**
 * Password reset request
 */
export interface PasswordResetRequest {
  email: string;
}

/**
 * Password reset confirmation
 */
export interface PasswordResetConfirm {
  token: string;
  newPassword: string;
}

/**
 * Change password request
 */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

/**
 * Token refresh request
 */
export interface RefreshTokenRequest {
  refreshToken: string;
}

/**
 * Session information
 */
export interface SessionInfo {
  id: string;
  userId: string;
  deviceInfo?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  expiresAt: Date;
  isActive: boolean;
}

/**
 * Authentication error types
 */
export enum AuthError {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  PASSWORD_TOO_WEAK = 'PASSWORD_TOO_WEAK',
  EMAIL_ALREADY_EXISTS = 'EMAIL_ALREADY_EXISTS',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
}

/**
 * Fastify request with authenticated user
 */
export interface AuthenticatedRequest {
  user: {
    id: string;
    email: string;
  };
  sessionId?: string;
}
