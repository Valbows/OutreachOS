/**
 * Developer Usage Analytics API
 * GET /api/developer/usage — get usage statistics for the account
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthAccount } from "@/lib/auth/session";
import { db, apiKeys, apiUsage, llmUsageLog } from "@outreachos/db";
import { eq, and, gte, sql, count, avg } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const account = await getAuthAccount();
    if (!account) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const range = req.nextUrl.searchParams.get("range") || "30d";
    const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Get account's API keys
    const accountKeys = await db
      .select({ id: apiKeys.id })
      .from(apiKeys)
      .where(eq(apiKeys.accountId, account.id));

    const keyIds = accountKeys.map((k) => k.id);

    // Get API usage stats
    let totalApiCalls = 0;
    let endpoints: { endpoint: string; method: string; calls: number; avgLatency: number; errorRate: number }[] = [];

    if (keyIds.length > 0) {
      const usageStats = await db
        .select({
          endpoint: apiUsage.endpoint,
          method: apiUsage.method,
          calls: count(),
          avgLatency: avg(apiUsage.responseTimeMs),
          errors: sql<number>`COUNT(*) FILTER (WHERE ${apiUsage.statusCode} >= 400)`,
        })
        .from(apiUsage)
        .where(and(
          sql`${apiUsage.apiKeyId} = ANY(${keyIds})`,
          gte(apiUsage.createdAt, startDate)
        ))
        .groupBy(apiUsage.endpoint, apiUsage.method)
        .orderBy(sql`COUNT(*) DESC`)
        .limit(20);

      endpoints = usageStats.map((row) => ({
        endpoint: row.endpoint,
        method: row.method,
        calls: Number(row.calls),
        avgLatency: Math.round(Number(row.avgLatency) || 0),
        errorRate: row.calls > 0 ? (Number(row.errors) / Number(row.calls)) * 100 : 0,
      }));

      // Get true total count (not limited to top 20)
      const totalResult = await db
        .select({
          total: count(),
        })
        .from(apiUsage)
        .where(and(
          sql`${apiUsage.apiKeyId} = ANY(${keyIds})`,
          gte(apiUsage.createdAt, startDate)
        ));

      totalApiCalls = Number(totalResult[0]?.total) || 0;
    }

    // Get LLM usage stats
    const llmStats = await db
      .select({
        totalTokens: sql<number>`COALESCE(SUM(${llmUsageLog.inputTokens}) + SUM(${llmUsageLog.outputTokens}), 0)`,
      })
      .from(llmUsageLog)
      .where(and(eq(llmUsageLog.accountId, account.id), gte(llmUsageLog.createdAt, startDate)));

    const llmTokens = Number(llmStats[0]?.totalTokens) || 0;

    // Get daily usage for chart
    const dailyLlm = await db
      .select({
        date: sql<string>`DATE(${llmUsageLog.createdAt})`,
        tokens: sql<number>`COALESCE(SUM(${llmUsageLog.inputTokens}) + SUM(${llmUsageLog.outputTokens}), 0)`,
      })
      .from(llmUsageLog)
      .where(and(eq(llmUsageLog.accountId, account.id), gte(llmUsageLog.createdAt, startDate)))
      .groupBy(sql`DATE(${llmUsageLog.createdAt})`)
      .orderBy(sql`DATE(${llmUsageLog.createdAt})`);

    // Get daily API call counts (filter by account's API keys)
    const dailyApi = keyIds.length > 0
      ? await db
          .select({
            date: sql<string>`DATE(${apiUsage.createdAt})`,
            calls: sql<number>`COUNT(*)`,
          })
          .from(apiUsage)
          .where(and(
            sql`${apiUsage.apiKeyId} IN (${keyIds.join(",")})`,
            gte(apiUsage.createdAt, startDate)
          ))
          .groupBy(sql`DATE(${apiUsage.createdAt})`)
          .orderBy(sql`DATE(${apiUsage.createdAt})`)
      : [];

    // Build date range map with all dates in range
    const dailyMap = new Map<string, { date: string; apiCalls: number; llmTokens: number }>();
    const endDate = new Date();
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      dailyMap.set(dateStr, { date: dateStr, apiCalls: 0, llmTokens: 0 });
    }

    // Merge LLM data
    for (const row of dailyLlm) {
      const existing = dailyMap.get(row.date);
      if (existing) {
        existing.llmTokens = Number(row.tokens);
      }
    }

    // Merge API call data
    for (const row of dailyApi) {
      const existing = dailyMap.get(row.date);
      if (existing) {
        existing.apiCalls = Number(row.calls);
      }
    }

    // Convert to array sorted by date descending
    const daily = Array.from(dailyMap.values())
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, days);

    return NextResponse.json({
      stats: {
        totalApiCalls,
        llmTokens,
        hunterCredits: 0,
        resendEmails: 0,
        periodStart: startDate.toISOString(),
        periodEnd: new Date().toISOString(),
      },
      endpoints,
      daily,
    });
  } catch (err) {
    console.error("Usage stats error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
