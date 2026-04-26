import { auth } from "@/lib/auth/server";
import { db, accounts } from "@outreachos/db";
import { eq } from "drizzle-orm";

export type Account = Pick<typeof accounts.$inferSelect, "id" | "name" | "email" | "neonAuthId">;

const authAccountSelection = {
  id: accounts.id,
  neonAuthId: accounts.neonAuthId,
  name: accounts.name,
  email: accounts.email,
} as const;

/**
 * Get the authenticated user's session and account from the database.
 * Auto-provisions an accounts row on first access if a valid Neon Auth
 * session exists but no matching row is found (covers signup & login).
 * Returns null if not authenticated.
 *
 * Lookup order:
 * 1. By email — the user's stable identity.
 * 2. By neonAuthId — handles cases where the provider email changed.
 * In both cases the neonAuthId is kept in sync with the current session.
 */
export async function getAuthAccount(): Promise<Account | null> {
  const session = await auth.getSession();
  const email = session?.data?.user?.email;
  const neonAuthId = session?.data?.user?.id; // Neon Auth's stable user ID

  if (!email) return null;

  const [byEmail] = await db
    .select(authAccountSelection)
    .from(accounts)
    .where(eq(accounts.email, email))
    .limit(1);

  if (byEmail) {
    // Keep neonAuthId in sync whenever the session carries a different value.
    // Email is the authoritative identity; we always follow the session's provider ID.
    if (neonAuthId && byEmail.neonAuthId !== neonAuthId) {
      // Guard: ensure no other account already owns this neonAuthId
      const [conflictingAuth] = await db
        .select({ id: accounts.id })
        .from(accounts)
        .where(eq(accounts.neonAuthId, neonAuthId))
        .limit(1);

      if (conflictingAuth && conflictingAuth.id !== byEmail.id) {
        console.warn(
          `[getAuthAccount] neonAuthId ${neonAuthId} already belongs to a different account ` +
          `(${conflictingAuth.id}); skipping neonAuthId sync for account ${byEmail.id}`
        );
        return null;
      }

      await db
        .update(accounts)
        .set({ neonAuthId, updatedAt: new Date() })
        .where(eq(accounts.id, byEmail.id));
      return { ...byEmail, neonAuthId };
    }
    return byEmail;
  }

  // Second: Try to find by neonAuthId (for cases where email changed but neonAuthId is stable)
  if (neonAuthId) {
    const [byAuthId] = await db
      .select(authAccountSelection)
      .from(accounts)
      .where(eq(accounts.neonAuthId, neonAuthId))
      .limit(1);

    if (byAuthId) {
      // Update email if it changed (e.g., after OAuth linking)
      if (byAuthId.email !== email) {
        // Guard: ensure the target email isn't already owned by a different account
        const [conflicting] = await db
          .select({ id: accounts.id })
          .from(accounts)
          .where(eq(accounts.email, email))
          .limit(1);

        if (conflicting && conflicting.id !== byAuthId.id) {
          console.warn(
            `[getAuthAccount] Target email already belongs to a different account; ` +
            `skipping email update for account ${byAuthId.id}. ` +
            `Conflicting account: ${conflicting.id}, target email: ${email}`
          );
          return null;
        } else {
          await db
            .update(accounts)
            .set({ email, updatedAt: new Date() })
            .where(eq(accounts.id, byAuthId.id));
          return { ...byAuthId, email };
        }
      }
      return byAuthId;
    }
  }

  // Auto-provision: Neon Auth session is valid but no accounts row yet.
  const name = session.data?.user?.name ?? email.split("@")[0];
  try {
    const [created] = await db
      .insert(accounts)
      .values({ name, email, neonAuthId: neonAuthId ?? null })
      .onConflictDoNothing({ target: accounts.email })
      .returning(authAccountSelection);

    // In case of a race condition where another request already inserted
    if (!created) {
      const [raced] = await db
        .select(authAccountSelection)
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
