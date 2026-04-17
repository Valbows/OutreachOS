"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface Journey {
  id: string;
  name: string;
  type: string;
  status: string;
  groupId: string | null;
  scheduledAt: string | null;
  settings: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  steps?: JourneyStep[];
  progress?: JourneyProgress;
}

export interface JourneyStep {
  id: string;
  campaignId: string;
  stepNumber: number;
  name: string;
  templateId: string | null;
  delayDays: number | null;
  delayHour: number | null;
  createdAt: string;
}

export interface JourneyProgress {
  totalEnrolled: number;
  active: number;
  completed: number;
  removed: number;
  byStep: Record<string, number>;
}

export function useJourneys() {
  return useQuery<Journey[]>({
    queryKey: ["journeys"],
    queryFn: async () => {
      const res = await fetch("/api/journeys");
      if (!res.ok) throw new Error("Failed to fetch journeys");
      const json = await res.json();
      return json.data;
    },
  });
}

export function useJourney(id: string) {
  return useQuery<Journey>({
    queryKey: ["journeys", id],
    queryFn: async () => {
      const res = await fetch(`/api/journeys/${id}`);
      if (!res.ok) throw new Error("Failed to fetch journey");
      const json = await res.json();
      return json.data;
    },
    enabled: !!id,
  });
}

export function useCreateJourney() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      name: string;
      groupId?: string;
      removeOnReply?: boolean;
      removeOnUnsubscribe?: boolean;
      steps?: Array<{
        name: string;
        templateId: string;
        delayDays: number;
        delayHour?: number;
      }>;
    }) => {
      const res = await fetch("/api/journeys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to create journey");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journeys"] });
    },
  });
}

export function useDeleteJourney() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/journeys/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        throw new Error("Failed to delete journey");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journeys"] });
    },
  });
}

export function useEnrollContacts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      journeyId,
      contactIds,
      removeOnReply,
      removeOnUnsubscribe,
    }: {
      journeyId: string;
      contactIds: string[];
      removeOnReply?: boolean;
      removeOnUnsubscribe?: boolean;
    }) => {
      const res = await fetch(`/api/journeys/${journeyId}/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds, removeOnReply, removeOnUnsubscribe }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to enroll contacts");
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["journeys", variables.journeyId] });
    },
  });
}

export function useAddJourneyStep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      journeyId,
      data,
    }: {
      journeyId: string;
      data: { name: string; templateId?: string; delayDays: number; delayHour?: number | null };
    }) => {
      const res = await fetch(`/api/journeys/${journeyId}/steps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to add step");
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["journeys", variables.journeyId] });
    },
  });
}

export function useUpdateJourneyStep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      journeyId,
      stepId,
      data,
    }: {
      journeyId: string;
      stepId: string;
      data: { templateId?: string; delayDays?: number; delayHour?: number | null };
    }) => {
      const res = await fetch(`/api/journeys/${journeyId}/steps/${stepId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to update step");
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["journeys", variables.journeyId] });
    },
  });
}

export function useDeleteJourneyStep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ journeyId, stepId }: { journeyId: string; stepId: string }) => {
      const res = await fetch(`/api/journeys/${journeyId}/steps/${stepId}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 204) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to delete step");
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["journeys", variables.journeyId] });
    },
  });
}
