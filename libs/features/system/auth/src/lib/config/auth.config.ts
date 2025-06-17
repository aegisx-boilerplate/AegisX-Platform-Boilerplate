import { container } from 'tsyringe';
import { Knex } from 'knex';
import { FastifyInstance } from 'fastify';
import { TokenService } from '@aegisx/core-auth';
import { UserRepository } from '../repositories/user.repository';
import { AuthService } from '../services/auth.service';

/**
 * Register authentication services with DI container using Knex
 */
export function registerAuthServices(knexInstance: Knex): void {
  // Create instances manually (simpler than complex DI setup)
  const userRepository = new UserRepository(knexInstance);
  const tokenService = new TokenService({
    jwt: {
      secret: process.env['JWT_SECRET'] || 'your-secret-key',
      issuer: 'aegisx-platform',
      algorithm: 'HS256',
      accessTokenExpiry: '15m',
      refreshTokenExpiry: '7d'
    },
    security: {
      maxLoginAttempts: 5,
      lockoutDuration: 30,
      passwordMinLength: 6,
      requireEmailVerification: false
    }
  });
  const authService = new AuthService(userRepository, tokenService);

  // Register with container
  container.registerInstance('UserRepository', userRepository);
  container.registerInstance('TokenService', tokenService);
  container.registerInstance('AuthService', authService);
}

/**
 * Initialize auth services with Fastify database plugin
 */
export function initializeAuthServices(fastify: FastifyInstance): void {
  // Get Knex instance from Fastify database plugin
  if (fastify.db) {
    registerAuthServices(fastify.db);
  } else {
    throw new Error('Database instance not found. Make sure to register @aegisx/core-database plugin first.');
  }
}

/**
 * Cleanup resources
 */
export async function cleanupAuthServices(): Promise<void> {
  try {
    // Knex cleanup is handled by the database plugin
    console.log('Auth services cleanup completed');
  } catch (error) {
    console.error('Error cleaning up auth services:', error);
  }
}
