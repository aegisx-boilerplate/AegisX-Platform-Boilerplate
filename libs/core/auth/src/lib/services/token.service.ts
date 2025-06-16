import * as jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { JwtPayload, TokenPair, AuthConfig } from '../types/auth.types';

/**
 * Token service for JWT management in Fastify environment
 */
export class TokenService {
  constructor(private config: AuthConfig) {
    this.validateConfig();
  }

  /**
   * Generate access token with standard claims
   */
  generateAccessToken(
    userId: string,
    email: string,
    sessionId?: string
  ): string {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      sub: userId,
      email,
      type: 'access',
      iat: now,
      iss: this.config.jwt.issuer,
      jti: sessionId || this.generateJti(),
    };

    return jwt.sign(payload, this.config.jwt.secret, {
      expiresIn: this.config.jwt.accessTokenExpiry,
      algorithm: this.config.jwt.algorithm,
    } as jwt.SignOptions);
  }

  /**
   * Generate refresh token with extended expiry
   */
  generateRefreshToken(
    userId: string,
    email: string,
    sessionId?: string
  ): string {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      sub: userId,
      email,
      type: 'refresh',
      iat: now,
      iss: this.config.jwt.issuer,
      jti: sessionId || this.generateJti(),
    };

    return jwt.sign(payload, this.config.jwt.secret, {
      expiresIn: this.config.jwt.refreshTokenExpiry,
      algorithm: this.config.jwt.algorithm,
    } as jwt.SignOptions);
  }

  /**
   * Generate complete token pair
   */
  generateTokenPair(
    userId: string,
    email: string,
    sessionId?: string
  ): TokenPair {
    const accessToken = this.generateAccessToken(userId, email, sessionId);
    const refreshToken = this.generateRefreshToken(userId, email, sessionId);

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.parseExpiryToSeconds(this.config.jwt.accessTokenExpiry),
    };
  }

  /**
   * Verify and decode JWT token
   */
  verifyToken(token: string): JwtPayload {
    try {
      const decoded = jwt.verify(token, this.config.jwt.secret, {
        issuer: this.config.jwt.issuer,
        algorithms: [this.config.jwt.algorithm],
      }) as JwtPayload;

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('AUTH_TOKEN_EXPIRED');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('AUTH_TOKEN_INVALID');
      }
      if (error instanceof jwt.NotBeforeError) {
        throw new Error('AUTH_TOKEN_NOT_ACTIVE');
      }
      throw new Error('AUTH_TOKEN_VERIFICATION_FAILED');
    }
  }

  /**
   * Verify access token specifically
   */
  verifyAccessToken(token: string): JwtPayload {
    const payload = this.verifyToken(token);

    if (payload.type !== 'access') {
      throw new Error('AUTH_INVALID_TOKEN_TYPE');
    }

    return payload;
  }

  /**
   * Verify refresh token specifically
   */
  verifyRefreshToken(token: string): JwtPayload {
    const payload = this.verifyToken(token);

    if (payload.type !== 'refresh') {
      throw new Error('AUTH_INVALID_TOKEN_TYPE');
    }

    return payload;
  }

  /**
   * Extract token from Authorization header (Fastify style)
   */
  extractTokenFromHeader(authHeader: string): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    return authHeader.substring(7).trim();
  }

  /**
   * Decode token without verification (for inspection)
   */
  decodeToken(token: string): JwtPayload | null {
    try {
      return jwt.decode(token) as JwtPayload;
    } catch {
      return null;
    }
  }

  /**
   * Get token expiration time
   */
  getTokenExpiration(token: string): Date | null {
    const decoded = this.decodeToken(token);
    return decoded?.exp ? new Date(decoded.exp * 1000) : null;
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(token: string): boolean {
    const expiration = this.getTokenExpiration(token);
    return expiration ? expiration.getTime() < Date.now() : true;
  }

  /**
   * Get time until token expires (in seconds)
   */
  getTimeToExpiry(token: string): number {
    const expiration = this.getTokenExpiration(token);
    if (!expiration) return 0;

    const now = Date.now();
    const timeLeft = Math.max(
      0,
      Math.floor((expiration.getTime() - now) / 1000)
    );
    return timeLeft;
  }

  /**
   * Generate unique JWT ID
   */
  private generateJti(): string {
    return randomBytes(16).toString('hex');
  }

  /**
   * Parse expiry string to seconds
   */
  private parseExpiryToSeconds(expiry: string): number {
    const unit = expiry.slice(-1);
    const value = parseInt(expiry.slice(0, -1));

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 60 * 60;
      case 'd':
        return value * 60 * 60 * 24;
      default:
        throw new Error(`Invalid expiry format: ${expiry}`);
    }
  }

  /**
   * Validate JWT configuration
   */
  private validateConfig(): void {
    const { jwt } = this.config;

    if (!jwt.secret || jwt.secret.length < 32) {
      throw new Error('JWT secret must be at least 32 characters long');
    }

    if (!jwt.accessTokenExpiry || !jwt.refreshTokenExpiry) {
      throw new Error('Token expiry times must be specified');
    }

    if (!jwt.issuer) {
      throw new Error('JWT issuer must be specified');
    }

    if (!jwt.algorithm) {
      throw new Error('JWT algorithm must be specified');
    }
  }
}
