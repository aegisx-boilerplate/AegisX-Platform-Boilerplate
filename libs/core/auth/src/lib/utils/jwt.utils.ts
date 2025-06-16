import { randomBytes, timingSafeEqual } from 'crypto';

/**
 * JWT utility functions for Fastify environment
 */
export class JwtUtils {
  /**
   * Generate cryptographically secure random string
   */
  static generateSecureSecret(length: number = 64): string {
    return randomBytes(length).toString('base64url');
  }

  /**
   * Generate random JWT ID
   */
  static generateJwtId(): string {
    return randomBytes(16).toString('hex');
  }

  /**
   * Convert expiry string to seconds
   */
  static parseExpiryToSeconds(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new Error(
        `Invalid expiry format: ${expiry}. Use format like '15m', '1h', '7d'`
      );
    }

    const [, valueStr, unit] = match;
    const value = parseInt(valueStr, 10);

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
        throw new Error(`Invalid time unit: ${unit}`);
    }
  }

  /**
   * Convert seconds to human readable format
   */
  static secondsToHumanReadable(seconds: number): string {
    const days = Math.floor(seconds / (24 * 60 * 60));
    const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((seconds % (60 * 60)) / 60);
    const remainingSeconds = seconds % 60;

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (remainingSeconds > 0) parts.push(`${remainingSeconds}s`);

    return parts.join(' ') || '0s';
  }

  /**
   * Validate JWT configuration
   */
  static validateJwtConfig(config: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config) {
      errors.push('JWT configuration is required');
      return { valid: false, errors };
    }

    if (!config.secret) {
      errors.push('JWT secret is required');
    } else if (typeof config.secret !== 'string') {
      errors.push('JWT secret must be a string');
    } else if (config.secret.length < 32) {
      errors.push('JWT secret must be at least 32 characters long');
    }

    if (!config.accessTokenExpiry) {
      errors.push('Access token expiry is required');
    } else {
      try {
        JwtUtils.parseExpiryToSeconds(config.accessTokenExpiry);
      } catch {
        errors.push('Invalid access token expiry format');
      }
    }

    if (!config.refreshTokenExpiry) {
      errors.push('Refresh token expiry is required');
    } else {
      try {
        JwtUtils.parseExpiryToSeconds(config.refreshTokenExpiry);
      } catch {
        errors.push('Invalid refresh token expiry format');
      }
    }

    if (!config.issuer) {
      errors.push('JWT issuer is required');
    } else if (typeof config.issuer !== 'string') {
      errors.push('JWT issuer must be a string');
    }

    const validAlgorithms = [
      'HS256',
      'HS384',
      'HS512',
      'RS256',
      'RS384',
      'RS512',
    ];
    if (!config.algorithm) {
      errors.push('JWT algorithm is required');
    } else if (!validAlgorithms.includes(config.algorithm)) {
      errors.push(
        `JWT algorithm must be one of: ${validAlgorithms.join(', ')}`
      );
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Create default JWT configuration
   */
  static createDefaultConfig(overrides: Partial<any> = {}): any {
    return {
      secret: JwtUtils.generateSecureSecret(),
      accessTokenExpiry: '15m',
      refreshTokenExpiry: '7d',
      issuer: 'aegisx-platform',
      algorithm: 'HS256',
      ...overrides,
    };
  }

  /**
   * Secure string comparison (timing attack resistant)
   */
  static secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    const bufferA = Buffer.from(a, 'utf8');
    const bufferB = Buffer.from(b, 'utf8');

    return timingSafeEqual(bufferA, bufferB);
  }

  /**
   * Extract user agent information for session tracking
   */
  static extractUserAgent(userAgent?: string): string {
    if (!userAgent) return 'Unknown';

    // Simple user agent parsing - can be enhanced with a proper library
    const shortened =
      userAgent.length > 200 ? userAgent.substring(0, 200) + '...' : userAgent;
    return shortened;
  }

  /**
   * Extract IP address from Fastify request
   */
  static extractIpAddress(request: any): string {
    // Check various headers that might contain the real IP
    const xForwardedFor = request.headers['x-forwarded-for'];
    const xRealIp = request.headers['x-real-ip'];
    const cfConnectingIp = request.headers['cf-connecting-ip']; // Cloudflare

    if (xForwardedFor) {
      // X-Forwarded-For can contain multiple IPs, take the first one
      const ips = xForwardedFor.split(',').map((ip: string) => ip.trim());
      return ips[0];
    }

    if (xRealIp) {
      return xRealIp;
    }

    if (cfConnectingIp) {
      return cfConnectingIp;
    }

    // Fallback to connection remote address
    return request.ip || request.connection?.remoteAddress || 'unknown';
  }

  /**
   * Generate session fingerprint for additional security
   */
  static generateSessionFingerprint(request: any): string {
    const userAgent = JwtUtils.extractUserAgent(request.headers['user-agent']);
    const acceptLanguage = request.headers['accept-language'] || '';
    const acceptEncoding = request.headers['accept-encoding'] || '';

    const fingerprint = `${userAgent}|${acceptLanguage}|${acceptEncoding}`;
    return Buffer.from(fingerprint).toString('base64');
  }

  /**
   * Check if token is close to expiry (within threshold)
   */
  static isTokenNearExpiry(
    expiryTime: Date,
    thresholdMinutes: number = 5
  ): boolean {
    const now = new Date();
    const threshold = new Date(now.getTime() + thresholdMinutes * 60 * 1000);
    return expiryTime <= threshold;
  }

  /**
   * Calculate token refresh timing
   */
  static calculateRefreshTiming(expiryTime: Date): {
    shouldRefresh: boolean;
    timeLeft: number;
  } {
    const now = new Date();
    const timeLeft = Math.max(
      0,
      Math.floor((expiryTime.getTime() - now.getTime()) / 1000)
    );
    const shouldRefresh = JwtUtils.isTokenNearExpiry(expiryTime, 5);

    return { shouldRefresh, timeLeft };
  }
}
