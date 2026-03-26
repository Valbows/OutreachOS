"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// === Types ===

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  companyName: string | null;
  businessWebsite: string | null;
  city: string | null;
  state: string | null;
  hunterScore: number | null;
  hunterStatus: string | null;
  hunterSources: string[] | null;
  linkedinUrl: string | null;
  enrichedAt: string | null;
  unsubscribed: boolean;
  replied: boolean;
  repliedAt: string | null;
  customFields: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContactGroup {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
}

export interface ContactListParams {
  search?: string;
  groupId?: string;
  sortBy?: string;
  sortDir?: string;
  limit?: number;
  offset?: number;
}

// === Query Keys ===

export const contactKeys = {
  all: ["contacts"] as const,
  lists: () => [...contactKeys.all, "list"] as const,
  list: (params: ContactListParams) => [...contactKeys.lists(), params] as const,
  details: () => [...contactKeys.all, "detail"] as const,
  detail: (id: string) => [...contactKeys.details(), id] as const,
  groups: () => [...contactKeys.all, "groups"] as const,
};

// === Hooks ===

/** List contacts with search, group filter, sorting, pagination */
export function useContacts(params: ContactListParams = {}) {
  return useQuery({
    queryKey: contactKeys.list(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.search) searchParams.set("search", params.search);
      if (params.groupId) searchParams.set("group_id", params.groupId);
      if (params.sortBy) searchParams.set("sort_by", params.sortBy);
      if (params.sortDir) searchParams.set("sort_dir", params.sortDir);
      if (params.limit !== undefined) searchParams.set("limit", params.limit.toString());
      if (params.offset !== undefined) searchParams.set("offset", params.offset.toString());

      const res = await fetch(`/api/contacts?${searchParams.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch contacts");
      return res.json() as Promise<{ data: Contact[]; total: number }>;
    },
  });
}

/** Get a single contact by ID */
export function useContact(id: string) {
  return useQuery({
    queryKey: contactKeys.detail(id),
    queryFn: async () => {
      const res = await fetch(`/api/contacts/${id}`);
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error("Failed to fetch contact");
      }
      return res.json() as Promise<Contact>;
    },
    enabled: !!id,
  });
}

/** Create a new contact */
export function useCreateContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      firstName: string;
      lastName: string;
      email?: string;
      businessWebsite?: string;
      companyName?: string;
      city?: string;
      state?: string;
      linkedinUrl?: string;
      customFields?: Record<string, unknown>;
    }) => {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create contact");
      }
      return res.json() as Promise<Contact>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contactKeys.lists() });
    },
  });
}

/** Update a contact */
export function useUpdateContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: { id: string } & Partial<{
      firstName: string;
      lastName: string;
      email: string | null;
      businessWebsite: string | null;
      companyName: string | null;
      city: string | null;
      state: string | null;
      linkedinUrl: string | null;
      customFields: Record<string, unknown> | null;
      unsubscribed: boolean;
    }>) => {
      const res = await fetch(`/api/contacts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update contact");
      }
      return res.json() as Promise<Contact>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: contactKeys.lists() });
      queryClient.setQueryData(contactKeys.detail(data.id), data);
    },
  });
}

/** Delete contacts */
export function useDeleteContacts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await fetch("/api/contacts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete contacts");
      }
      return res.json() as Promise<{ deleted: number }>;
    },
    onSuccess: (_, ids) => {
      // Invalidate only list caches (preserves groups)
      queryClient.invalidateQueries({ queryKey: contactKeys.lists() });
      // Remove specific detail caches for deleted contacts
      ids.forEach((id) => {
        queryClient.removeQueries({ queryKey: contactKeys.detail(id) });
      });
    },
  });
}

/** List contact groups */
export function useContactGroups() {
  return useQuery({
    queryKey: contactKeys.groups(),
    queryFn: async () => {
      const res = await fetch("/api/contacts/groups");
      if (!res.ok) throw new Error("Failed to fetch groups");
      return res.json() as Promise<ContactGroup[]>;
    },
  });
}

/** Create a contact group */
export function useCreateGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { name: string; description?: string }) => {
      const res = await fetch("/api/contacts/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create group");
      }
      return res.json() as Promise<ContactGroup>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contactKeys.groups() });
    },
  });
}
