import { injectable } from 'tsyringe';
import { UserRepository, CreateUserInput } from '../repositories/user.repository';
import { TokenService } from '@aegisx/core-auth';
import {
  UnauthorizedError,
  ConflictError,
  ValidationError,
  InvalidTokenError
} from '../errors/auth.errors';

/**
 * Login credentials
 */
export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * Authentication result
 */
export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  expiresIn: number;
}

/**
 * User data for responses
 */
export interface UserData {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  emailVerified: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
}

/**
 * Real Authentication Service with Knex database integration
 */
@injectable()
export class AuthService {
  constructor(
    private userRepository: UserRepository,
    private tokenService: TokenService
  ) {}

  /**
   * Authenticate user and return tokens
   */
  async login(credentials: LoginCredentials): Promise<AuthResult> {
    const { email, password } = credentials;

    // Validate input
    if (!email || !password) {
      throw new ValidationError('Email and password are required');
    }

    // Find user by email
    const user = await this.userRepository.findByEmail(email.toLowerCase());
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Check if account is locked
    const isLocked = await this.userRepository.isAccountLocked(user);
    if (isLocked) {
      throw new UnauthorizedError('Account is temporarily locked due to multiple failed login attempts');
    }

    // Verify password
    const isPasswordValid = await this.userRepository.verifyPassword(user, password);
    if (!isPasswordValid) {
      // Increment login attempts
      await this.userRepository.incrementLoginAttempts(user.id);
      
      // Lock account after 5 failed attempts
      if (user.login_attempts >= 4) { // 4 because we just incremented
        await this.userRepository.lockAccount(user.id, 30); // 30 minutes
        throw new UnauthorizedError('Account locked due to multiple failed login attempts');
      }
      
      throw new UnauthorizedError('Invalid email or password');
    }

    // Generate tokens using core service
    const accessToken = this.tokenService.generateAccessToken(
      user.id,
      user.email
    );
    
    const refreshToken = this.tokenService.generateRefreshToken(
      user.id,
      user.email
    );

    // Store refresh token hash in database
    const refreshTokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await this.userRepository.storeRefreshToken(user.id, refreshTokenHash, expiresAt);

    // Update last login
    await this.userRepository.updateLastLogin(user.id);

    return {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60, // 15 minutes in seconds
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name
      }
    };
  }

  /**
   * Register new user
   */
  async register(userData: CreateUserInput): Promise<AuthResult> {
    const { email, password, firstName, lastName } = userData;

    // Validate input
    if (!email || !password || !firstName || !lastName) {
      throw new ValidationError('All fields are required');
    }

    if (password.length < 6) {
      throw new ValidationError('Password must be at least 6 characters long');
    }

    // Check if user already exists
    const existingUser = await this.userRepository.findByEmail(email.toLowerCase());
    if (existingUser) {
      throw new ConflictError('User with this email already exists');
    }

    // Create user
    const newUser = await this.userRepository.create({
      email: email.toLowerCase(),
      password,
      firstName,
      lastName
    });

    // Generate tokens
    const accessToken = this.tokenService.generateAccessToken(
      newUser.id,
      newUser.email
    );
    
    const refreshToken = this.tokenService.generateRefreshToken(
      newUser.id,
      newUser.email
    );

    // Store refresh token
    const refreshTokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await this.userRepository.storeRefreshToken(newUser.id, refreshTokenHash, expiresAt);

    return {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60, // 15 minutes in seconds
      user: {
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.first_name,
        lastName: newUser.last_name
      }
    };
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    if (!refreshToken) {
      throw new ValidationError('Refresh token is required');
    }

    // Hash the token to find in database
    const tokenHash = this.hashToken(refreshToken);
    
    // Find refresh token in database
    const dbToken = await this.userRepository.findRefreshToken(tokenHash);
    if (!dbToken) {
      throw new InvalidTokenError('Invalid or expired refresh token');
    }

    // Get user
    const user = await this.userRepository.findById(dbToken.user_id);
    if (!user) {
      throw new InvalidTokenError('User not found');
    }

    // Generate new tokens
    const newAccessToken = this.tokenService.generateAccessToken(
      user.id,
      user.email
    );
    
    const newRefreshToken = this.tokenService.generateRefreshToken(
      user.id,
      user.email
    );

    // Revoke old refresh token
    await this.userRepository.revokeRefreshToken(tokenHash);

    // Store new refresh token
    const newRefreshTokenHash = this.hashToken(newRefreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await this.userRepository.storeRefreshToken(user.id, newRefreshTokenHash, expiresAt);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: 15 * 60 // 15 minutes in seconds
    };
  }

  /**
   * Logout user
   */
  async logout(refreshToken?: string): Promise<void> {
    if (refreshToken) {
      const tokenHash = this.hashToken(refreshToken);
      await this.userRepository.revokeRefreshToken(tokenHash);
    }
  }

  /**
   * Logout all devices
   */
  async logoutAll(userId: string): Promise<void> {
    await this.userRepository.revokeAllUserTokens(userId);
  }

  /**
   * Get user by access token
   */
  async getCurrentUser(accessToken: string): Promise<UserData> {
    try {
      const payload = this.tokenService.verifyAccessToken(accessToken);
      
      const user = await this.userRepository.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedError('User not found');
      }

      return {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        emailVerified: user.email_verified,
        lastLoginAt: user.last_login_at || undefined,
        createdAt: user.created_at
      };
    } catch (error) {
      if ((error as Error).message.includes('TOKEN') || (error as Error).message.includes('token')) {
        throw new UnauthorizedError('Invalid or expired token');
      }
      throw error;
    }
  }

  /**
   * Verify if user has valid session
   */
  async verifySession(accessToken: string): Promise<boolean> {
    try {
      const payload = this.tokenService.verifyAccessToken(accessToken);
      const user = await this.userRepository.findById(payload.sub);
      return !!user && user.is_active;
    } catch {
      return false;
    }
  }

  /**
   * Clean up expired tokens (maintenance task)
   */
  async cleanupExpiredTokens(): Promise<number> {
    return this.userRepository.cleanupExpiredTokens();
  }

  /**
   * Helper method to hash tokens for storage
   */
  private hashToken(token: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
