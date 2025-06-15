import * as fs from 'fs/promises';
import * as path from 'path';
import { Knex } from 'knex';
import {
    DatabaseMigrator,
    DatabaseMigration,
    DatabaseMigrationStatus
} from '../core-database.js';

export interface KnexMigratorConfig {
    migrationsDir: string;
    migrationsTable?: string;
    knex: Knex;
}

export class KnexMigrator implements DatabaseMigrator {
    private config: Required<KnexMigratorConfig>;
    private migrations: Map<string, DatabaseMigration> = new Map();

    constructor(config: KnexMigratorConfig) {
        this.config = {
            migrationsTable: 'migrations',
            ...config
        };
    }

    async initialize(): Promise<void> {
        // Create migrations table if it doesn't exist
        await this.createMigrationsTable();

        // Load all migration files
        await this.loadMigrations();
    }

    private async createMigrationsTable(): Promise<void> {
        const hasTable = await this.config.knex.schema.hasTable(this.config.migrationsTable);

        if (!hasTable) {
            await this.config.knex.schema.createTable(this.config.migrationsTable, (table) => {
                table.string('id').primary();
                table.string('name').notNullable();
                table.timestamp('executed_at').defaultTo(this.config.knex.fn.now());
            });
        }
    }

    private async loadMigrations(): Promise<void> {
        try {
            const files = await fs.readdir(this.config.migrationsDir);
            const migrationFiles = files
                .filter(file => file.endsWith('.js') || file.endsWith('.ts'))
                .sort();

            for (const file of migrationFiles) {
                const filePath = path.join(this.config.migrationsDir, file);
                const migration = await this.loadMigrationFile(filePath);
                if (migration) {
                    this.migrations.set(migration.id, migration);
                }
            }
        } catch (error) {
            if ((error as any).code !== 'ENOENT') {
                throw error;
            }
            // Directory doesn't exist, create it
            await fs.mkdir(this.config.migrationsDir, { recursive: true });
        }
    }

    private async loadMigrationFile(filePath: string): Promise<DatabaseMigration | null> {
        try {
            const migrationModule = await import(filePath);
            const migration = migrationModule.default || migrationModule;

            if (!migration.id || !migration.name || !migration.up || !migration.down) {
                console.warn(`Invalid migration file: ${filePath}`);
                return null;
            }

            return migration;
        } catch (error) {
            console.error(`Error loading migration file ${filePath}:`, error);
            return null;
        }
    }

    async migrate(): Promise<void> {
        const executedMigrations = await this.getExecutedMigrations();
        const pendingMigrations = Array.from(this.migrations.values())
            .filter(migration => !executedMigrations.has(migration.id))
            .sort((a, b) => a.id.localeCompare(b.id));

        if (pendingMigrations.length === 0) {
            console.log('No pending migrations');
            return;
        }

        console.log(`Running ${pendingMigrations.length} migration(s)`);

        for (const migration of pendingMigrations) {
            console.log(`Running migration: ${migration.name}`);

            await this.config.knex.transaction(async (trx) => {
                await migration.up(trx);
                await trx(this.config.migrationsTable).insert({
                    id: migration.id,
                    name: migration.name
                });
            });

            console.log(`Completed migration: ${migration.name}`);
        }
    }

    async rollback(steps = 1): Promise<void> {
        const executedMigrations = await this.getExecutedMigrations();
        const migrationsToRollback = Array.from(executedMigrations.keys())
            .sort((a, b) => b.localeCompare(a)) // Reverse order
            .slice(0, steps);

        if (migrationsToRollback.length === 0) {
            console.log('No migrations to rollback');
            return;
        }

        console.log(`Rolling back ${migrationsToRollback.length} migration(s)`);

        for (const migrationId of migrationsToRollback) {
            const migration = this.migrations.get(migrationId);
            if (!migration) {
                console.warn(`Migration ${migrationId} not found in files`);
                continue;
            }

            console.log(`Rolling back migration: ${migration.name}`);

            await this.config.knex.transaction(async (trx) => {
                await migration.down(trx);
                await trx(this.config.migrationsTable)
                    .where('id', migration.id)
                    .delete();
            });

            console.log(`Rolled back migration: ${migration.name}`);
        }
    }

    async getMigrationStatus(): Promise<DatabaseMigrationStatus[]> {
        const executedMigrations = await this.getExecutedMigrations();

        return Array.from(this.migrations.values()).map(migration => ({
            id: migration.id,
            name: migration.name,
            executed: executedMigrations.has(migration.id),
            executedAt: executedMigrations.get(migration.id)
        }));
    }

    async createMigration(name: string): Promise<string> {
        const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
        const id = `${timestamp}_${name.replace(/\s+/g, '_').toLowerCase()}`;
        const filename = `${id}.ts`;
        const filepath = path.join(this.config.migrationsDir, filename);

        const template = `import { Knex } from 'knex';

export default {
  id: '${id}',
  name: '${name}',
  
  async up(knex: Knex): Promise<void> {
    // TODO: Implement migration up
    // Example:
    // await knex.schema.createTable('users', (table) => {
    //   table.increments('id').primary();
    //   table.string('email').unique().notNullable();
    //   table.timestamps(true, true);
    // });
  },
  
  async down(knex: Knex): Promise<void> {
    // TODO: Implement migration down
    // Example:
    // await knex.schema.dropTableIfExists('users');
  }
};
`;

        await fs.writeFile(filepath, template, 'utf-8');
        console.log(`Migration created: ${filepath}`);

        return filepath;
    }

    private async getExecutedMigrations(): Promise<Map<string, Date>> {
        const rows = await this.config.knex(this.config.migrationsTable)
            .select('id', 'executed_at')
            .orderBy('executed_at');

        const executedMigrations = new Map<string, Date>();
        for (const row of rows) {
            executedMigrations.set(row.id, new Date(row.executed_at));
        }

        return executedMigrations;
    }
} 