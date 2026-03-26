import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema/index.js";

type DB = ReturnType<typeof drizzle<typeof schema>>;

let _db: DB | null = null;

/**
 * Lazy singleton — deferred so Next.js build doesn't crash when DATABASE_URL
 * is absent at static-analysis time. The connection is created on first access.
 */
export function getDb(): DB {
  if (!_db) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("DATABASE_URL environment variable is required but not set.");
    }
    const sql = neon(databaseUrl);
    _db = drizzle({ client: sql, schema });
  }
  return _db;
}

// Proxy preserves the original `db` export so all existing call-sites keep working
// without code changes, while deferring actual DB init to first property access.
export const db: DB = new Proxy({} as DB, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});
