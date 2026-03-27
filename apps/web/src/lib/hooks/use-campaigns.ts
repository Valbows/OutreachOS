"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Campaign {
  id: string;
  name: string;
  type: string;
  status: string;
  groupId: string | null;
  templateId: string | null;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  settings: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

interface CampaignMetrics {
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

interface HourlyMetric {
  hour: number;
  opens: number;
  clicks: number;
}

interface DailyMetric {
  dayOfWeek: number;
  opens: number;
  clicks: number;
}

interface AnalyticsData {
  metrics: CampaignMetrics;
  hourly: HourlyMetric[];
  daily: DailyMetric[];
}

export function useCampaigns(status?: string) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  const qs = params.toString();

  return useQuery<Campaign[]>({
    queryKey: ["campaigns", status],
    queryFn: async () => {
      const res = await fetch(`/api/campaigns${qs ? `?${qs}` : ""}`);
      if (!res.ok) throw new Error("Failed to fetch campaigns");
      const json = await res.json();
      return json.data;
    },
  });
}

export function useCampaign(id: string) {
  return useQuery<Campaign>({
    queryKey: ["campaigns", id],
    queryFn: async () => {
      const res = await fetch(`/api/campaigns/${id}`);
      if (!res.ok) throw new Error("Failed to fetch campaign");
      const json = await res.json();
      return json.data;
    },
    enabled: !!id,
  });
}

export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      name: string;
      type: string;
      groupId?: string;
      templateId?: string;
      scheduledAt?: string;
    }) => {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create campaign");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns"] }),
  });
}

export function useUpdateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; [key: string]: unknown }) => {
      const res = await fetch(`/api/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update campaign");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns"] }),
  });
}

export function useDeleteCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete campaign");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns"] }),
  });
}

export function useCampaignAnalytics(campaignId: string) {
  return useQuery<AnalyticsData>({
    queryKey: ["campaigns", campaignId, "analytics"],
    queryFn: async () => {
      const res = await fetch(`/api/campaigns/${campaignId}/analytics`);
      if (!res.ok) throw new Error("Failed to fetch analytics");
      const json = await res.json();
      return json.data;
    },
    enabled: !!campaignId,
  });
}
