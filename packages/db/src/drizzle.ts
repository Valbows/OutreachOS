import { Pool as NeonPool, neonConfig } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { Pool as PgPool } from "pg";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import * as schema from "./schema/index.js";
import ws from "ws";

// Enable WebSocket support in Node.js (required for transactions with Neon driver)
neonConfig.webSocketConstructor = ws;

type NeonDB = ReturnType<typeof drizzleNeon<typeof schema>>;
type PgDB = ReturnType<typeof drizzlePg<typeof schema>>;
type DB = NeonDB | PgDB;

let _db: DB | null = null;

/**
 * Detects if DATABASE_URL points to a local/CI Postgres (TCP) vs Neon (WebSocket).
 * Localhost, 127.0.0.1, and private IP ranges use standard pg Pool.
 * Neon and other cloud hosts use WebSocket Pool.
 */
function isLocalPostgres(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;
    // localhost variants
    if (hostname === "localhost" || hostname === "127.0.0.1") return true;
    // Private IPv4 ranges commonly used in CI (10.x, 172.16-31.x, 192.168.x)
    if (hostname.startsWith("10.")) return true;
    if (hostname.startsWith("192.168.")) return true;
    if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)) return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * Lazy singleton — deferred so Next.js build doesn't crash when DATABASE_URL
 * is absent at static-analysis time. The connection is created on first access.
 * Uses WebSocket Pool for Neon, standard TCP Pool for local/CI Postgres.
 */
export function getDb(): DB {
  if (!_db) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("DATABASE_URL environment variable is required but not set.");
    }

    if (isLocalPostgres(databaseUrl)) {
      // CI/local: standard TCP pg Pool (no WebSocket needed)
      const pool = new PgPool({ connectionString: databaseUrl });
      _db = drizzlePg({ client: pool, schema });
    } else {
      // Production Neon: WebSocket Pool
      const pool = new NeonPool({ connectionString: databaseUrl });
      _db = drizzleNeon({ client: pool, schema });
    }
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
