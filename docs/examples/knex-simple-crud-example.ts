// Simple Knex CRUD Example (Single-Tenant)
// This file shows TypeScript interfaces and patterns for single-tenant CRUD operations
// Install first: npm install knex pg bcryptjs uuid @types/node @types/bcryptjs @types/uuid

import { Knex } from 'knex';

// ===========================
// 1. TYPES & INTERFACES
// ===========================

export interface User {
    id: string;
    email: string;
    password_hash: string;
    first_name: string;
    last_name: string;
    status: 'active' | 'inactive' | 'suspended';
    created_at: Date;
    updated_at: Date;
    last_login_at?: Date;
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

export interface Post {
    id: string;
    user_id: string;
    title: string;
    content: string;
    status: 'draft' | 'published' | 'archived';
    created_at: Date;
    updated_at: Date;
    published_at?: Date;
}

export interface CreatePostData {
    user_id: string;
    title: string;
    content: string;
    status?: 'draft' | 'published';
}

export interface PaginatedResult<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

// ===========================
// 2. DATABASE CONFIGURATION
// ===========================

export interface DatabaseConfig {
    client: 'postgresql';
    connection: {
        host: string;
        port: number;
        user: string;
        password: string;
        database: string;
    };
    pool: {
        min: number;
        max: number;
    };
}

export const createDatabaseConfig = (): DatabaseConfig => ({
    client: 'postgresql',
    connection: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'password',
        database: process.env.DB_NAME || 'myapp',
    },
    pool: {
        min: 2,
        max: 10
    }
});

// ===========================
// 3. BASE REPOSITORY PATTERN
// ===========================

export abstract class BaseRepository<T> {
    constructor(
        protected db: Knex,
        protected tableName: string
    ) { }

    async findAll(): Promise<T[]> {
        return this.db(this.tableName).select('*');
    }

    async findById(id: string): Promise<T | undefined> {
        const result = await this.db(this.tableName)
            .where('id', id)
            .first();
        return result;
    }

    async create(data: Partial<T>): Promise<T> {
        const [created] = await this.db(this.tableName)
            .insert(data)
            .returning('*');
        return created;
    }

    async update(id: string, data: Partial<T>): Promise<T | undefined> {
        const [updated] = await this.db(this.tableName)
            .where('id', id)
            .update({
                ...data,
                updated_at: new Date()
            })
            .returning('*');
        return updated;
    }

    async delete(id: string): Promise<boolean> {
        const deletedCount = await this.db(this.tableName)
            .where('id', id)
            .del();
        return deletedCount > 0;
    }

    async exists(id: string): Promise<boolean> {
        const result = await this.db(this.tableName)
            .where('id', id)
            .first();
        return !!result;
    }

    async count(): Promise<number> {
        const result = await this.db(this.tableName).count('* as count').first();
        return parseInt(result?.count as string) || 0;
    }

    async getPaginated(page: number = 1, limit: number = 10): Promise<PaginatedResult<T>> {
        const offset = (page - 1) * limit;

        const [data, totalResult] = await Promise.all([
            this.db(this.tableName)
                .limit(limit)
                .offset(offset)
                .orderBy('created_at', 'desc')
                .select('*'),
            this.count()
        ]);

        return {
            data,
            total: totalResult,
            page,
            limit,
            totalPages: Math.ceil(totalResult / limit)
        };
    }
}

// ===========================
// 4. USER REPOSITORY
// ===========================

export class UserRepository extends BaseRepository<User> {
    constructor(db: Knex) {
        super(db, 'users');
    }

    async findByEmail(email: string): Promise<User | undefined> {
        return this.db(this.tableName)
            .where('email', email)
            .first();
    }

    async findActive(): Promise<User[]> {
        return this.db(this.tableName)
            .where('status', 'active')
            .select('*');
    }

    async updateLastLogin(id: string): Promise<void> {
        await this.db(this.tableName)
            .where('id', id)
            .update({
                last_login_at: new Date(),
                updated_at: new Date()
            });
    }

    async searchByName(query: string): Promise<User[]> {
        return this.db(this.tableName)
            .where('first_name', 'ilike', `%${query}%`)
            .orWhere('last_name', 'ilike', `%${query}%`)
            .select('*');
    }

    async getUserStats(): Promise<{
        total: number;
        active: number;
        inactive: number;
        suspended: number;
    }> {
        const stats = await this.db(this.tableName)
            .select('status')
            .count('* as count')
            .groupBy('status');

        const result = {
            total: 0,
            active: 0,
            inactive: 0,
            suspended: 0
        };

        stats.forEach(stat => {
            const count = parseInt(stat.count as string);
            result.total += count;
            result[stat.status as keyof typeof result] = count;
        });

        return result;
    }
}

// ===========================
// 5. POST REPOSITORY
// ===========================

export class PostRepository extends BaseRepository<Post> {
    constructor(db: Knex) {
        super(db, 'posts');
    }

    async findByUserId(userId: string): Promise<Post[]> {
        return this.db(this.tableName)
            .where('user_id', userId)
            .orderBy('created_at', 'desc')
            .select('*');
    }

    async findPublished(): Promise<Post[]> {
        return this.db(this.tableName)
            .where('status', 'published')
            .orderBy('published_at', 'desc')
            .select('*');
    }

    async findByStatus(status: Post['status']): Promise<Post[]> {
        return this.db(this.tableName)
            .where('status', status)
            .orderBy('created_at', 'desc')
            .select('*');
    }

    async searchByTitle(query: string): Promise<Post[]> {
        return this.db(this.tableName)
            .where('title', 'ilike', `%${query}%`)
            .orderBy('created_at', 'desc')
            .select('*');
    }

    async getPostsWithUser(): Promise<(Post & {
        user: Pick<User, 'id' | 'first_name' | 'last_name' | 'email'>
    })[]> {
        return this.db(this.tableName)
            .join('users', 'posts.user_id', 'users.id')
            .select(
                'posts.*',
                'users.first_name as user_first_name',
                'users.last_name as user_last_name',
                'users.email as user_email'
            )
            .orderBy('posts.created_at', 'desc')
            .then(results =>
                results.map(row => ({
                    ...row,
                    user: {
                        id: row.user_id,
                        first_name: row.user_first_name,
                        last_name: row.user_last_name,
                        email: row.user_email
                    }
                }))
            );
    }
}

// ===========================
// 6. SERVICE LAYER INTERFACES
// ===========================

export interface IUserService {
    createUser(userData: CreateUserData): Promise<User>;
    getUserById(id: string): Promise<User>;
    getUserByEmail(email: string): Promise<User>;
    updateUser(id: string, updateData: UpdateUserData): Promise<User>;
    deleteUser(id: string): Promise<void>;
    getAllUsers(): Promise<User[]>;
    getUsersPaginated(page?: number, limit?: number): Promise<PaginatedResult<User>>;
    verifyPassword(email: string, password: string): Promise<User>;
    getUserStats(): Promise<{
        total: number;
        active: number;
        inactive: number;
        suspended: number;
    }>;
}

export interface IPostService {
    createPost(postData: CreatePostData): Promise<Post>;
    getPostById(id: string): Promise<Post>;
    updatePost(id: string, updateData: Partial<CreatePostData>): Promise<Post>;
    deletePost(id: string): Promise<void>;
    getPostsByUser(userId: string): Promise<Post[]>;
    getPublishedPosts(): Promise<Post[]>;
    searchPosts(query: string): Promise<Post[]>;
}

// ===========================
// 7. MIGRATION HELPERS
// ===========================

export interface MigrationHelper {
    createTables(db: Knex): Promise<void>;
    dropTables(db: Knex): Promise<void>;
}

export const migrationHelper: MigrationHelper = {
    async createTables(db: Knex): Promise<void> {
        // Create users table
        await db.schema.createTable('users', (table) => {
            table.uuid('id').primary();
            table.string('email').unique().notNullable();
            table.string('password_hash').notNullable();
            table.string('first_name').notNullable();
            table.string('last_name').notNullable();
            table.enum('status', ['active', 'inactive', 'suspended']).defaultTo('active');
            table.timestamp('created_at').defaultTo(db.fn.now());
            table.timestamp('updated_at').defaultTo(db.fn.now());
            table.timestamp('last_login_at').nullable();

            // Indexes
            table.index('email');
            table.index('status');
            table.index('created_at');
        });

        // Create posts table
        await db.schema.createTable('posts', (table) => {
            table.uuid('id').primary();
            table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
            table.string('title').notNullable();
            table.text('content').notNullable();
            table.enum('status', ['draft', 'published', 'archived']).defaultTo('draft');
            table.timestamp('created_at').defaultTo(db.fn.now());
            table.timestamp('updated_at').defaultTo(db.fn.now());
            table.timestamp('published_at').nullable();

            // Indexes
            table.index('user_id');
            table.index('status');
            table.index('created_at');
        });
    },

    async dropTables(db: Knex): Promise<void> {
        await db.schema.dropTableIfExists('posts');
        await db.schema.dropTableIfExists('users');
    }
};

// ===========================
// 8. FASTIFY CONTROLLER TYPES
// ===========================

export interface FastifyRequest {
    params: Record<string, string>;
    query: Record<string, string>;
    body: Record<string, any>;
}

export interface FastifyReply {
    code(statusCode: number): FastifyReply;
    send(payload: any): FastifyReply;
}

export interface UserControllerHandlers {
    getUsers(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply>;
    getUserById(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply>;
    createUser(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply>;
    updateUser(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply>;
    deleteUser(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply>;
    getUserStats(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply>;
}

// ===========================
// 9. VALIDATION SCHEMAS
// ===========================

export interface ValidationSchema {
    createUser: {
        email: string;
        password: string;
        first_name: string;
        last_name: string;
    };
    updateUser: {
        first_name?: string;
        last_name?: string;
        status?: 'active' | 'inactive' | 'suspended';
    };
    createPost: {
        user_id: string;
        title: string;
        content: string;
        status?: 'draft' | 'published';
    };
    updatePost: {
        title?: string;
        content?: string;
        status?: 'draft' | 'published' | 'archived';
    };
}

// ===========================
// 10. ERROR TYPES
// ===========================

export class NotFoundError extends Error {
    constructor(resource: string, id: string) {
        super(`${resource} with id ${id} not found`);
        this.name = 'NotFoundError';
    }
}

export class ValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ValidationError';
    }
}

export class DuplicateError extends Error {
    constructor(field: string, value: string) {
        super(`${field} '${value}' already exists`);
        this.name = 'DuplicateError';
    }
}

// ===========================
// 11. USAGE EXAMPLE TYPES
// ===========================

export interface UsageExample {
    setupDatabase(): Promise<void>;
    createSampleUser(): Promise<User>;
    createSamplePost(userId: string): Promise<Post>;
    demonstratePagination(): Promise<PaginatedResult<User>>;
    demonstrateSearch(): Promise<User[]>;
    cleanup(): Promise<void>;
}

// This file provides the TypeScript structure and patterns for implementing
// a simple single-tenant CRUD system with Knex.js
// 
// To use this in practice:
// 1. npm install knex pg bcryptjs uuid @types/node @types/bcryptjs @types/uuid
// 2. Implement the concrete service classes using these interfaces
// 3. Set up your database connection using the DatabaseConfig
// 4. Use the migration helper to create your tables
// 5. Implement your Fastify routes using the controller types

export default {
    BaseRepository,
    UserRepository,
    PostRepository,
    migrationHelper,
    createDatabaseConfig,
    NotFoundError,
    ValidationError,
    DuplicateError
};
