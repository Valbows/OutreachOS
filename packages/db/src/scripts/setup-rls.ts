#!/usr/bin/env node
/**
 * RLS Setup Script
 *
 * Run once during initial deployment or when adding new tables with RLS.
 * This script executes the full RLS policy setup SQL.
 *
 * Usage:
 *   npx tsx packages/db/src/scripts/setup-rls.ts
 *   # or
 *   pnpm db:setup-rls  (if added to package.json)
 */

import { setupRLS } from "../rls.js";

async function main() {
  console.log("🔐 Setting up Row Level Security (RLS) policies...");

  try {
    await setupRLS();
    console.log("✅ RLS setup complete. All tables now have tenant isolation.");
    process.exit(0);
  } catch (error) {
    console.error("❌ RLS setup failed:", error);
    process.exit(1);
  }
}

main();
