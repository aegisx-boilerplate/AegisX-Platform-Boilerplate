import { injectable } from 'tsyringe';
import { Knex } from 'knex';
import * as bcrypt from 'bcrypt';

/**
 * Database User Entity - สำหรับ Knex ORM
 */
export interface DbUser {
  id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  email_verified: boolean;
  email_verified_at?: Date;
  last_login_at?: Date;
  login_attempts: number;
  locked_until?: Date;
  created_at: Date;
  updated_at: Date;
}

/**
 * Database Refresh Token Entity
 */
export interface DbRefreshToken {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  is_revoked: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * Create User Input
 */
export interface CreateUserInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

/**
 * User Repository using Knex Query Builder
 */
@injectable()
export class UserRepository {
  constructor(
    private knex: Knex
  ) {}

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<DbUser | null> {
    const user = await this.knex('users')
      .where({ email, is_active: true })
      .first();
    
    return user || null;
  }

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<DbUser | null> {
    const user = await this.knex('users')
      .where({ id, is_active: true })
      .first();
    
    return user || null;
  }

  /**
   * Create new user
   */
  async create(userData: CreateUserInput): Promise<DbUser> {
    const { email, password, firstName, lastName } = userData;
    
    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    const [newUser] = await this.knex('users')
      .insert({
        email,
        password_hash: passwordHash,
        first_name: firstName,
        last_name: lastName,
        created_at: this.knex.fn.now(),
        updated_at: this.knex.fn.now()
      })
      .returning('*');
    
    return newUser;
  }

  /**
   * Verify user password
   */
  async verifyPassword(user: DbUser, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.password_hash);
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(userId: string): Promise<void> {
    await this.knex('users')
      .where({ id: userId })
      .update({
        last_login_at: this.knex.fn.now(),
        login_attempts: 0,
        updated_at: this.knex.fn.now()
      });
  }

  /**
   * Increment login attempts
   */
  async incrementLoginAttempts(userId: string): Promise<void> {
    await this.knex('users')
      .where({ id: userId })
      .increment('login_attempts', 1)
      .update({ updated_at: this.knex.fn.now() });
  }

  /**
   * Lock user account
   */
  async lockAccount(userId: string, lockDurationMinutes = 30): Promise<void> {
    const lockUntil = new Date(Date.now() + lockDurationMinutes * 60 * 1000);
    
    await this.knex('users')
      .where({ id: userId })
      .update({
        locked_until: lockUntil,
        updated_at: this.knex.fn.now()
      });
  }

  /**
   * Check if account is locked
   */
  async isAccountLocked(user: DbUser): Promise<boolean> {
    if (!user.locked_until) return false;
    return new Date() < user.locked_until;
  }

  /**
   * Store refresh token
   */
  async storeRefreshToken(
    userId: string, 
    tokenHash: string, 
    expiresAt: Date
  ): Promise<DbRefreshToken> {
    const [refreshToken] = await this.knex('refresh_tokens')
      .insert({
        user_id: userId,
        token_hash: tokenHash,
        expires_at: expiresAt,
        created_at: this.knex.fn.now(),
        updated_at: this.knex.fn.now()
      })
      .returning('*');
    
    return refreshToken;
  }

  /**
   * Find refresh token
   */
  async findRefreshToken(tokenHash: string): Promise<DbRefreshToken | null> {
    const token = await this.knex('refresh_tokens')
      .where({
        token_hash: tokenHash,
        is_revoked: false
      })
      .andWhere('expires_at', '>', this.knex.fn.now())
      .first();
    
    return token || null;
  }

  /**
   * Revoke refresh token
   */
  async revokeRefreshToken(tokenHash: string): Promise<void> {
    await this.knex('refresh_tokens')
      .where({ token_hash: tokenHash })
      .update({
        is_revoked: true,
        updated_at: this.knex.fn.now()
      });
  }

  /**
   * Revoke all user refresh tokens
   */
  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.knex('refresh_tokens')
      .where({ user_id: userId, is_revoked: false })
      .update({
        is_revoked: true,
        updated_at: this.knex.fn.now()
      });
  }

  /**
   * Clean up expired tokens
   */
  async cleanupExpiredTokens(): Promise<number> {
    const result = await this.knex('refresh_tokens')
      .where('expires_at', '<', this.knex.fn.now())
      .del();
    
    return result;
  }
}
