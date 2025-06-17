/**
 * Mock implementation for development and testing
 * Replace with real implementation when core services are ready
 */

import {
  UnauthorizedError,
  ConflictError,
  InvalidTokenError
} from '../errors/auth.errors';

export interface MockUser {
  id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * In-memory mock database
 */
export class MockUserDatabase {
  private users: MockUser[] = [
    {
      id: '1',
      email: 'admin@aegisx.com',
      password: 'password123', // In real app, this would be hashed
      firstName: 'Admin',
      lastName: 'User',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01')
    }
  ];

  private refreshTokens: Map<string, string> = new Map([
    ['mock-refresh-token', '1'] // token -> userId
  ]);

  findByEmail(email: string): MockUser | undefined {
    return this.users.find(user => user.email === email);
  }

  findById(id: string): MockUser | undefined {
    return this.users.find(user => user.id === id);
  }

  create(userData: Omit<MockUser, 'id' | 'createdAt' | 'updatedAt'>): MockUser {
    const newUser: MockUser = {
      id: Math.random().toString(36).substr(2, 9),
      ...userData,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.users.push(newUser);
    return newUser;
  }

  validateRefreshToken(token: string): string | undefined {
    return this.refreshTokens.get(token);
  }

  storeRefreshToken(token: string, userId: string): void {
    this.refreshTokens.set(token, userId);
  }

  removeRefreshToken(token: string): void {
    this.refreshTokens.delete(token);
  }
}

/**
 * Mock authentication service
 */
export class MockAuthService {
  private db = new MockUserDatabase();

  async login(credentials: { email: string; password: string }) {
    const { email, password } = credentials;
    const user = this.db.findByEmail(email);
    
    if (!user || user.password !== password) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Generate mock tokens
    const accessToken = this.generateMockToken('access', user.id);
    const refreshToken = this.generateMockToken('refresh', user.id);

    // Store refresh token
    this.db.storeRefreshToken(refreshToken, user.id);

    return {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60, // 15 minutes
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName
      }
    };
  }

  async register(userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }) {
    // Check if user exists
    const existingUser = this.db.findByEmail(userData.email);
    if (existingUser) {
      throw new ConflictError('User with this email already exists');
    }

    // Create user
    const newUser = this.db.create(userData);

    // Generate tokens
    const accessToken = this.generateMockToken('access', newUser.id);
    const refreshToken = this.generateMockToken('refresh', newUser.id);

    // Store refresh token
    this.db.storeRefreshToken(refreshToken, newUser.id);

    return {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60, // 15 minutes
      user: {
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName
      }
    };
  }

  async refreshToken(token: string) {
    const userId = this.db.validateRefreshToken(token);
    
    if (!userId) {
      throw new InvalidTokenError('Invalid or expired refresh token');
    }

    const user = this.db.findById(userId);
    if (!user) {
      throw new InvalidTokenError('User not found');
    }

    // Generate new tokens
    const newAccessToken = this.generateMockToken('access', user.id);
    const newRefreshToken = this.generateMockToken('refresh', user.id);

    // Replace old refresh token
    this.db.removeRefreshToken(token);
    this.db.storeRefreshToken(newRefreshToken, user.id);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: 15 * 60 // 15 minutes
    };
  }

  async logout(refreshToken?: string) {
    if (refreshToken) {
      this.db.removeRefreshToken(refreshToken);
    }
    // In real implementation, also invalidate access token
  }

  private generateMockToken(type: 'access' | 'refresh', userId: string): string {
    const timestamp = Date.now();
    return `mock-${type}-token-${userId}-${timestamp}`;
  }
}

// Singleton instance
export const mockAuthService = new MockAuthService();
