import { Knex } from 'knex';
import { getDatabase } from '@aegisx/core-database';

export interface CreateUserDto {
    name: string;
    email: string;
    password: string;
}

export interface UpdateUserDto {
    name?: string;
    email?: string;
}

export interface User {
    id: string;
    name: string;
    email: string;
    created_at: Date;
    updated_at: Date;
}

export class UserService {
    private get db(): Knex {
        return getDatabase();
    }

    async findAll(): Promise<User[]> {
        return await this.db('users').select('*');
    }

    async findById(id: string): Promise<User | null> {
        const [user] = await this.db('users').where({ id }).limit(1);
        return user || null;
    }

    async findByEmail(email: string): Promise<User | null> {
        const [user] = await this.db('users').where({ email }).limit(1);
        return user || null;
    }

    async create(userData: CreateUserDto): Promise<User> {
        const [user] = await this.db('users')
            .insert({
                ...userData,
                created_at: new Date(),
                updated_at: new Date(),
            })
            .returning('*');
        return user;
    }

    async update(id: string, userData: UpdateUserDto): Promise<User | null> {
        const [user] = await this.db('users')
            .where({ id })
            .update({
                ...userData,
                updated_at: new Date(),
            })
            .returning('*');
        return user || null;
    }

    async delete(id: string): Promise<boolean> {
        const deleted = await this.db('users').where({ id }).del();
        return deleted > 0;
    }

    async count(): Promise<number> {
        const [{ count }] = await this.db('users').count('id as count');
        return parseInt(count as string, 10);
    }
} 