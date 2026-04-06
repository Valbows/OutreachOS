import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema/index.js";
import ws from "ws";

// Enable WebSocket support in Node.js (required for transactions)
neonConfig.webSocketConstructor = ws;

type DB = ReturnType<typeof drizzle<typeof schema>>;

let _db: DB | null = null;

/**
 * Lazy singleton — deferred so Next.js build doesn't crash when DATABASE_URL
 * is absent at static-analysis time. The connection is created on first access.
 * Uses Pool (WebSocket) instead of neon() (HTTP) to support db.transaction().
 */
export function getDb(): DB {
  if (!_db) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("DATABASE_URL environment variable is required but not set.");
    }
    const pool = new Pool({ connectionString: databaseUrl });
    _db = drizzle({ client: pool, schema });
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
