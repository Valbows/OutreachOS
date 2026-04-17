"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface McpServer {
  id: string;
  accountId: string;
  name: string;
  url: string;
  apiKey: string | null;
  description: string | null;
  enabled: number;
  lastTestedAt: string | null;
  lastTestStatus: string | null;
  lastTestError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMcpServerInput {
  name: string;
  url: string;
  apiKey?: string;
  description?: string;
}

export interface UpdateMcpServerInput {
  name?: string;
  url?: string;
  apiKey?: string | null;
  description?: string | null;
  enabled?: boolean;
}

export function useMcpServers() {
  return useQuery<McpServer[]>({
    queryKey: ["mcp-servers"],
    queryFn: async () => {
      const res = await fetch("/api/mcp-servers");
      if (!res.ok) throw new Error("Failed to load MCP servers");
      const json = await res.json();
      return json.data ?? [];
    },
  });
}

export function useCreateMcpServer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateMcpServerInput) => {
      const res = await fetch("/api/mcp-servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to create MCP server");
      }
      const json = await res.json();
      return json.data as McpServer;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mcp-servers"] }),
  });
}

export function useUpdateMcpServer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateMcpServerInput & { id: string }) => {
      const res = await fetch(`/api/mcp-servers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to update MCP server");
      }
      const json = await res.json();
      return json.data as McpServer;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mcp-servers"] }),
  });
}

export function useDeleteMcpServer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/mcp-servers/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error("Failed to delete MCP server");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mcp-servers"] }),
  });
}

export function useTestMcpServer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/mcp-servers/${id}/test`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Test failed");
      }
      const json = await res.json();
      return json.data as { ok: boolean; error?: string; latencyMs?: number };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mcp-servers"] }),
  });
}
