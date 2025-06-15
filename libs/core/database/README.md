# @aegisx/core-database

Database abstraction layer สำหรับ AegisX Platform ที่ใช้ Knex.js เป็น query builder

## ✨ Features

- 🔌 รองรับ PostgreSQL และ MySQL
- 📊 Connection pooling และ health monitoring
- 🔄 Migration system
- 🛡️ Transaction support
- 📝 Type-safe query builder
- 🏗️ Database factory pattern

## 📦 Installation

```bash
npm install @aegisx/core-database
```

### Peer Dependencies

```bash
# สำหรับ PostgreSQL
npm install pg @types/pg

# สำหรับ MySQL
npm install mysql2
```

## 🚀 Quick Start

### Simple Setup (Recommended)

```typescript
import { setupDatabaseFromUrl, getDatabase } from '@aegisx/core-database';

// Setup database
const db = setupDatabaseFromUrl('postgresql://postgres:password@localhost:5432/myapp');

// Or from config object
import { setupDatabase } from '@aegisx/core-database';
const db = setupDatabase({
  type: 'postgresql',
  host: 'localhost',
  user: 'postgres',
  password: 'password',
  database: 'myapp'
});

// Use Knex directly!
const users = await db('users').select('*');
const user = await db('users').where('id', 1).first();

// Get database anywhere in your app
const knex = getDatabase();
await knex('users').insert({ name: 'John', email: 'john@example.com' });
```

### MySQL Connection

```typescript
import { MySQLKnexConnection, databaseManager } from '@aegisx/core-database';

const mysqlConnection = new MySQLKnexConnection({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: 'password',
  database: 'myapp',
  charset: 'utf8mb4',
  pool: {
    min: 2,
    max: 10
  }
});

databaseManager.register('mysql', mysqlConnection);
```

### Using Database Factory

```typescript
import { DatabaseFactory } from '@aegisx/core-database';

// From connection string
const connection = await DatabaseFactory.createFromConnectionString(
  'postgresql://user:password@localhost:5432/myapp'
);

// From config object
const connection = DatabaseFactory.create({
  type: 'postgresql',
  connection: {
    host: 'localhost',
    user: 'postgres',
    password: 'password',
    database: 'myapp'
  }
});
```

## 📝 Usage Examples

### Basic Queries

```typescript
import { databaseManager } from '@aegisx/core-database';

// Get Knex instance
const knex = databaseManager.getKnex();

// Query with Knex
const users = await knex('users').select('*');
const user = await knex('users').where('id', 1).first();

// Raw queries
const query = databaseManager.getQuery();
const result = await query.execute('SELECT * FROM users WHERE active = ?', [true]);
```

### Transactions

```typescript
const knex = databaseManager.getKnex();

await knex.transaction(async (trx) => {
  await trx('users').insert({ name: 'John', email: 'john@example.com' });
  await trx('profiles').insert({ user_id: 1, bio: 'Hello world' });
});
```

### Health Monitoring

```typescript
// Check single connection
const connection = databaseManager.getConnection();
const health = await connection.getHealth();

// Check all connections
const healthStatus = await databaseManager.getHealthStatus();
console.log(healthStatus);
/*
{
  postgres: {
    status: 'healthy',
    latency: 5,
    connections: { active: 2, idle: 8, max: 10 }
  }
}
*/
```

## 🔄 Migration System

### Setup Migrator

```typescript
import { KnexMigrator } from '@aegisx/core-database';

const migrator = new KnexMigrator({
  knex: databaseManager.getKnex(),
  migrationsDir: './migrations',
  migrationsTable: 'migrations'
});

await migrator.initialize();
```

### Create Migration

```typescript
// Create new migration file
const filePath = await migrator.createMigration('create_users_table');
// Creates: ./migrations/20231201120000_create_users_table.ts
```

### Migration File Example

```typescript
import { Knex } from 'knex';

export default {
  id: '20231201120000_create_users_table',
  name: 'Create users table',
  
  async up(knex: Knex): Promise<void> {
    await knex.schema.createTable('users', (table) => {
      table.increments('id').primary();
      table.string('email').unique().notNullable();
      table.string('name').notNullable();
      table.boolean('active').defaultTo(true);
      table.timestamps(true, true);
    });
  },
  
  async down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists('users');
  }
};
```

### Run Migrations

```typescript
// Run pending migrations
await migrator.migrate();

// Rollback migrations
await migrator.rollback(1); // Rollback 1 step

// Check migration status
const status = await migrator.getMigrationStatus();
```

## 🛠️ Configuration

### Connection Options

#### PostgreSQL

```typescript
interface PostgreSQLKnexConfig {
  host: string;
  port?: number;
  user: string;
  password: string;
  database: string;
  ssl?: boolean | object;
  pool?: {
    min?: number;
    max?: number;
  };
  connectionTimeout?: number;
  acquireConnectionTimeout?: number;
  debug?: boolean;
}
```

#### MySQL

```typescript
interface MySQLKnexConfig {
  host: string;
  port?: number;
  user: string;
  password: string;
  database: string;
  ssl?: boolean | object;
  pool?: {
    min?: number;
    max?: number;
  };
  connectionTimeout?: number;
  acquireConnectionTimeout?: number;
  debug?: boolean;
  charset?: string;
  timezone?: string;
}
```

## 🔧 Advanced Usage

### Multiple Connections

```typescript
// Register multiple connections
databaseManager.register('main', mainConnection, true); // default
databaseManager.register('readonly', readonlyConnection);
databaseManager.register('analytics', analyticsConnection);

// Use specific connection
const mainKnex = databaseManager.getKnex('main');
const readonlyKnex = databaseManager.getKnex('readonly');
```

### Connection String Utilities

```typescript
import { ConnectionStringUtils } from '@aegisx/core-database';

const parts = ConnectionStringUtils.parse('postgresql://user:pass@localhost:5432/db');
const masked = ConnectionStringUtils.maskPassword('postgresql://user:pass@localhost:5432/db');
// postgresql://user:***@localhost:5432/db
```

## 🏗️ Integration with AegisX Config

```typescript
import { config } from '@aegisx/core-config';
import { DatabaseFactory, databaseManager } from '@aegisx/core-database';

// From config
const connection = await DatabaseFactory.createFromConnectionString(
  config.getDatabaseUrl()
);

databaseManager.register('main', connection, true);
await databaseManager.connectAll();
```

## 📊 Performance Tips

1. **Connection Pooling**: ใช้ pool size ที่เหมาะสม
2. **Prepared Statements**: Knex ใช้ prepared statements อัตโนมัติ
3. **Transactions**: ใช้ transactions สำหรับ multiple operations
4. **Health Checks**: Monitor connection health ด้วย `getHealth()`

## 🔒 Security

- ✅ SQL injection protection ด้วย parameterized queries
- ✅ Connection string masking สำหรับ logs
- ✅ SSL support สำหรับ production
- ✅ Connection timeout configuration
