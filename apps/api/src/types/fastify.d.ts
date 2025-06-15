import { Knex } from 'knex';

declare module 'fastify' {
    interface FastifyInstance {
        db?: Knex;
    }
} 