"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Experiment {
  id: string;
  accountId: string;
  campaignId: string;
  name: string;
  type: string;
  status: string;
  championVariant: string | null;
  consecutiveWins: number | null;
  settings: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

interface ExperimentBatch {
  id: string;
  experimentId: string;
  batchNumber: number;
  variantA: string;
  variantB: string;
  contactsPerVariant: number | null;
  variantAOpenRate: number | null;
  variantBOpenRate: number | null;
  winner: string | null;
  decisionRationale: string | null;
  evaluatedAt: string | null;
  createdAt: string;
}

interface ExperimentSummary {
  id: string;
  name: string;
  type: string;
  status: string;
  totalBatches: number;
  championVariant: string | null;
  consecutiveWins: number;
}

export function useExperiments() {
  return useQuery<Experiment[]>({
    queryKey: ["experiments"],
    queryFn: async () => {
      const res = await fetch("/api/experiments");
      if (!res.ok) throw new Error("Failed to fetch experiments");
      const json = await res.json();
      return json.data;
    },
  });
}

export function useExperiment(id: string) {
  return useQuery<Experiment>({
    queryKey: ["experiments", id],
    queryFn: async () => {
      const res = await fetch(`/api/experiments/${id}`);
      if (!res.ok) throw new Error("Failed to fetch experiment");
      const json = await res.json();
      return json.data;
    },
    enabled: !!id,
  });
}

export function useExperimentBatches(experimentId: string) {
  return useQuery<ExperimentBatch[]>({
    queryKey: ["experiments", experimentId, "batches"],
    queryFn: async () => {
      const res = await fetch(`/api/experiments/${experimentId}/evaluate`);
      if (!res.ok) throw new Error("Failed to fetch batches");
      const json = await res.json();
      return json.data?.batches ?? [];
    },
    enabled: !!experimentId,
  });
}

export function useCampaignExperiments(campaignId: string) {
  return useQuery<Experiment[]>({
    queryKey: ["campaigns", campaignId, "experiments"],
    queryFn: async () => {
      const res = await fetch(`/api/experiments?campaignId=${encodeURIComponent(campaignId)}`);
      if (!res.ok) throw new Error("Failed to fetch experiments");
      const json = await res.json();
      return json.data;
    },
    enabled: !!campaignId,
  });
}

export function useCreateExperiment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      campaignId: string;
      name: string;
      type: string;
      settings?: Record<string, unknown>;
    }) => {
      const res = await fetch("/api/experiments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create experiment");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["experiments"] }),
  });
}

export function useEvaluateBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ experimentId, batchId }: { experimentId: string; batchId: string }) => {
      const res = await fetch(`/api/experiments/${experimentId}/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId }),
      });
      if (!res.ok) throw new Error("Failed to evaluate batch");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["experiments"] }),
  });
}
