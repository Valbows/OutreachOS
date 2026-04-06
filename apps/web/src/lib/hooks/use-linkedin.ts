"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface BatchGenerateResult {
  entries: PlaybookEntry[];
  errors: { contactId?: string; error: string }[];
  total: number;
  successCount: number;
  errorCount: number;
}

export interface PlaybookEntry {
  id: string;
  accountId: string;
  contactId: string | null;
  groupId: string | null;
  prompt: string | null;
  generatedCopy: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface PlaybookListResponse {
  entries: PlaybookEntry[];
  total: number;
}

export function useLinkedInPlaybook(status?: string) {
  return useQuery<PlaybookListResponse>({
    queryKey: ["linkedin", "playbook", status],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      const res = await fetch(`/api/linkedin?${params}`);
      if (!res.ok) throw new Error("Failed to fetch playbook");
      return res.json();
    },
  });
}

export function useLinkedInEntry(id: string) {
  return useQuery<PlaybookEntry>({
    queryKey: ["linkedin", "entry", id],
    queryFn: async () => {
      const res = await fetch(`/api/linkedin/${id}`);
      if (!res.ok) throw new Error("Entry not found");
      return res.json();
    },
    enabled: !!id,
  });
}

export function useGenerateLinkedInCopy() {
  const queryClient = useQueryClient();
  return useMutation<PlaybookEntry, Error, { contactId?: string; groupId?: string; prompt: string; researchNotes?: string }>({
    mutationFn: async (input) => {
      const res = await fetch("/api/linkedin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to generate copy");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["linkedin"] });
    },
  });
}

export function useRegenerateLinkedInCopy() {
  const queryClient = useQueryClient();
  return useMutation<PlaybookEntry, Error, string>({
    mutationFn: async (id) => {
      const res = await fetch(`/api/linkedin/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerate: true }),
      });
      if (!res.ok) throw new Error("Failed to regenerate copy");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["linkedin"] });
    },
  });
}

export function useUpdatePlaybookStatus() {
  const queryClient = useQueryClient();
  return useMutation<PlaybookEntry, Error, { id: string; status: string }>({
    mutationFn: async ({ id, status }) => {
      const res = await fetch(`/api/linkedin/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["linkedin"] });
    },
  });
}

export function useDeletePlaybookEntry() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const res = await fetch(`/api/linkedin/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete entry");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["linkedin"] });
    },
  });
}

export function useBatchGenerateLinkedInCopy() {
  const queryClient = useQueryClient();
  return useMutation<BatchGenerateResult, Error, { contactIds?: string[]; groupId?: string; prompt: string; researchNotes?: string }>({
    mutationFn: async (input) => {
      const res = await fetch("/api/linkedin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to batch generate copy");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["linkedin"] });
    },
  });
}
