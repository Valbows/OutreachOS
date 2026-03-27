/**
 * AnalyticsService — Campaign/contact analytics aggregation
 * Implemented in Phase 4
 */

import { db, messageInstances, emailEvents } from "@outreachos/db";
import { eq, and, sql, count } from "drizzle-orm";

export interface CampaignMetrics {
  totalSent: number;
  totalDelivered: number;
  totalFailed: number;
  totalOpened: number;
  uniqueOpens: number;
  totalClicked: number;
  totalBounced: number;
  totalComplained: number;
  totalUnsubscribed: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
  complaintRate: number;
  unsubscribeRate: number;
}

export interface HourlyMetric {
  hour: number; // 0-23
  opens: number;
  clicks: number;
}

export interface DailyMetric {
  dayOfWeek: number; // 0=Sunday, 6=Saturday
  opens: number;
  clicks: number;
}

export class AnalyticsService {
  /** Get aggregate metrics for a campaign */
  static async getCampaignMetrics(campaignId: string): Promise<CampaignMetrics> {
    // Count messages by status (cast to number to handle PostgreSQL string counts)
    const statusCounts = await db
      .select({
        status: messageInstances.status,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(messageInstances)
      .where(eq(messageInstances.campaignId, campaignId))
      .groupBy(messageInstances.status);

    const statusMap = new Map(statusCounts.map((s) => [s.status, s.count]));

    const totalSent =
      (statusMap.get("sent") ?? 0) +
      (statusMap.get("delivered") ?? 0) +
      (statusMap.get("opened") ?? 0) +
      (statusMap.get("clicked") ?? 0) +
      (statusMap.get("bounced") ?? 0) +
      (statusMap.get("complained") ?? 0);

    const totalDelivered =
      (statusMap.get("delivered") ?? 0) +
      (statusMap.get("opened") ?? 0) +
      (statusMap.get("clicked") ?? 0);

    const totalFailed = statusMap.get("failed") ?? 0;
    const totalBounced = statusMap.get("bounced") ?? 0;
    const totalComplained = statusMap.get("complained") ?? 0;

    // Unique opens: contacts who opened at least once
    const [openResult] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(messageInstances)
      .where(
        and(
          eq(messageInstances.campaignId, campaignId),
          sql`${messageInstances.openCount} > 0`,
        ),
      );
    const uniqueOpens = openResult?.count ?? 0;

    // Total opens (including re-opens)
    const [totalOpenResult] = await db
      .select({ total: sql<number>`COALESCE(SUM(${messageInstances.openCount}), 0)::int` })
      .from(messageInstances)
      .where(eq(messageInstances.campaignId, campaignId));
    const totalOpened = totalOpenResult?.total ?? 0;

    // Clicked count from events
    const [clickResult] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(emailEvents)
      .where(
        and(
          eq(emailEvents.eventType, "email.clicked"),
          sql`${emailEvents.messageInstanceId} IN (
            SELECT id FROM message_instances WHERE campaign_id = ${campaignId}
          )`,
        ),
      );
    const totalClicked = clickResult?.count ?? 0;

    // Unsubscribe count from events
    const [unsubResult] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(emailEvents)
      .where(
        and(
          eq(emailEvents.eventType, "email.unsubscribed"),
          sql`${emailEvents.messageInstanceId} IN (
            SELECT id FROM message_instances WHERE campaign_id = ${campaignId}
          )`,
        ),
      );
    const totalUnsubscribed = unsubResult?.count ?? 0;

    const denominator = totalSent || 1;

    return {
      totalSent,
      totalDelivered,
      totalFailed,
      totalOpened,
      uniqueOpens,
      totalClicked,
      totalBounced,
      totalComplained,
      totalUnsubscribed,
      openRate: uniqueOpens / denominator,
      clickRate: totalClicked / denominator,
      bounceRate: totalBounced / denominator,
      complaintRate: totalComplained / denominator,
      unsubscribeRate: totalUnsubscribed / denominator,
    };
  }

  /** Get hourly open/click distribution for send-time optimization */
  static async getHourlyMetrics(campaignId: string): Promise<HourlyMetric[]> {
    const rows = await db
      .select({
        hour: sql<number>`EXTRACT(HOUR FROM ${emailEvents.timestamp})`,
        eventType: emailEvents.eventType,
        count: count(),
      })
      .from(emailEvents)
      .where(
        sql`${emailEvents.messageInstanceId} IN (
          SELECT id FROM message_instances WHERE campaign_id = ${campaignId}
        ) AND ${emailEvents.eventType} IN ('email.opened', 'email.clicked')`,
      )
      .groupBy(sql`EXTRACT(HOUR FROM ${emailEvents.timestamp})`, emailEvents.eventType);

    // Build 24-hour array
    const metrics: HourlyMetric[] = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      opens: 0,
      clicks: 0,
    }));

    for (const row of rows) {
      const hour = Number(row.hour);
      if (hour >= 0 && hour < 24) {
        if (row.eventType === "email.opened") {
          metrics[hour].opens = row.count;
        } else if (row.eventType === "email.clicked") {
          metrics[hour].clicks = row.count;
        }
      }
    }

    return metrics;
  }

  /** Get day-of-week open/click distribution */
  static async getDailyMetrics(campaignId: string): Promise<DailyMetric[]> {
    const rows = await db
      .select({
        dayOfWeek: sql<number>`EXTRACT(DOW FROM ${emailEvents.timestamp})`,
        eventType: emailEvents.eventType,
        count: count(),
      })
      .from(emailEvents)
      .where(
        sql`${emailEvents.messageInstanceId} IN (
          SELECT id FROM message_instances WHERE campaign_id = ${campaignId}
        ) AND ${emailEvents.eventType} IN ('email.opened', 'email.clicked')`,
      )
      .groupBy(sql`EXTRACT(DOW FROM ${emailEvents.timestamp})`, emailEvents.eventType);

    // Build 7-day array (0=Sunday)
    const metrics: DailyMetric[] = Array.from({ length: 7 }, (_, i) => ({
      dayOfWeek: i,
      opens: 0,
      clicks: 0,
    }));

    for (const row of rows) {
      const day = Number(row.dayOfWeek);
      if (day >= 0 && day < 7) {
        if (row.eventType === "email.opened") {
          metrics[day].opens = row.count;
        } else if (row.eventType === "email.clicked") {
          metrics[day].clicks = row.count;
        }
      }
    }

    return metrics;
  }
}
