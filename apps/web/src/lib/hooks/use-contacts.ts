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
  contactCount?: number;
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

/** Update a contact group */
export function useUpdateGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: {
      id: string;
      name?: string;
      description?: string;
    }) => {
      const res = await fetch(`/api/contacts/groups/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update group");
      }
      return res.json() as Promise<ContactGroup>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: contactKeys.groups() });
      queryClient.setQueryData(contactKeys.groups(), (old: ContactGroup[] | undefined) => {
        if (!old) return [data];
        return old.map((g) => (g.id === data.id ? data : g));
      });
    },
  });
}

/** Delete a contact group */
export function useDeleteGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/contacts/groups/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete group");
      }
      return res.json() as Promise<{ success: boolean }>;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: contactKeys.groups() });
      queryClient.invalidateQueries({ queryKey: contactKeys.lists() });
      // Remove from cache
      queryClient.setQueryData(contactKeys.groups(), (old: ContactGroup[] | undefined) => {
        if (!old) return [];
        return old.filter((g) => g.id !== id);
      });
    },
  });
}

/** Add contacts to a group */
export function useAddToGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      groupId,
      contactIds,
    }: {
      groupId: string;
      contactIds: string[];
    }) => {
      const res = await fetch(`/api/contacts/groups/${groupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add contacts to group");
      }
      return res.json() as Promise<{ success: boolean; added: number }>;
    },
    onSuccess: (_, { groupId }) => {
      queryClient.invalidateQueries({ queryKey: contactKeys.groups() });
      queryClient.invalidateQueries({ queryKey: contactKeys.lists() });
      // Invalidate group-specific queries
      queryClient.invalidateQueries({
        queryKey: contactKeys.list({ groupId }),
      });
    },
  });
}

/** Remove contacts from a group */
export function useRemoveFromGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      groupId,
      contactIds,
    }: {
      groupId: string;
      contactIds: string[];
    }) => {
      const res = await fetch(`/api/contacts/groups/${groupId}/members/remove`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to remove contacts from group");
      }
      return res.json() as Promise<{ success: boolean; removed: number }>;
    },
    onSuccess: (_, { groupId }) => {
      queryClient.invalidateQueries({ queryKey: contactKeys.groups() });
      queryClient.invalidateQueries({ queryKey: contactKeys.lists() });
      // Invalidate group-specific queries
      queryClient.invalidateQueries({
        queryKey: contactKeys.list({ groupId }),
      });
    },
  });
}

// === Analytics Types ===

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
    enrolledAt: string;
  }[];
  replyHistory: {
    id: string;
    subject: string | null;
    bodyPreview: string | null;
    receivedAt: string;
  }[];
}

/** Fetch contact analytics */
export function useContactAnalytics(contactId: string) {
  return useQuery({
    queryKey: [...contactKeys.detail(contactId), "analytics"],
    queryFn: async () => {
      const res = await fetch(`/api/contacts/${contactId}/analytics`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch analytics");
      }
      return res.json() as Promise<ContactAnalytics>;
    },
    enabled: !!contactId,
  });
}

/** Re-enrich a single contact */
export function useReEnrichContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contactId: string) => {
      const res = await fetch(`/api/contacts/${contactId}/enrich`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to re-enrich contact");
      }
      return res.json() as Promise<{
        success: boolean;
        contactId: string;
        email?: string;
        score?: number;
        status?: string;
        linkedinUrl?: string;
        error?: string;
      }>;
    },
    onSuccess: (_, contactId) => {
      queryClient.invalidateQueries({ queryKey: contactKeys.detail(contactId) });
      queryClient.invalidateQueries({ queryKey: contactKeys.lists() });
    },
  });
}

/** Update a custom field on a contact */
export function useUpdateCustomField() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      contactId,
      fieldName,
      fieldValue,
    }: {
      contactId: string;
      fieldName: string;
      fieldValue: unknown;
    }) => {
      const res = await fetch(`/api/contacts/${contactId}/fields`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fieldName, fieldValue }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update custom field");
      }
      return res.json() as Promise<{ customFields: Record<string, unknown> }>;
    },
    onSuccess: (_, { contactId }) => {
      queryClient.invalidateQueries({ queryKey: contactKeys.detail(contactId) });
    },
  });
}

/** Delete a custom field from a contact */
export function useDeleteCustomField() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      contactId,
      fieldName,
    }: {
      contactId: string;
      fieldName: string;
    }) => {
      const params = new URLSearchParams({ fieldName });
      const res = await fetch(`/api/contacts/${contactId}/fields?${params.toString()}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete custom field");
      }
      return res.json() as Promise<{ customFields: Record<string, unknown> }>;
    },
    onSuccess: (_, { contactId }) => {
      queryClient.invalidateQueries({ queryKey: contactKeys.detail(contactId) });
    },
  });
}
