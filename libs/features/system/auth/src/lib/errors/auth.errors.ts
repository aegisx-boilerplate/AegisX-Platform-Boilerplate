/**
 * Custom error classes for authentication
 */

export class AuthError extends Error {
  constructor(message: string, public statusCode = 500) {
    super(message);
    this.name = 'AuthError';
  }
}

export class ValidationError extends AuthError {
  constructor(message: string, public field?: string) {
    super(message, 400);
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends AuthError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
    this.name = 'UnauthorizedError';
  }
}

export class ConflictError extends AuthError {
  constructor(message: string) {
    super(message, 409);
    this.name = 'ConflictError';
  }
}

export class TokenExpiredError extends AuthError {
  constructor(message = 'Token expired') {
    super(message, 401);
    this.name = 'TokenExpiredError';
  }
}

export class InvalidTokenError extends AuthError {
  constructor(message = 'Invalid token') {
    super(message, 401);
    this.name = 'InvalidTokenError';
  }
}

/**
 * Error response formatter
 */
export interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  timestamp: string;
}

export function formatError(error: Error): ErrorResponse {
  if (error instanceof AuthError) {
    return {
      error: error.name,
      message: error.message,
      statusCode: error.statusCode,
      timestamp: new Date().toISOString()
    };
  }

  // Generic error
  return {
    error: 'InternalServerError',
    message: 'An unexpected error occurred',
    statusCode: 500,
    timestamp: new Date().toISOString()
  };
}

/**
 * Error handler for auth routes
 */
export function handleAuthError(error: Error, statusCode = 500) {
  if (error instanceof AuthError) {
    return {
      statusCode: error.statusCode,
      response: formatError(error)
    };
  }

  return {
    statusCode,
    response: formatError(error)
  };
}
