import { Type, Static } from '@sinclair/typebox';

/**
 * Auth Request Schemas
 */

export const LoginSchema = Type.Object({
  email: Type.String({ 
    format: 'email',
    description: 'User email address' 
  }),
  password: Type.String({ 
    minLength: 6,
    description: 'User password (minimum 6 characters)' 
  })
}, {
  $id: 'LoginRequest',
  title: 'Login Request',
  description: 'User login credentials'
});

export const RegisterSchema = Type.Object({
  email: Type.String({ 
    format: 'email',
    description: 'User email address' 
  }),
  password: Type.String({ 
    minLength: 6,
    description: 'User password (minimum 6 characters)' 
  }),
  firstName: Type.String({ 
    minLength: 1,
    maxLength: 50,
    description: 'User first name' 
  }),
  lastName: Type.String({ 
    minLength: 1,
    maxLength: 50,
    description: 'User last name' 
  })
}, {
  $id: 'RegisterRequest',
  title: 'Register Request',
  description: 'User registration data'
});

export const RefreshTokenSchema = Type.Object({
  refreshToken: Type.String({
    description: 'Refresh token for generating new access token'
  })
}, {
  $id: 'RefreshTokenRequest',
  title: 'Refresh Token Request',
  description: 'Refresh token request'
});

/**
 * Auth Response Schemas
 */

export const UserSchema = Type.Object({
  id: Type.String({
    description: 'User unique identifier'
  }),
  email: Type.String({ 
    format: 'email',
    description: 'User email address' 
  }),
  firstName: Type.String({
    description: 'User first name'
  }),
  lastName: Type.String({
    description: 'User last name'
  })
}, {
  $id: 'User',
  title: 'User',
  description: 'User information'
});

export const AuthResponseSchema = Type.Object({
  accessToken: Type.String({
    description: 'JWT access token'
  }),
  refreshToken: Type.String({
    description: 'JWT refresh token'
  }),
  user: UserSchema
}, {
  $id: 'AuthResponse',
  title: 'Auth Response',
  description: 'Authentication response with tokens and user data'
});

export const TokenResponseSchema = Type.Object({
  accessToken: Type.String({
    description: 'New JWT access token'
  }),
  refreshToken: Type.String({
    description: 'New JWT refresh token'
  })
}, {
  $id: 'TokenResponse',
  title: 'Token Response',
  description: 'Token refresh response'
});

export const MessageResponseSchema = Type.Object({
  message: Type.String({
    description: 'Response message'
  })
}, {
  $id: 'MessageResponse',
  title: 'Message Response',
  description: 'Generic message response'
});

/**
 * Error Schemas
 */

export const ErrorSchema = Type.Object({
  error: Type.String({
    description: 'Error type'
  }),
  message: Type.String({
    description: 'Error message'
  })
}, {
  $id: 'Error',
  title: 'Error',
  description: 'Error response'
});

export const ValidationErrorSchema = Type.Object({
  error: Type.String({
    description: 'Error type'
  }),
  message: Type.String({
    description: 'Error message'
  }),
  details: Type.Optional(Type.Array(Type.Object({
    field: Type.String(),
    message: Type.String()
  })))
}, {
  $id: 'ValidationError',
  title: 'Validation Error',
  description: 'Validation error response with field details'
});

/**
 * TypeScript Types
 */

export type LoginRequest = Static<typeof LoginSchema>;
export type RegisterRequest = Static<typeof RegisterSchema>;
export type RefreshTokenRequest = Static<typeof RefreshTokenSchema>;
export type User = Static<typeof UserSchema>;
export type AuthResponse = Static<typeof AuthResponseSchema>;
export type TokenResponse = Static<typeof TokenResponseSchema>;
export type MessageResponse = Static<typeof MessageResponseSchema>;
export type ErrorResponse = Static<typeof ErrorSchema>;
export type ValidationErrorResponse = Static<typeof ValidationErrorSchema>;
