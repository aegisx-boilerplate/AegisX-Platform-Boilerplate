import { Knex } from 'knex';

export interface DatabaseConnection {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  getHealth(): Promise<DatabaseHealth>;
  getKnex(): Knex;
}

export interface DatabaseHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  latency?: number;
  connections?: {
    active: number;
    idle: number;
    max: number;
  };
  error?: string;
}

export interface QueryResult<T = any> {
  data: T[];
  count: number;
  affectedRows?: number;
  insertId?: string | number;
}

export interface DatabaseQuery {
  knex: Knex;
  execute<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>>;
  findOne<T = any>(sql: string, params?: any[]): Promise<T | null>;
  findMany<T = any>(sql: string, params?: any[]): Promise<T[]>;
  transaction<T>(callback: (trx: Knex.Transaction) => Promise<T>): Promise<T>;
}

export interface DatabaseMigration {
  id: string;
  name: string;
  up: (knex: Knex) => Promise<void>;
  down: (knex: Knex) => Promise<void>;
}

export interface DatabaseMigrator {
  migrate(): Promise<void>;
  rollback(steps?: number): Promise<void>;
  getMigrationStatus(): Promise<DatabaseMigrationStatus[]>;
  createMigration(name: string): Promise<string>;
}

export interface DatabaseMigrationStatus {
  id: string;
  name: string;
  executed: boolean;
  executedAt?: Date;
}

export abstract class BaseDatabaseConnection implements DatabaseConnection {
  protected _isConnected = false;
  protected knexInstance?: Knex;

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract getHealth(): Promise<DatabaseHealth>;

  isConnected(): boolean {
    return this._isConnected;
  }

  getKnex(): Knex {
    if (!this.knexInstance) {
      throw new Error('Database not connected');
    }
    return this.knexInstance;
  }
}

export class KnexDatabaseQuery implements DatabaseQuery {
  constructor(public knex: Knex) { }

  async execute<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>> {
    const result = await this.knex.raw(sql, params || []);

    // Handle different database response formats
    let data: T[] = [];
    let affectedRows = 0;
    let insertId: string | number | undefined;

    if (Array.isArray(result)) {
      // MySQL format: [rows, fields]
      data = result[0] || [];
      if (result[0] && typeof result[0] === 'object' && 'affectedRows' in result[0]) {
        affectedRows = result[0].affectedRows;
        insertId = result[0].insertId;
      }
    } else if (result && typeof result === 'object') {
      // PostgreSQL format: { rows, command, rowCount, ... }
      if (result.rows) {
        data = result.rows;
      }
      if (result.rowCount !== undefined) {
        affectedRows = result.rowCount;
      }
    }

    return {
      data,
      count: data.length,
      affectedRows,
      insertId
    };
  }

  async findOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
    const result = await this.execute<T>(sql, params);
    return result.data.length > 0 ? result.data[0] : null;
  }

  async findMany<T = any>(sql: string, params?: any[]): Promise<T[]> {
    const result = await this.execute<T>(sql, params);
    return result.data;
  }

  async transaction<T>(callback: (trx: Knex.Transaction) => Promise<T>): Promise<T> {
    return await this.knex.transaction(callback);
  }
}

export class DatabaseManager {
  private connections: Map<string, DatabaseConnection> = new Map();
  private defaultConnection?: string;

  register(name: string, connection: DatabaseConnection, isDefault = false): void {
    this.connections.set(name, connection);
    if (isDefault || !this.defaultConnection) {
      this.defaultConnection = name;
    }
  }

  getConnection(name?: string): DatabaseConnection {
    const connectionName = name ?? this.defaultConnection;
    if (!connectionName) {
      throw new Error('No database connection registered');
    }

    const connection = this.connections.get(connectionName);
    if (!connection) {
      throw new Error(`Database connection '${connectionName}' not found`);
    }

    return connection;
  }

  getKnex(name?: string): Knex {
    return this.getConnection(name).getKnex();
  }

  getQuery(name?: string): DatabaseQuery {
    const connection = this.getConnection(name);
    return new KnexDatabaseQuery(connection.getKnex());
  }

  async connectAll(): Promise<void> {
    await Promise.all(
      Array.from(this.connections.values()).map(conn => conn.connect())
    );
  }

  async disconnectAll(): Promise<void> {
    await Promise.all(
      Array.from(this.connections.values()).map(conn => conn.disconnect())
    );
  }

  async getHealthStatus(): Promise<Record<string, DatabaseHealth>> {
    const health: Record<string, DatabaseHealth> = {};

    for (const [name, connection] of this.connections) {
      try {
        health[name] = await connection.getHealth();
      } catch (error) {
        health[name] = {
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    return health;
  }

  listConnections(): string[] {
    return Array.from(this.connections.keys());
  }
}

// Singleton instance
export const databaseManager = new DatabaseManager();
