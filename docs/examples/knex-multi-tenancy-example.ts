// Example implementation of Knex Multi-Tenancy for AegisX Platform
// This file demonstrates the core patterns and can be used as a starting point

import { Knex } from 'knex';

// ===========================
// 1. TYPES & INTERFACES
// ===========================

export interface TenantContext {
    id: string;
    name: string;
    subdomain: string;
    status: 'active' | 'suspended' | 'inactive';
    config: {
        database?: {
            strategy: 'shared' | 'schema' | 'database';
            schema?: string;
            database?: string;
        };
        limits: {
            maxUsers: number;
            maxStorage: number;
            apiRateLimit: number;
        };
    };
}

export interface BaseEntity {
    id: string;
    tenant_id: string;
    created_at: Date;
    updated_at: Date;
}

export interface User extends BaseEntity {
    email: string;
    password_hash: string;
    first_name: string;
    last_name: string;
    status: 'active' | 'inactive' | 'suspended';
    last_login_at?: Date;
}

export interface CreateUserData {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
}

// ===========================
// 2. TENANT-SAFE REPOSITORY
// ===========================

export class TenantRepository<T extends BaseEntity> {
    constructor(
        protected db: Knex,
        protected tableName: string,
        protected tenantId: string
    ) { }

    // Auto-filter by tenant_id
    protected query(): Knex.QueryBuilder<T> {
        return this.db<T>(this.tableName).where('tenant_id', this.tenantId);
    }

    async findAll(options: {
        limit?: number;
        offset?: number;
        orderBy?: string;
        where?: Record<string, any>;
    } = {}): Promise<T[]> {
        let query = this.query();

        if (options.where) {
            query = query.where(options.where);
        }

        if (options.orderBy) {
            query = query.orderBy(options.orderBy, 'desc');
        }

        if (options.limit) {
            query = query.limit(options.limit);
        }

        if (options.offset) {
            query = query.offset(options.offset);
        }

        return query.select('*');
    }

    async findById(id: string): Promise<T | null> {
        const result = await this.query().where('id', id).first();
        return result || null;
    }

    async findOne(where: Record<string, any>): Promise<T | null> {
        const result = await this.query().where(where).first();
        return result || null;
    }

    async create(data: Omit<T, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>): Promise<T> {
        const [created] = await this.db<T>(this.tableName)
            .insert({
                ...data,
                id: crypto.randomUUID(),
                tenant_id: this.tenantId,
                created_at: new Date(),
                updated_at: new Date(),
            } as any)
            .returning('*');

        return created;
    }

    async update(id: string, data: Partial<Omit<T, 'id' | 'tenant_id' | 'created_at'>>): Promise<T | null> {
        const [updated] = await this.query()
            .where('id', id)
            .update({
                ...data,
                updated_at: new Date(),
            })
            .returning('*');

        return updated || null;
    }

    async delete(id: string): Promise<boolean> {
        const deleted = await this.query().where('id', id).del();
        return deleted > 0;
    }

    async count(where?: Record<string, any>): Promise<number> {
        let query = this.query();
        if (where) {
            query = query.where(where);
        }
        const result = await query.count('* as count').first();
        return parseInt(result?.count as string) || 0;
    }

    async exists(where: Record<string, any>): Promise<boolean> {
        const count = await this.count(where);
        return count > 0;
    }

    async paginate(page: number = 1, pageSize: number = 10, options: any = {}): Promise<{
        data: T[];
        pagination: {
            page: number;
            pageSize: number;
            total: number;
            totalPages: number;
        };
    }> {
        const offset = (page - 1) * pageSize;
        const total = await this.count(options.where);
        const data = await this.findAll({
            ...options,
            limit: pageSize,
            offset,
        });

        return {
            data,
            pagination: {
                page,
                pageSize,
                total,
                totalPages: Math.ceil(total / pageSize),
            },
        };
    }
}

// ===========================
// 3. USER REPOSITORY
// ===========================

export class UserRepository extends TenantRepository<User> {
    constructor(db: Knex, tenantId: string) {
        super(db, 'users', tenantId);
    }

    async findByEmail(email: string): Promise<User | null> {
        return this.findOne({ email });
    }

    async findActiveUsers(limit?: number): Promise<User[]> {
        return this.findAll({
            where: { status: 'active' },
            orderBy: 'created_at',
            limit,
        });
    }

    async createUser(userData: CreateUserData): Promise<User> {
        // Check if email exists
        const existing = await this.findByEmail(userData.email);
        if (existing) {
            throw new Error('User with this email already exists');
        }

        // Hash password (implement proper password hashing)
        const passwordHash = await this.hashPassword(userData.password);

        return this.create({
            email: userData.email,
            password_hash: passwordHash,
            first_name: userData.first_name,
            last_name: userData.last_name,
            status: 'active',
        });
    }

    async updateLastLogin(userId: string): Promise<User | null> {
        return this.update(userId, {
            last_login_at: new Date(),
        });
    }

    async searchUsers(query: string, limit: number = 10): Promise<User[]> {
        return this.db<User>(this.tableName)
            .where('tenant_id', this.tenantId)
            .andWhere((builder) => {
                builder
                    .where('first_name', 'ilike', `%${query}%`)
                    .orWhere('last_name', 'ilike', `%${query}%`)
                    .orWhere('email', 'ilike', `%${query}%`);
            })
            .limit(limit)
            .select('*');
    }

    private async hashPassword(password: string): Promise<string> {
        // Implement proper password hashing here
        const bcrypt = require('bcrypt');
        return bcrypt.hash(password, 10);
    }
}

// ===========================
// 4. USER SERVICE
// ===========================

export class UserService {
    private userRepo: UserRepository;

    constructor(
        private db: Knex,
        private tenant: TenantContext
    ) {
        this.userRepo = new UserRepository(db, tenant.id);
    }

    async getAllUsers(): Promise<User[]> {
        return this.userRepo.findAll();
    }

    async getUserById(id: string): Promise<User | null> {
        return this.userRepo.findById(id);
    }

    async createUser(userData: CreateUserData): Promise<User> {
        // Check tenant limits
        const userCount = await this.userRepo.count();
        const maxUsers = this.tenant.config.limits.maxUsers;

        if (userCount >= maxUsers) {
            throw new Error(`User limit exceeded. Maximum ${maxUsers} users allowed.`);
        }

        return this.userRepo.createUser(userData);
    }

    async updateUser(id: string, data: Partial<CreateUserData>): Promise<User | null> {
        return this.userRepo.update(id, data);
    }

    async deleteUser(id: string): Promise<boolean> {
        return this.userRepo.delete(id);
    }

    async searchUsers(query: string, limit?: number): Promise<User[]> {
        return this.userRepo.searchUsers(query, limit);
    }

    async getUsersPaginated(page: number = 1, pageSize: number = 10) {
        return this.userRepo.paginate(page, pageSize, {
            orderBy: 'created_at',
        });
    }

    async getUserStats() {
        const [total, active, inactive, suspended] = await Promise.all([
            this.userRepo.count(),
            this.userRepo.count({ status: 'active' }),
            this.userRepo.count({ status: 'inactive' }),
            this.userRepo.count({ status: 'suspended' }),
        ]);

        return { total, active, inactive, suspended };
    }
}

// ===========================
// 5. FASTIFY PLUGIN EXAMPLE
// ===========================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';

interface TenantRequest extends FastifyRequest {
    tenant: TenantContext;
}

// Tenant middleware
export const tenantPlugin = fp(async function (fastify: FastifyInstance) {
    fastify.addHook('preHandler', async (request: TenantRequest, reply: FastifyReply) => {
        // Extract tenant from subdomain or header
        const tenantId = extractTenantId(request);

        if (!tenantId) {
            return reply.code(400).send({ error: 'Tenant identification required' });
        }

        // Load tenant context (implement your tenant loading logic)
        const tenant = await loadTenant(tenantId);
        if (!tenant || tenant.status !== 'active') {
            return reply.code(404).send({ error: 'Tenant not found or inactive' });
        }

        request.tenant = tenant;
    });
});

function extractTenantId(request: FastifyRequest): string | null {
    // Extract from subdomain
    const host = request.headers.host;
    if (host) {
        const subdomain = host.split('.')[0];
        if (subdomain && subdomain !== 'www' && subdomain !== 'api') {
            return subdomain;
        }
    }

    // Extract from header
    const tenantHeader = request.headers['x-tenant-id'] as string;
    if (tenantHeader) {
        return tenantHeader;
    }

    return null;
}

async function loadTenant(tenantId: string): Promise<TenantContext | null> {
    // Implement your tenant loading logic here
    // This could query your tenants table or cache
    return {
        id: tenantId,
        name: 'Example Tenant',
        subdomain: tenantId,
        status: 'active',
        config: {
            limits: {
                maxUsers: 100,
                maxStorage: 1024 * 1024 * 1024, // 1GB
                apiRateLimit: 1000,
            },
        },
    };
}

// ===========================
// 6. ROUTES EXAMPLE
// ===========================

export async function userRoutes(fastify: FastifyInstance) {
    // GET /users
    fastify.get('/users', async (request: TenantRequest, reply: FastifyReply) => {
        const { page = 1, pageSize = 10, search } = request.query as any;
        const userService = new UserService(fastify.knex, request.tenant);

        if (search) {
            const users = await userService.searchUsers(search);
            return { users };
        }

        return userService.getUsersPaginated(page, pageSize);
    });

    // GET /users/stats
    fastify.get('/users/stats', async (request: TenantRequest) => {
        const userService = new UserService(fastify.knex, request.tenant);
        return userService.getUserStats();
    });

    // GET /users/:id
    fastify.get('/users/:id', async (request: TenantRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string };
        const userService = new UserService(fastify.knex, request.tenant);

        const user = await userService.getUserById(id);
        if (!user) {
            return reply.code(404).send({ error: 'User not found' });
        }

        return { user };
    });

    // POST /users
    fastify.post('/users', async (request: TenantRequest, reply: FastifyReply) => {
        const userData = request.body as CreateUserData;
        const userService = new UserService(fastify.knex, request.tenant);

        try {
            const user = await userService.createUser(userData);
            return reply.code(201).send({ user });
        } catch (error: any) {
            return reply.code(400).send({ error: error.message });
        }
    });

    // PUT /users/:id
    fastify.put('/users/:id', async (request: TenantRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string };
        const updateData = request.body as Partial<CreateUserData>;
        const userService = new UserService(fastify.knex, request.tenant);

        const user = await userService.updateUser(id, updateData);
        if (!user) {
            return reply.code(404).send({ error: 'User not found' });
        }

        return { user };
    });

    // DELETE /users/:id
    fastify.delete('/users/:id', async (request: TenantRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string };
        const userService = new UserService(fastify.knex, request.tenant);

        const deleted = await userService.deleteUser(id);
        if (!deleted) {
            return reply.code(404).send({ error: 'User not found' });
        }

        return { success: true };
    });
}

// ===========================
// 7. DATABASE SETUP
// ===========================

export function createKnexInstance(): Knex {
    return require('knex')({
        client: 'postgresql',
        connection: {
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '5432'),
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || 'password',
            database: process.env.DB_NAME || 'aegisx_platform',
        },
        pool: {
            min: 2,
            max: 10,
        },
        migrations: {
            directory: './migrations',
            tableName: 'knex_migrations',
        },
    });
}

// ===========================
// 8. USAGE EXAMPLE
// ===========================

async function exampleUsage() {
    const db = createKnexInstance();

    const tenant: TenantContext = {
        id: 'company-a',
        name: 'Company A',
        subdomain: 'company-a',
        status: 'active',
        config: {
            limits: {
                maxUsers: 100,
                maxStorage: 1024 * 1024 * 1024,
                apiRateLimit: 1000,
            },
        },
    };

    const userService = new UserService(db, tenant);

    try {
        // Create a user
        const newUser = await userService.createUser({
            email: 'john@company-a.com',
            password: 'securepassword',
            first_name: 'John',
            last_name: 'Doe',
        });

        console.log('Created user:', newUser);

        // Get all users
        const users = await userService.getAllUsers();
        console.log('All users:', users);

        // Search users
        const searchResults = await userService.searchUsers('john');
        console.log('Search results:', searchResults);

        // Get paginated users
        const paginatedUsers = await userService.getUsersPaginated(1, 10);
        console.log('Paginated users:', paginatedUsers);

        // Get user stats
        const stats = await userService.getUserStats();
        console.log('User stats:', stats);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await db.destroy();
    }
}

// Export everything for use in your application
export {
    TenantRepository,
    UserRepository,
    UserService,
    tenantPlugin,
    userRoutes,
    createKnexInstance,
};
