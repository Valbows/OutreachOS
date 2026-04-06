import { auth } from "@/lib/auth/server";
import { db, accounts } from "@outreachos/db";
import { eq } from "drizzle-orm";

export type Account = typeof accounts.$inferSelect;

/**
 * Get the authenticated user's session and account from the database.
 * Auto-provisions an accounts row on first access if a valid Neon Auth
 * session exists but no matching row is found (covers signup & login).
 * Returns null if not authenticated.
 */
export async function getAuthAccount(): Promise<Account | null> {
  const session = await auth.getSession();
  const email = session?.data?.user?.email;
  if (!email) return null;

  const [existing] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.email, email))
    .limit(1);

  if (existing) return existing;

  // Auto-provision: Neon Auth session is valid but no accounts row yet.
  const name = session.data?.user?.name ?? email.split("@")[0];
  try {
    const [created] = await db
      .insert(accounts)
      .values({ name, email })
      .onConflictDoNothing({ target: accounts.email })
      .returning();

    // In case of a race condition where another request already inserted
    if (!created) {
      const [raced] = await db
        .select()
        .from(accounts)
        .where(eq(accounts.email, email))
        .limit(1);
      return raced ?? null;
    }

    return created;
  } catch (err) {
    console.error("Failed to auto-provision account:", err);
    return null;
  }
}
