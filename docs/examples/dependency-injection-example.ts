// Dependency Injection with TSyringe - Complete Example
// Install: npm install tsyringe reflect-metadata
// Install dev: npm install -D @types/node

import 'reflect-metadata';
import { injectable, inject, container, singleton } from 'tsyringe';

// ===========================
// 1. TYPES & INTERFACES
// ===========================

export interface User {
    id: string;
    tenant_id: string;
    email: string;
    password_hash: string;
    first_name: string;
    last_name: string;
    status: 'active' | 'inactive' | 'suspended';
    created_at: Date;
    updated_at: Date;
}

export interface CreateUserData {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
}

export interface UpdateUserData {
    first_name?: string;
    last_name?: string;
    status?: 'active' | 'inactive' | 'suspended';
}

// ===========================
// 2. CORE INTERFACES
// ===========================

// Database interface
export interface IDatabase {
    query(sql: string, params?: any[]): Promise<any[]>;
    transaction<T>(callback: (trx: any) => Promise<T>): Promise<T>;
}

// Logger interface
export interface ILogger {
    info(message: string, meta?: any): void;
    error(message: string, error?: Error): void;
    warn(message: string, meta?: any): void;
    debug(message: string, meta?: any): void;
}

// Cache interface
export interface ICache {
    get(key: string): Promise<string | null>;
    set(key: string, value: string, ttl?: number): Promise<void>;
    del(key: string): Promise<void>;
}

// Repository interface
export interface IRepository<T> {
    findAll(): Promise<T[]>;
    findById(id: string): Promise<T | undefined>;
    create(data: Partial<T>): Promise<T>;
    update(id: string, data: Partial<T>): Promise<T | undefined>;
    delete(id: string): Promise<boolean>;
}

// User repository interface
export interface IUserRepository extends IRepository<User> {
    findByEmail(email: string): Promise<User | undefined>;
    findByTenantId(tenantId: string): Promise<User[]>;
    updateLastLogin(id: string): Promise<void>;
}

// User service interface
export interface IUserService {
    createUser(tenantId: string, userData: CreateUserData): Promise<User>;
    getUserById(tenantId: string, id: string): Promise<User>;
    updateUser(tenantId: string, id: string, updateData: UpdateUserData): Promise<User>;
    deleteUser(tenantId: string, id: string): Promise<void>;
    getUsersByTenant(tenantId: string): Promise<User[]>;
}

// ===========================
// 3. DEPENDENCY INJECTION TOKENS
// ===========================

export const TOKENS = {
    Database: Symbol('Database'),
    Logger: Symbol('Logger'),
    Cache: Symbol('Cache'),
    UserRepository: Symbol('UserRepository'),
    UserService: Symbol('UserService')
} as const;

// ===========================
// 4. CORE IMPLEMENTATIONS
// ===========================

@singleton()
@injectable()
export class DatabaseService implements IDatabase {
    private connectionString: string;

    constructor() {
        this.connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/aegisx';
        console.log('🗄️  Database service initialized');
    }

    async query(sql: string, params?: any[]): Promise<any[]> {
        // Mock implementation - replace with actual database query
        console.log(`📊 Executing SQL: ${sql}`, params);
        return [];
    }

    async transaction<T>(callback: (trx: any) => Promise<T>): Promise<T> {
        // Mock implementation - replace with actual transaction
        console.log('🔄 Starting transaction');
        try {
            const result = await callback(this);
            console.log('✅ Transaction committed');
            return result;
        } catch (error) {
            console.log('❌ Transaction rolled back');
            throw error;
        }
    }
}

@singleton()
@injectable()
export class LoggerService implements ILogger {
    private context: string;

    constructor() {
        this.context = 'AegisX';
        console.log('📝 Logger service initialized');
    }

    info(message: string, meta?: any): void {
        console.log(`[INFO] ${this.context}: ${message}`, meta || '');
    }

    error(message: string, error?: Error): void {
        console.error(`[ERROR] ${this.context}: ${message}`, error?.stack || '');
    }

    warn(message: string, meta?: any): void {
        console.warn(`[WARN] ${this.context}: ${message}`, meta || '');
    }

    debug(message: string, meta?: any): void {
        console.debug(`[DEBUG] ${this.context}: ${message}`, meta || '');
    }
}

@singleton()
@injectable()
export class CacheService implements ICache {
    private cache = new Map<string, { value: string; expiry: number }>();

    constructor() {
        console.log('⚡ Cache service initialized');
    }

    async get(key: string): Promise<string | null> {
        const item = this.cache.get(key);
        if (!item) return null;

        if (Date.now() > item.expiry) {
            this.cache.delete(key);
            return null;
        }

        return item.value;
    }

    async set(key: string, value: string, ttl: number = 300): Promise<void> {
        const expiry = Date.now() + (ttl * 1000);
        this.cache.set(key, { value, expiry });
    }

    async del(key: string): Promise<void> {
        this.cache.delete(key);
    }
}

// ===========================
// 5. REPOSITORY IMPLEMENTATION
// ===========================

@injectable()
export class UserRepository implements IUserRepository {
    constructor(
        @inject(TOKENS.Database) private database: IDatabase,
        @inject(TOKENS.Logger) private logger: ILogger
    ) {
        this.logger.info('UserRepository initialized');
    }

    async findAll(): Promise<User[]> {
        this.logger.info('Finding all users');
        const result = await this.database.query('SELECT * FROM users');
        return result;
    }

    async findById(id: string): Promise<User | undefined> {
        this.logger.info('Finding user by ID', { id });
        const result = await this.database.query('SELECT * FROM users WHERE id = $1', [id]);
        return result[0];
    }

    async create(data: Partial<User>): Promise<User> {
        this.logger.info('Creating new user', { email: data.email });
        const result = await this.database.query(
            'INSERT INTO users (id, tenant_id, email, password_hash, first_name, last_name, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
            [data.id, data.tenant_id, data.email, data.password_hash, data.first_name, data.last_name, data.status, data.created_at, data.updated_at]
        );
        return result[0];
    }

    async update(id: string, data: Partial<User>): Promise<User | undefined> {
        this.logger.info('Updating user', { id });
        const result = await this.database.query(
            'UPDATE users SET first_name = $1, last_name = $2, updated_at = $3 WHERE id = $4 RETURNING *',
            [data.first_name, data.last_name, new Date(), id]
        );
        return result[0];
    }

    async delete(id: string): Promise<boolean> {
        this.logger.info('Deleting user', { id });
        const result = await this.database.query('DELETE FROM users WHERE id = $1', [id]);
        return result.length > 0;
    }

    async findByEmail(email: string): Promise<User | undefined> {
        this.logger.info('Finding user by email', { email });
        const result = await this.database.query('SELECT * FROM users WHERE email = $1', [email]);
        return result[0];
    }

    async findByTenantId(tenantId: string): Promise<User[]> {
        this.logger.info('Finding users by tenant ID', { tenantId });
        const result = await this.database.query('SELECT * FROM users WHERE tenant_id = $1', [tenantId]);
        return result;
    }

    async updateLastLogin(id: string): Promise<void> {
        this.logger.info('Updating last login', { id });
        await this.database.query(
            'UPDATE users SET last_login_at = $1, updated_at = $2 WHERE id = $3',
            [new Date(), new Date(), id]
        );
    }
}

// ===========================
// 6. SERVICE IMPLEMENTATION
// ===========================

@injectable()
export class UserService implements IUserService {
    constructor(
        @inject(TOKENS.UserRepository) private userRepository: IUserRepository,
        @inject(TOKENS.Logger) private logger: ILogger,
        @inject(TOKENS.Cache) private cache: ICache
    ) {
        this.logger.info('UserService initialized');
    }

    async createUser(tenantId: string, userData: CreateUserData): Promise<User> {
        this.logger.info('Creating user', { tenantId, email: userData.email });

        // Check if email exists
        const existingUser = await this.userRepository.findByEmail(userData.email);
        if (existingUser && existingUser.tenant_id === tenantId) {
            throw new Error('Email already exists in this tenant');
        }

        // Hash password (mock implementation)
        const passwordHash = `hashed_${userData.password}`;

        // Create user
        const newUser = await this.userRepository.create({
            id: `user_${Date.now()}`,
            tenant_id: tenantId,
            email: userData.email,
            password_hash: passwordHash,
            first_name: userData.first_name,
            last_name: userData.last_name,
            status: 'active',
            created_at: new Date(),
            updated_at: new Date()
        });

        // Clear cache
        await this.cache.del(`users:tenant:${tenantId}`);

        this.logger.info('User created successfully', { userId: newUser.id });
        return newUser;
    }

    async getUserById(tenantId: string, id: string): Promise<User> {
        this.logger.info('Getting user by ID', { tenantId, id });

        const user = await this.userRepository.findById(id);

        if (!user || user.tenant_id !== tenantId) {
            throw new Error('User not found');
        }

        return user;
    }

    async updateUser(tenantId: string, id: string, updateData: UpdateUserData): Promise<User> {
        this.logger.info('Updating user', { tenantId, id });

        // Verify user belongs to tenant
        await this.getUserById(tenantId, id);

        const updatedUser = await this.userRepository.update(id, updateData);
        if (!updatedUser) {
            throw new Error('User not found');
        }

        // Clear cache
        await this.cache.del(`users:tenant:${tenantId}`);

        this.logger.info('User updated successfully', { userId: id });
        return updatedUser;
    }

    async deleteUser(tenantId: string, id: string): Promise<void> {
        this.logger.info('Deleting user', { tenantId, id });

        // Verify user belongs to tenant
        await this.getUserById(tenantId, id);

        const deleted = await this.userRepository.delete(id);
        if (!deleted) {
            throw new Error('User not found');
        }

        // Clear cache
        await this.cache.del(`users:tenant:${tenantId}`);

        this.logger.info('User deleted successfully', { userId: id });
    }

    async getUsersByTenant(tenantId: string): Promise<User[]> {
        this.logger.info('Getting users by tenant', { tenantId });

        // Try cache first
        const cacheKey = `users:tenant:${tenantId}`;
        const cached = await this.cache.get(cacheKey);

        if (cached) {
            this.logger.info('Users retrieved from cache', { tenantId });
            return JSON.parse(cached);
        }

        // Get from database
        const users = await this.userRepository.findByTenantId(tenantId);

        // Cache for 5 minutes
        await this.cache.set(cacheKey, JSON.stringify(users), 300);

        this.logger.info('Users retrieved from database', { tenantId, count: users.length });
        return users;
    }
}

// ===========================
// 7. CONTROLLER
// ===========================

export interface FastifyRequest {
    params: Record<string, string>;
    query: Record<string, string>;
    body: Record<string, any>;
    tenant: { id: string; name: string };
}

export interface FastifyReply {
    code(statusCode: number): FastifyReply;
    send(payload: any): FastifyReply;
}

@injectable()
export class UserController {
    constructor(
        @inject(TOKENS.UserService) private userService: IUserService,
        @inject(TOKENS.Logger) private logger: ILogger
    ) {
        this.logger.info('UserController initialized');
    }

    async getUsers(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
        try {
            const users = await this.userService.getUsersByTenant(request.tenant.id);

            return reply.code(200).send({
                success: true,
                data: users
            });
        } catch (error: any) {
            this.logger.error('Error getting users', error);
            return reply.code(500).send({
                success: false,
                message: error.message
            });
        }
    }

    async getUserById(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
        try {
            const { id } = request.params;
            const user = await this.userService.getUserById(request.tenant.id, id);

            return reply.code(200).send({
                success: true,
                data: user
            });
        } catch (error: any) {
            this.logger.error('Error getting user', error);
            const statusCode = error.message === 'User not found' ? 404 : 500;
            return reply.code(statusCode).send({
                success: false,
                message: error.message
            });
        }
    }

    async createUser(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
        try {
            const userData = request.body as CreateUserData;
            const user = await this.userService.createUser(request.tenant.id, userData);

            return reply.code(201).send({
                success: true,
                data: user
            });
        } catch (error: any) {
            this.logger.error('Error creating user', error);
            const statusCode = error.message.includes('already exists') ? 400 : 500;
            return reply.code(statusCode).send({
                success: false,
                message: error.message
            });
        }
    }
}

// ===========================
// 8. CONTAINER SETUP
// ===========================

export function setupContainer(): void {
    // Register core services
    container.register(TOKENS.Database, { useClass: DatabaseService });
    container.register(TOKENS.Logger, { useClass: LoggerService });
    container.register(TOKENS.Cache, { useClass: CacheService });

    // Register user module
    container.register(TOKENS.UserRepository, { useClass: UserRepository });
    container.register(TOKENS.UserService, { useClass: UserService });
    container.registerSingleton(UserController);

    console.log('✅ DI Container setup completed');
}

// ===========================
// 9. USAGE EXAMPLES
// ===========================

export async function demonstrateDI(): Promise<void> {
    console.log('🚀 Starting DI Demonstration...\n');

    // Setup container
    setupContainer();

    // Resolve services
    const userController = container.resolve(UserController);
    const userService = container.resolve<IUserService>(TOKENS.UserService);

    // Mock request/reply objects
    const mockRequest: FastifyRequest = {
        params: {},
        query: {},
        body: {
            email: 'john@example.com',
            password: 'password123',
            first_name: 'John',
            last_name: 'Doe'
        },
        tenant: { id: 'tenant-123', name: 'Acme Corp' }
    };

    const mockReply: FastifyReply = {
        code: (statusCode: number) => {
            console.log(`📊 Response Status: ${statusCode}`);
            return mockReply;
        },
        send: (payload: any) => {
            console.log('📤 Response Body:', JSON.stringify(payload, null, 2));
            return mockReply;
        }
    };

    try {
        console.log('1️⃣ Creating user through controller...');
        await userController.createUser(mockRequest, mockReply);

        console.log('\n2️⃣ Getting users through service...');
        const users = await userService.getUsersByTenant('tenant-123');
        console.log(`Found ${users.length} users`);

        console.log('\n3️⃣ Testing caching...');
        const cachedUsers = await userService.getUsersByTenant('tenant-123');
        console.log(`Found ${cachedUsers.length} users (from cache)`);

    } catch (error) {
        console.error('❌ Error during demonstration:', error);
    }

    console.log('\n✅ DI Demonstration completed!');
}

// ===========================
// 10. TESTING HELPERS
// ===========================

export function createTestContainer(): typeof container {
    const testContainer = container.createChildContainer();

    // Register mock implementations
    const mockDatabase: IDatabase = {
        query: jest.fn().mockResolvedValue([]),
        transaction: jest.fn().mockImplementation(callback => callback(mockDatabase))
    };

    const mockLogger: ILogger = {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    };

    const mockCache: ICache = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined),
        del: jest.fn().mockResolvedValue(undefined)
    };

    testContainer.register(TOKENS.Database, { useValue: mockDatabase });
    testContainer.register(TOKENS.Logger, { useValue: mockLogger });
    testContainer.register(TOKENS.Cache, { useValue: mockCache });

    return testContainer;
}

// Export everything for easy usage
export {
    container,
    TOKENS,
    setupContainer,
    demonstrateDI,
    createTestContainer
};

// Example usage:
// import { setupContainer, demonstrateDI } from './di-example';
// setupContainer();
// demonstrateDI();
