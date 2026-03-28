/**
 * Billing Service - Usage quota enforcement and metering
 */

import { db, billingPlans, accountBilling } from "@outreachos/db";
import { eq, sql } from "drizzle-orm";

export interface UsageLimits {
  contacts: number;
  emailsPerMonth: number;
  llmTokensPerMonth: number;
  hunterCreditsPerMonth: number;
  apiCallsPerMonth: number;
  webhooks: number;
}

export interface CurrentUsage {
  emails: number;
  llmTokens: number;
  hunterCredits: number;
  apiCalls: number;
}

export type UsageType = "emails" | "llmTokens" | "hunterCredits" | "apiCalls";

const DEFAULT_FREE_LIMITS: UsageLimits = {
  contacts: 1000,
  emailsPerMonth: 500,
  llmTokensPerMonth: 100000,
  hunterCreditsPerMonth: 50,
  apiCallsPerMonth: 10000,
  webhooks: 2,
};

/**
 * Add one calendar month to a date (preserving day/time where possible)
 * Handles month-end overflow by clamping to the last day of the target month
 */
function addOneMonth(date: Date): Date {
  const originalDay = date.getDate();
  const targetYear = date.getFullYear();
  const targetMonth = date.getMonth() + 1; // 0-indexed, so +1 is next month

  // Create date for first day of target month
  const firstOfTargetMonth = new Date(targetYear, targetMonth, 1);

  // Create date for first day of month after target, then subtract 1 day to get last day of target
  const firstOfNextMonth = new Date(targetYear, targetMonth + 1, 1);
  const lastDayOfTargetMonth = new Date(firstOfNextMonth.getTime() - 86400000).getDate();

  // Clamp day to last day of target month if original day is larger
  const clampedDay = Math.min(originalDay, lastDayOfTargetMonth);

  // Return new date with clamped day, preserving time
  return new Date(targetYear, targetMonth, clampedDay, date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds());
}

/**
 * Compute percentage safely, returning 0 when limit is 0 or falsy
 */
function computePercentage(usageValue: number, limitValue: number): number {
  if (!limitValue || limitValue <= 0) return 0;
  return Math.round((usageValue / limitValue) * 100);
}

export class BillingService {
  /**
   * Get or create billing record for an account
   */
  static async getOrCreateBilling(accountId: string) {
    const [existing] = await db
      .select()
      .from(accountBilling)
      .where(eq(accountBilling.accountId, accountId))
      .limit(1);

    if (existing) return existing;

    const now = new Date();
    const [created] = await db
      .insert(accountBilling)
      .values({
        accountId,
        currentPeriodStart: now,
        currentPeriodEnd: addOneMonth(now),
      })
      .onConflictDoUpdate({
        target: accountBilling.accountId,
        set: {}, // No updates on conflict, just return existing
      })
      .returning();

    return created;
  }

  /**
   * Get usage limits for an account
   */
  static async getLimits(accountId: string): Promise<UsageLimits> {
    const billing = await BillingService.getOrCreateBilling(accountId);

    if (!billing.planId) {
      return DEFAULT_FREE_LIMITS;
    }

    const [plan] = await db
      .select()
      .from(billingPlans)
      .where(eq(billingPlans.id, billing.planId))
      .limit(1);

    return (plan?.limits as UsageLimits) ?? DEFAULT_FREE_LIMITS;
  }

  /**
   * Get current usage for an account
   */
  static async getUsage(accountId: string): Promise<CurrentUsage> {
    const billing = await BillingService.getOrCreateBilling(accountId);

    // Check if billing period has expired and reset if needed
    if (billing.currentPeriodEnd && new Date(billing.currentPeriodEnd) < new Date()) {
      await BillingService.resetMonthlyUsage(accountId);
      // Return zeroed usage after reset
      return {
        emails: 0,
        llmTokens: 0,
        hunterCredits: 0,
        apiCalls: 0,
      };
    }

    return (billing.usageThisMonth as CurrentUsage) ?? {
      emails: 0,
      llmTokens: 0,
      hunterCredits: 0,
      apiCalls: 0,
    };
  }

  /**
   * Check if account can use a resource (within quota)
   * NOTE: This is for read-only checks. For enforcement, use reserveOrIncrement.
   */
  static async canUse(accountId: string, type: UsageType, amount = 1): Promise<boolean> {
    const limits = await BillingService.getLimits(accountId);
    const usage = await BillingService.getUsage(accountId);

    const limitMap: Record<UsageType, keyof UsageLimits> = {
      emails: "emailsPerMonth",
      llmTokens: "llmTokensPerMonth",
      hunterCredits: "hunterCreditsPerMonth",
      apiCalls: "apiCallsPerMonth",
    };

    const limit = limits[limitMap[type]];
    const current = usage[type];

    return current + amount <= limit;
  }

  /**
   * Atomic check-and-increment for quota enforcement.
   * Returns true if usage was incremented (within quota), false if quota exceeded.
   * This prevents race conditions between canUse() and incrementUsage().
   */
  static async reserveOrIncrement(
    accountId: string,
    type: UsageType,
    amount = 1
  ): Promise<boolean> {
    const limitMap: Record<UsageType, string> = {
      emails: "emailsPerMonth",
      llmTokens: "llmTokensPerMonth",
      hunterCredits: "hunterCreditsPerMonth",
      apiCalls: "apiCallsPerMonth",
    };

    // Validate type against whitelist to prevent SQL injection
    if (!Object.keys(limitMap).includes(type)) {
      throw new Error(`Invalid usage type: ${type}`);
    }

    const limitKey = limitMap[type];

    // Atomic conditional increment using CTE to join with billing_plans
    const result = await db.execute(sql`
      WITH billing_info AS (
        SELECT 
          ab.id as billing_id,
          COALESCE(
            (bp.limits->>${limitKey})::int,
            CASE ${limitKey}
              WHEN 'emailsPerMonth' THEN ${DEFAULT_FREE_LIMITS.emailsPerMonth}
              WHEN 'llmTokensPerMonth' THEN ${DEFAULT_FREE_LIMITS.llmTokensPerMonth}
              WHEN 'hunterCreditsPerMonth' THEN ${DEFAULT_FREE_LIMITS.hunterCreditsPerMonth}
              WHEN 'apiCallsPerMonth' THEN ${DEFAULT_FREE_LIMITS.apiCallsPerMonth}
            END
          ) as limit_val,
          COALESCE((ab.usage_this_month->>${type})::int, 0) as current_usage
        FROM account_billing ab
        LEFT JOIN billing_plans bp ON bp.id = ab.plan_id
        WHERE ab.account_id = ${accountId}
      ),
      updated AS (
        UPDATE account_billing ab
        SET 
          usage_this_month = jsonb_set(
            COALESCE(ab.usage_this_month, '{"emails":0,"llmTokens":0,"hunterCredits":0,"apiCalls":0}'::jsonb),
            '{${sql.raw(type)}}',
            (billing_info.current_usage + ${amount})::text::jsonb
          ),
          updated_at = NOW()
        FROM billing_info
        WHERE ab.id = billing_info.billing_id
          AND billing_info.current_usage + ${amount} <= billing_info.limit_val
        RETURNING ab.id
      )
      SELECT COUNT(*) as updated_count FROM updated
    `);

    const updatedCount = Number((result.rows[0] as { updated_count: string }).updated_count);
    return updatedCount > 0;
  }

  /**
   * Increment usage counter (unconditional - use reserveOrIncrement for quota enforcement)
   */
  static async incrementUsage(accountId: string, type: UsageType, amount = 1): Promise<void> {
    // Validate type against whitelist to prevent SQL injection
    const validTypes: UsageType[] = ["emails", "llmTokens", "hunterCredits", "apiCalls"];
    if (!validTypes.includes(type)) {
      throw new Error(`Invalid usage type: ${type}`);
    }

    await db
      .update(accountBilling)
      .set({
        usageThisMonth: sql`jsonb_set(
          COALESCE(${accountBilling.usageThisMonth}, '{"emails":0,"llmTokens":0,"hunterCredits":0,"apiCalls":0}'::jsonb),
          '{${sql.raw(type)}}',
          (COALESCE((${accountBilling.usageThisMonth}->>'${sql.raw(type)}')::int, 0) + ${amount})::text::jsonb
        )`,
        updatedAt: new Date(),
      })
      .where(eq(accountBilling.accountId, accountId));
  }

  /**
   * Reset monthly usage counters (called by cron)
   */
  static async resetMonthlyUsage(accountId: string): Promise<void> {
    const now = new Date();
    await db
      .update(accountBilling)
      .set({
        usageThisMonth: { emails: 0, llmTokens: 0, hunterCredits: 0, apiCalls: 0 },
        currentPeriodStart: now,
        currentPeriodEnd: addOneMonth(now),
        updatedAt: now,
      })
      .where(eq(accountBilling.accountId, accountId));
  }

  /**
   * Get billing summary for dashboard
   */
  static async getSummary(accountId: string) {
    const billing = await BillingService.getOrCreateBilling(accountId);
    const limits = await BillingService.getLimits(accountId);
    const usage = await BillingService.getUsage(accountId);

    let planName = "Free";
    if (billing.planId) {
      const [plan] = await db
        .select({ name: billingPlans.name })
        .from(billingPlans)
        .where(eq(billingPlans.id, billing.planId))
        .limit(1);
      planName = plan?.name ?? "Free";
    }

    return {
      plan: planName,
      currentPeriodStart: billing.currentPeriodStart,
      currentPeriodEnd: billing.currentPeriodEnd,
      usage,
      limits,
      percentages: {
        emails: computePercentage(usage.emails, limits.emailsPerMonth),
        llmTokens: computePercentage(usage.llmTokens, limits.llmTokensPerMonth),
        hunterCredits: computePercentage(usage.hunterCredits, limits.hunterCreditsPerMonth),
        apiCalls: computePercentage(usage.apiCalls, limits.apiCallsPerMonth),
      },
    };
  }

  /**
   * List available plans
   */
  static async listPlans() {
    return db.select().from(billingPlans).orderBy(billingPlans.monthlyPrice);
  }
}
