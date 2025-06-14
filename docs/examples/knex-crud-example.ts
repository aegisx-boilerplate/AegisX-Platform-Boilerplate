// Basic Knex CRUD Implementation (Single-Tenant)
// This example shows simple CRUD operations without multi-tenancy complexity
// Note: Install dependencies first: npm install knex pg bcryptjs uuid @types/node

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

// ===========================
// 2. DATABASE SETUP
// ===========================

/*
import knex, { Knex } from 'knex';

const db = knex({
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
*/

// ===========================
// 3. BASE REPOSITORY
// ===========================

export class BaseRepository<T> {
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

    async getPaginated(page: number = 1, limit: number = 10): Promise<{
        data: T[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }> {
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
    constructor() {
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
    constructor() {
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

    async getPostsWithUser(): Promise<(Post & { user: Pick<User, 'id' | 'first_name' | 'last_name' | 'email'> })[]> {
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
// 6. USER SERVICE
// ===========================

export class UserService {
    private userRepository: UserRepository;

    constructor() {
        this.userRepository = new UserRepository();
    }

    async createUser(userData: CreateUserData): Promise<User> {
        // Check if email already exists
        const existingUser = await this.userRepository.findByEmail(userData.email);
        if (existingUser) {
            throw new Error('Email already exists');
        }

        // Hash password
        const passwordHash = await bcrypt.hash(userData.password, 12);

        // Create user
        const newUser = await this.userRepository.create({
            id: uuidv4(),
            email: userData.email,
            password_hash: passwordHash,
            first_name: userData.first_name,
            last_name: userData.last_name,
            status: 'active',
            created_at: new Date(),
            updated_at: new Date()
        });

        return newUser;
    }

    async getUserById(id: string): Promise<User> {
        const user = await this.userRepository.findById(id);
        if (!user) {
            throw new Error('User not found');
        }
        return user;
    }

    async getUserByEmail(email: string): Promise<User> {
        const user = await this.userRepository.findByEmail(email);
        if (!user) {
            throw new Error('User not found');
        }
        return user;
    }

    async updateUser(id: string, updateData: UpdateUserData): Promise<User> {
        const user = await this.userRepository.update(id, updateData);
        if (!user) {
            throw new Error('User not found');
        }
        return user;
    }

    async deleteUser(id: string): Promise<void> {
        const deleted = await this.userRepository.delete(id);
        if (!deleted) {
            throw new Error('User not found');
        }
    }

    async getAllUsers(): Promise<User[]> {
        return this.userRepository.findAll();
    }

    async getUsersPaginated(page: number = 1, limit: number = 10) {
        return this.userRepository.getPaginated(page, limit);
    }

    async verifyPassword(email: string, password: string): Promise<User> {
        const user = await this.userRepository.findByEmail(email);
        if (!user) {
            throw new Error('Invalid credentials');
        }

        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
            throw new Error('Invalid credentials');
        }

        return user;
    }

    async getUserStats() {
        return this.userRepository.getUserStats();
    }
}

// ===========================
// 7. POST SERVICE
// ===========================

export class PostService {
    private postRepository: PostRepository;
    private userRepository: UserRepository;

    constructor() {
        this.postRepository = new PostRepository();
        this.userRepository = new UserRepository();
    }

    async createPost(postData: CreatePostData): Promise<Post> {
        // Verify user exists
        const userExists = await this.userRepository.exists(postData.user_id);
        if (!userExists) {
            throw new Error('User not found');
        }

        const newPost = await this.postRepository.create({
            id: uuidv4(),
            user_id: postData.user_id,
            title: postData.title,
            content: postData.content,
            status: postData.status || 'draft',
            created_at: new Date(),
            updated_at: new Date(),
            published_at: postData.status === 'published' ? new Date() : undefined
        });

        return newPost;
    }

    async getPostById(id: string): Promise<Post> {
        const post = await this.postRepository.findById(id);
        if (!post) {
            throw new Error('Post not found');
        }
        return post;
    }

    async updatePost(id: string, updateData: Partial<CreatePostData>): Promise<Post> {
        const updatePayload: any = { ...updateData };

        // Set published_at if status is being changed to published
        if (updateData.status === 'published') {
            updatePayload.published_at = new Date();
        }

        const post = await this.postRepository.update(id, updatePayload);
        if (!post) {
            throw new Error('Post not found');
        }
        return post;
    }

    async deletePost(id: string): Promise<void> {
        const deleted = await this.postRepository.delete(id);
        if (!deleted) {
            throw new Error('Post not found');
        }
    }

    async getPostsByUser(userId: string): Promise<Post[]> {
        return this.postRepository.findByUserId(userId);
    }

    async getPublishedPosts(): Promise<Post[]> {
        return this.postRepository.findPublished();
    }

    async getPostsWithUser() {
        return this.postRepository.getPostsWithUser();
    }

    async searchPosts(query: string): Promise<Post[]> {
        return this.postRepository.searchByTitle(query);
    }
}

// ===========================
// 8. FASTIFY CONTROLLER EXAMPLE
// ===========================

export class UserController {
    private userService: UserService;

    constructor() {
        this.userService = new UserService();
    }

    async getUsers(request: any, reply: any) {
        try {
            const { page, limit } = request.query;

            if (page || limit) {
                const result = await this.userService.getUsersPaginated(
                    parseInt(page || '1'),
                    parseInt(limit || '10')
                );
                return reply.code(200).send({
                    success: true,
                    data: result
                });
            }

            const users = await this.userService.getAllUsers();
            return reply.code(200).send({
                success: true,
                data: users
            });
        } catch (error: any) {
            return reply.code(500).send({
                success: false,
                message: error.message
            });
        }
    }

    async getUserById(request: any, reply: any) {
        try {
            const user = await this.userService.getUserById(request.params.id);
            return reply.code(200).send({
                success: true,
                data: user
            });
        } catch (error: any) {
            return reply.code(404).send({
                success: false,
                message: error.message
            });
        }
    }

    async createUser(request: any, reply: any) {
        try {
            const user = await this.userService.createUser(request.body);
            return reply.code(201).send({
                success: true,
                data: user
            });
        } catch (error: any) {
            return reply.code(400).send({
                success: false,
                message: error.message
            });
        }
    }

    async updateUser(request: any, reply: any) {
        try {
            const user = await this.userService.updateUser(request.params.id, request.body);
            return reply.code(200).send({
                success: true,
                data: user
            });
        } catch (error: any) {
            return reply.code(404).send({
                success: false,
                message: error.message
            });
        }
    }

    async deleteUser(request: any, reply: any) {
        try {
            await this.userService.deleteUser(request.params.id);
            return reply.code(200).send({
                success: true,
                message: 'User deleted successfully'
            });
        } catch (error: any) {
            return reply.code(404).send({
                success: false,
                message: error.message
            });
        }
    }

    async getUserStats(request: any, reply: any) {
        try {
            const stats = await this.userService.getUserStats();
            return reply.code(200).send({
                success: true,
                data: stats
            });
        } catch (error: any) {
            return reply.code(500).send({
                success: false,
                message: error.message
            });
        }
    }
}

// ===========================
// 9. USAGE EXAMPLES
// ===========================

export async function exampleUsage() {
    const userService = new UserService();
    const postService = new PostService();

    try {
        // Create a new user
        const newUser = await userService.createUser({
            email: 'john@example.com',
            password: 'securepassword123',
            first_name: 'John',
            last_name: 'Doe'
        });
        console.log('Created user:', newUser.id);

        // Create a post for the user
        const newPost = await postService.createPost({
            user_id: newUser.id,
            title: 'My First Post',
            content: 'This is the content of my first post.',
            status: 'published'
        });
        console.log('Created post:', newPost.id);

        // Get user with pagination
        const paginatedUsers = await userService.getUsersPaginated(1, 5);
        console.log('Paginated users:', paginatedUsers);

        // Get published posts
        const publishedPosts = await postService.getPublishedPosts();
        console.log('Published posts count:', publishedPosts.length);

        // Verify user password
        const authenticatedUser = await userService.verifyPassword('john@example.com', 'securepassword123');
        console.log('Authenticated user:', authenticatedUser.id);

        // Get user stats
        const stats = await userService.getUserStats();
        console.log('User statistics:', stats);

    } catch (error) {
        console.error('Error:', error);
    }
}

// ===========================
// 10. MIGRATION HELPERS
// ===========================

export async function createTables() {
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

    console.log('Tables created successfully');
}

export async function dropTables() {
    await db.schema.dropTableIfExists('posts');
    await db.schema.dropTableIfExists('users');
    console.log('Tables dropped successfully');
}

// Export everything for easy usage
export { db, UserService, PostService, UserController, UserRepository, PostRepository };
