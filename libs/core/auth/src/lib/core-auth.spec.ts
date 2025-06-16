import { TokenService } from './services/token.service';
import { JwtUtils } from './utils/jwt.utils';
import { AuthConfig } from './types/auth.types';
import { coreAuth } from './core-auth';

describe('coreAuth', () => {
  it('should return authentication message', () => {
    expect(coreAuth()).toBe(
      'AegisX Core Authentication with JWT support - Ready for Fastify integration'
    );
  });
});

describe('TokenService', () => {
  let tokenService: TokenService;
  let authConfig: AuthConfig;

  beforeEach(() => {
    authConfig = {
      jwt: {
        secret: JwtUtils.generateSecureSecret(),
        accessTokenExpiry: '15m',
        refreshTokenExpiry: '7d',
        issuer: 'test-issuer',
        algorithm: 'HS256',
      },
      security: {
        maxLoginAttempts: 5,
        lockoutDuration: 15,
        passwordMinLength: 8,
        requireEmailVerification: true,
      },
    };

    tokenService = new TokenService(authConfig);
  });

  describe('generateTokenPair', () => {
    it('should generate access and refresh tokens', () => {
      const tokens = tokenService.generateTokenPair(
        'user123',
        'test@example.com'
      );

      expect(tokens).toHaveProperty('accessToken');
      expect(tokens).toHaveProperty('refreshToken');
      expect(tokens).toHaveProperty('tokenType', 'Bearer');
      expect(tokens).toHaveProperty('expiresIn');
      expect(tokens.expiresIn).toBe(900); // 15 minutes
    });

    it('should generate different tokens for each call', () => {
      const tokens1 = tokenService.generateTokenPair(
        'user123',
        'test@example.com'
      );
      const tokens2 = tokenService.generateTokenPair(
        'user123',
        'test@example.com'
      );

      expect(tokens1.accessToken).not.toBe(tokens2.accessToken);
      expect(tokens1.refreshToken).not.toBe(tokens2.refreshToken);
    });
  });

  describe('verifyToken', () => {
    it('should verify valid access token', () => {
      const token = tokenService.generateAccessToken(
        'user123',
        'test@example.com'
      );
      const payload = tokenService.verifyAccessToken(token);

      expect(payload.sub).toBe('user123');
      expect(payload.email).toBe('test@example.com');
      expect(payload.type).toBe('access');
      expect(payload.iss).toBe('test-issuer');
    });

    it('should verify valid refresh token', () => {
      const token = tokenService.generateRefreshToken(
        'user123',
        'test@example.com'
      );
      const payload = tokenService.verifyRefreshToken(token);

      expect(payload.sub).toBe('user123');
      expect(payload.email).toBe('test@example.com');
      expect(payload.type).toBe('refresh');
    });

    it('should throw error for invalid token', () => {
      expect(() => {
        tokenService.verifyToken('invalid-token');
      }).toThrow('AUTH_TOKEN_INVALID');
    });

    it('should throw error for wrong token type', () => {
      const accessToken = tokenService.generateAccessToken(
        'user123',
        'test@example.com'
      );

      expect(() => {
        tokenService.verifyRefreshToken(accessToken);
      }).toThrow('AUTH_INVALID_TOKEN_TYPE');
    });
  });

  describe('extractTokenFromHeader', () => {
    it('should extract token from Bearer header', () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
      const header = `Bearer ${token}`;

      const extracted = tokenService.extractTokenFromHeader(header);
      expect(extracted).toBe(token);
    });

    it('should return null for invalid header format', () => {
      expect(tokenService.extractTokenFromHeader('Invalid header')).toBeNull();
      expect(tokenService.extractTokenFromHeader('')).toBeNull();
      expect(tokenService.extractTokenFromHeader('Basic token')).toBeNull();
    });
  });
});

describe('JwtUtils', () => {
  describe('generateSecureSecret', () => {
    it('should generate secret of correct length', () => {
      const secret32 = JwtUtils.generateSecureSecret(32);
      const secret64 = JwtUtils.generateSecureSecret(64);

      expect(secret32.length).toBeGreaterThanOrEqual(32);
      expect(secret64.length).toBeGreaterThanOrEqual(64);
    });

    it('should generate different secrets each time', () => {
      const secret1 = JwtUtils.generateSecureSecret();
      const secret2 = JwtUtils.generateSecureSecret();

      expect(secret1).not.toBe(secret2);
    });
  });

  describe('parseExpiryToSeconds', () => {
    it('should parse time units correctly', () => {
      expect(JwtUtils.parseExpiryToSeconds('30s')).toBe(30);
      expect(JwtUtils.parseExpiryToSeconds('15m')).toBe(900);
      expect(JwtUtils.parseExpiryToSeconds('2h')).toBe(7200);
      expect(JwtUtils.parseExpiryToSeconds('7d')).toBe(604800);
    });

    it('should throw error for invalid format', () => {
      expect(() => JwtUtils.parseExpiryToSeconds('invalid')).toThrow();
      expect(() => JwtUtils.parseExpiryToSeconds('15x')).toThrow();
      expect(() => JwtUtils.parseExpiryToSeconds('')).toThrow();
    });
  });

  describe('validateJwtConfig', () => {
    it('should validate correct config', () => {
      const config = {
        secret: JwtUtils.generateSecureSecret(),
        accessTokenExpiry: '15m',
        refreshTokenExpiry: '7d',
        issuer: 'test-issuer',
        algorithm: 'HS256',
      };

      const result = JwtUtils.validateJwtConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid config', () => {
      const config = {
        secret: 'too-short',
        accessTokenExpiry: 'invalid-format',
        issuer: '',
        algorithm: 'INVALID',
      };

      const result = JwtUtils.validateJwtConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('secureCompare', () => {
    it('should return true for identical strings', () => {
      const str = 'test-string';
      expect(JwtUtils.secureCompare(str, str)).toBe(true);
    });

    it('should return false for different strings', () => {
      expect(JwtUtils.secureCompare('string1', 'string2')).toBe(false);
    });

    it('should return false for different length strings', () => {
      expect(JwtUtils.secureCompare('short', 'longer-string')).toBe(false);
    });
  });
});
