"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface Form {
  id: string;
  accountId: string;
  name: string;
  type: string;
  fields: Array<{
    name: string;
    type: string;
    required: boolean;
    label: string;
    placeholder?: string;
    options?: string[];
    defaultValue?: string;
  }> | null;
  steps?: Array<{
    id: string;
    stepNumber: number;
    title: string;
    fields: string[];
  }>;
  htmlContent: string | null;
  cssContent: string | null;
  successMessage: string | null;
  redirectUrl: string | null;
  journeyId: string | null;
  funnelId: string | null;
  submissionCount: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface FormSubmission {
  id: string;
  formId: string;
  contactId: string | null;
  data: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  submittedAt: string;
}

export interface EmbedCodes {
  hosted: string;
  iframe: string;
  widget: string;
}

export function useForms() {
  return useQuery<Form[]>({
    queryKey: ["forms"],
    queryFn: async () => {
      const res = await fetch("/api/forms");
      if (!res.ok) throw new Error("Failed to fetch forms");
      const json = await res.json();
      return json.data;
    },
  });
}

export function useForm(id: string) {
  return useQuery<Form>({
    queryKey: ["forms", id],
    queryFn: async () => {
      const res = await fetch(`/api/forms/${id}`);
      if (!res.ok) throw new Error("Failed to fetch form");
      const json = await res.json();
      return json.data;
    },
    enabled: !!id,
  });
}

export function useCreateForm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      name: string;
      type: string;
      fields: Array<{
        name: string;
        type: string;
        required: boolean;
        label: string;
      }>;
      htmlContent?: string;
      cssContent?: string;
      successMessage?: string;
      redirectUrl?: string;
    }) => {
      const res = await fetch("/api/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to create form");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forms"] });
    },
  });
}

export function useUpdateForm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Record<string, unknown>) => {
      const res = await fetch(`/api/forms/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to update form");
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["forms"] });
      queryClient.invalidateQueries({ queryKey: ["forms", variables.id] });
    },
  });
}

export function useDeleteForm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/forms/${id}`, { method: "DELETE" });
      if (!res.ok) {
        throw new Error("Failed to delete form");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forms"] });
    },
  });
}

export function useFormSubmissions(formId: string, limit = 50, offset = 0) {
  return useQuery<{ data: FormSubmission[]; total: number }>({
    queryKey: ["forms", formId, "submissions", { limit, offset }],
    queryFn: async () => {
      const res = await fetch(`/api/forms/${formId}/submissions?limit=${limit}&offset=${offset}`);
      if (!res.ok) throw new Error("Failed to fetch submissions");
      return res.json();
    },
    enabled: !!formId,
  });
}

export function useFormEmbedCodes(formId: string) {
  return useQuery<EmbedCodes>({
    queryKey: ["forms", formId, "embed"],
    queryFn: async () => {
      const res = await fetch(`/api/forms/${formId}/embed`);
      if (!res.ok) throw new Error("Failed to fetch embed codes");
      const json = await res.json();
      return json.data;
    },
    enabled: !!formId,
  });
}
