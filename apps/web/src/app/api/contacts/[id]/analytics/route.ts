/**
 * Contact Analytics API
 * GET /api/contacts/[id]/analytics — get per-contact email analytics
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthAccount } from "@/lib/auth/session";
import { ContactService } from "@outreachos/services";
import { db, messageInstances, emailEvents, replies, journeyEnrollments, campaigns } from "@outreachos/db";
import { eq, and, sql, count, inArray, not } from "drizzle-orm";

export interface ContactAnalytics {
  emailsSent: number;
  totalOpens: number;
  uniqueOpens: number;
  replies: number;
  softBounces: number;
  hardBounces: number;
  complaints: number;
  unsubscribes: number;
  hourlyOpens: { hour: number; count: number }[];
  dailyOpens: { day: string; count: number }[];
  messages: {
    id: string;
    subject: string | null;
    sentAt: string | null;
    openCount: number;
    firstOpenedAt: string | null;
    lastOpenedAt: string | null;
    status: string;
  }[];
  activeJourneys: {
    id: string;
    campaignId: string;
    campaignName: string;
    status: string;
    enrolledAt: string | null;
  }[];
  replyHistory: {
    id: string;
    subject: string | null;
    bodyPreview: string | null;
    receivedAt: string | null;
  }[];
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await getAuthAccount();
    if (!account) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: contactId } = await params;

    // Verify contact exists and belongs to account
    const contact = await ContactService.getById(account.id, contactId);
    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    // Get all message instances for this contact
    const messages = await db
      .select({
        id: messageInstances.id,
        subject: messageInstances.subject,
        sentAt: messageInstances.sentAt,
        openCount: messageInstances.openCount,
        openedAt: messageInstances.openedAt,
        lastOpenedAt: messageInstances.lastOpenedAt,
        status: messageInstances.status,
      })
      .from(messageInstances)
      .where(eq(messageInstances.contactId, contactId))
      .orderBy(sql`${messageInstances.sentAt} DESC NULLS LAST`);

    const messageIds = messages.map((m) => m.id);

    // Aggregate stats
    const emailsSent = messages.filter((m) => m.status !== "pending" && m.status !== "failed").length;
    const totalOpens = messages.reduce((sum, m) => sum + (m.openCount ?? 0), 0);
    const uniqueOpens = messages.filter((m) => m.openedAt !== null).length;

    // Get event counts by type
    let softBounces = 0;
    let hardBounces = 0;
    let complaints = 0;
    let unsubscribes = 0;

    if (messageIds.length > 0) {
      const eventCounts = await db
        .select({
          eventType: emailEvents.eventType,
          count: count(),
        })
        .from(emailEvents)
        .where(inArray(emailEvents.messageInstanceId, messageIds))
        .groupBy(emailEvents.eventType);

      for (const row of eventCounts) {
        switch (row.eventType) {
          case "soft_bounce":
            softBounces = Number(row.count);
            break;
          case "hard_bounce":
            hardBounces = Number(row.count);
            break;
          case "complained":
            complaints = Number(row.count);
            break;
          case "unsubscribed":
            unsubscribes = Number(row.count);
            break;
        }
      }
    }

    // Get hourly and daily open distribution from events
    const hourlyOpens: { hour: number; count: number }[] = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      count: 0,
    }));
    const dailyOpens: { day: string; count: number }[] = DAYS.map((d) => ({ day: d, count: 0 }));

    if (messageIds.length > 0) {
      const openEvents = await db
        .select({
          timestamp: emailEvents.timestamp,
        })
        .from(emailEvents)
        .where(
          and(
            inArray(emailEvents.messageInstanceId, messageIds),
            eq(emailEvents.eventType, "opened")
          )
        );

      for (const event of openEvents) {
        if (event.timestamp) {
          const date = new Date(event.timestamp);
          const hour = date.getUTCHours();
          const dayIndex = date.getUTCDay();
          hourlyOpens[hour].count++;
          dailyOpens[dayIndex].count++;
        }
      }
    }

    // Get reply history
    const replyHistory = await db
      .select({
        id: replies.id,
        subject: replies.subject,
        bodyPreview: replies.bodyPreview,
        receivedAt: replies.receivedAt,
      })
      .from(replies)
      .where(eq(replies.contactId, contactId))
      .orderBy(sql`${replies.receivedAt} DESC`);

    // Get active journey enrollments
    const activeJourneys = await db
      .select({
        id: journeyEnrollments.id,
        campaignId: journeyEnrollments.campaignId,
        campaignName: campaigns.name,
        status: journeyEnrollments.status,
        enrolledAt: journeyEnrollments.enrolledAt,
      })
      .from(journeyEnrollments)
      .innerJoin(campaigns, eq(journeyEnrollments.campaignId, campaigns.id))
      .where(
        and(
          eq(journeyEnrollments.contactId, contactId),
          not(inArray(journeyEnrollments.status, ["completed", "removed"]))
        )
      );

    const analytics: ContactAnalytics = {
      emailsSent,
      totalOpens,
      uniqueOpens,
      replies: replyHistory.length,
      softBounces,
      hardBounces,
      complaints,
      unsubscribes,
      hourlyOpens,
      dailyOpens,
      messages: messages.map((m) => ({
        id: m.id,
        subject: m.subject,
        sentAt: m.sentAt?.toISOString() ?? null,
        openCount: m.openCount ?? 0,
        firstOpenedAt: m.openedAt?.toISOString() ?? null,
        lastOpenedAt: m.lastOpenedAt?.toISOString() ?? null,
        status: m.status,
      })),
      activeJourneys: activeJourneys.map((j) => ({
        id: j.id,
        campaignId: j.campaignId,
        campaignName: j.campaignName,
        status: j.status,
        enrolledAt: j.enrolledAt?.toISOString() ?? null,
      })),
      replyHistory: replyHistory.map((r) => ({
        id: r.id,
        subject: r.subject,
        bodyPreview: r.bodyPreview,
        receivedAt: r.receivedAt?.toISOString() ?? null,
      })),
    };

    return NextResponse.json(analytics);
  } catch (err) {
    console.error("Contact analytics error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
