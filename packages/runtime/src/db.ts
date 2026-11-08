import sqlite3 from "sqlite3";
import { Pool, PoolConfig } from "pg";
import { Env } from "./index";

export class PostgresAdapter {
  private pool: Pool;

  constructor(config?: PoolConfig) {
    this.pool = new Pool(config || {
      connectionString: Env.get("DATABASE_URL")
    });
  }

  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    const { rows } = await this.pool.query(sql, params);
    return rows;
  }

  async transaction<T>(callback: (client: import("pg").PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await callback(client);
      await client.query("COMMIT");
      return result;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async migrate(migrations: { name: string, sql: string }[]): Promise<void> {
    await this.query(`
      CREATE TABLE IF NOT EXISTS _jg_migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    const applied = await this.query("SELECT name FROM _jg_migrations");
    const appliedSet = new Set(applied.map((r: any) => r.name));
    
    for (const migration of migrations) {
      if (!appliedSet.has(migration.name)) {
        await this.transaction(async (client) => {
          await client.query(migration.sql);
          await client.query("INSERT INTO _jg_migrations (name) VALUES ($1)", [migration.name]);
        });
        console.log(`[Migrations] Applied ${migration.name}`);
      }
    }
  }

  async close() {
    await this.pool.end();
  }
}

export class SQLiteAdapter {
  private db: sqlite3.Database;

  constructor(filename: string = ":memory:") {
    this.db = new sqlite3.Database(filename);
  }

  query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows as T[]);
      });
    });
  }

  execute(sql: string, params: any[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
  
  async transaction<T>(callback: () => Promise<T>): Promise<T> {
    await this.execute("BEGIN TRANSACTION");
    try {
      const result = await callback();
      await this.execute("COMMIT");
      return result;
    } catch (err) {
      await this.execute("ROLLBACK");
      throw err;
    }
  }
  
  async migrate(migrations: { name: string, sql: string }[]): Promise<void> {
    await this.execute(`
      CREATE TABLE IF NOT EXISTS _jg_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    const applied = await this.query("SELECT name FROM _jg_migrations");
    const appliedSet = new Set(applied.map((r: any) => r.name));
    
    for (const migration of migrations) {
      if (!appliedSet.has(migration.name)) {
        await this.transaction(async () => {
          await this.execute(migration.sql);
          await this.execute("INSERT INTO _jg_migrations (name) VALUES (?)", [migration.name]);
        });
        console.log(`[Migrations] Applied ${migration.name}`);
      }
    }
  }

  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}
