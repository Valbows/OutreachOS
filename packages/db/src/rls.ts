/**
 * Row Level Security (RLS) Utilities
 * 
 * Provides functions to set account context for RLS policies and run queries
 * with proper tenant isolation.
 */

import { getDb, db } from "./drizzle.js";
import { sql } from "drizzle-orm";
import { rlsFullSetupSql, setAccountIdSql } from "./schema/rls-policies.js";

/**
 * Execute SQL to set the current account ID for RLS context.
 * Must be called before any tenant-scoped queries.
 */
export async function setAccountContext(accountId: string): Promise<void> {
  const database = getDb();
  await database.execute(setAccountIdSql(accountId));
}

// Type for transaction handle within withAccountContext
type TransactionHandle = {
  execute: typeof db.execute;
  select: typeof db.select;
  insert: typeof db.insert;
  update: typeof db.update;
  delete: typeof db.delete;
  query: typeof db.query;
};

/**
 * Run a callback with the account context set for RLS.
 * Uses a transaction to ensure all operations use the same connection
 * with proper RLS context. Automatically resets context after execution.
 */
export async function withAccountContext<T>(
  accountId: string,
  callback: (tx: TransactionHandle) => Promise<T>
): Promise<T> {
  const database = getDb();

  return await database.transaction(async (tx) => {
    // Set account context on this transaction's connection
    await tx.execute(setAccountIdSql(accountId));

    try {
      // Execute callback with transaction handle
      return await callback(tx as TransactionHandle);
    } finally {
      // Reset context on the same connection before transaction ends
      await tx.execute("SET LOCAL app.current_account_id = '';");
    }
  });
}

/**
 * Execute the full RLS setup SQL.
 * Run this once during initial deployment or migration.
 */
export async function setupRLS(): Promise<void> {
  const database = getDb();
  await database.execute(rlsFullSetupSql);
}

/**
 * Check if RLS is enabled on a table
 */
export async function isRLSEnabled(tableName: string): Promise<boolean> {
  const result = await db.execute(
    sql`SELECT relrowsecurity FROM pg_class WHERE relname = ${tableName}`
  );
  return result.rows[0]?.relrowsecurity === true;
}

export { rlsFullSetupSql, setAccountIdSql };
