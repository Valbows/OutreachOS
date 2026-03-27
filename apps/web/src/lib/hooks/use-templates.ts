"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Template {
  id: string;
  accountId: string;
  name: string;
  subject: string | null;
  bodyHtml: string | null;
  bodyText: string | null;
  tokens: string[] | null;
  tokenFallbacks: Record<string, string> | null;
  version: number;
  parentTemplateId: string | null;
  createdAt: string;
  updatedAt: string;
}

export function useTemplates() {
  return useQuery<Template[]>({
    queryKey: ["templates"],
    queryFn: async () => {
      const res = await fetch("/api/templates");
      if (!res.ok) throw new Error("Failed to fetch templates");
      const json = await res.json();
      return json.data;
    },
  });
}

export function useTemplate(id: string) {
  return useQuery<Template>({
    queryKey: ["templates", id],
    queryFn: async () => {
      const res = await fetch(`/api/templates/${id}`);
      if (!res.ok) throw new Error("Failed to fetch template");
      const json = await res.json();
      return json.data;
    },
    enabled: !!id,
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      name: string;
      subject?: string;
      bodyHtml?: string;
      bodyText?: string;
      tokenFallbacks?: Record<string, string>;
    }) => {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create template");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
  });
}

export function useUpdateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      name?: string;
      subject?: string;
      bodyHtml?: string;
      bodyText?: string;
      tokenFallbacks?: Record<string, string>;
    }) => {
      const res = await fetch(`/api/templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update template");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete template");
      // Handle 204 No Content or empty body
      if (res.status === 204) return null;
      const text = await res.text();
      return text ? JSON.parse(text) : null;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
  });
}

export function useGenerateEmail() {
  return useMutation({
    mutationFn: async (data: {
      goal: string;
      audience: string;
      tone: string;
      cta?: string;
      maxWords?: number;
      additionalInstructions?: string;
    }) => {
      const res = await fetch("/api/templates/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate_email", ...data }),
      });
      if (!res.ok) throw new Error("Failed to generate email");
      const json = await res.json();
      return json.data;
    },
  });
}

export function useGenerateSubjects() {
  return useMutation({
    mutationFn: async (data: {
      emailBody: string;
      tone: string;
      maxWords?: number;
      count?: number;
    }) => {
      const res = await fetch("/api/templates/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate_subjects", ...data }),
      });
      if (!res.ok) throw new Error("Failed to generate subjects");
      const json = await res.json();
      return json.data;
    },
  });
}

export function useRewriteEmail() {
  return useMutation({
    mutationFn: async (data: { currentBody: string; instruction: string }) => {
      const res = await fetch("/api/templates/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rewrite", ...data }),
      });
      if (!res.ok) throw new Error("Failed to rewrite email");
      const json = await res.json();
      return json.data;
    },
  });
}
