import { auth } from "@/lib/auth/server";
import { db, accounts } from "@outreachos/db";
import { eq } from "drizzle-orm";

export type Account = typeof accounts.$inferSelect;

/**
 * Get the authenticated user's session and account from the database.
 * Returns null if not authenticated or account not found.
 */
export async function getAuthAccount(): Promise<Account | null> {
  const session = await auth.getSession();
  const email = session?.data?.user?.email;
  if (!email) return null;

  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.email, email))
    .limit(1);

  return account ?? null;
}
