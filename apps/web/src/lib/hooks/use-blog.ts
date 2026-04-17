"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface BlogPost {
  id: string;
  accountId: string;
  title: string;
  slug: string;
  content: string;
  tags: string[] | null;
  author: string | null;
  metaDescription: string | null;
  ogImage: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBlogPostInput {
  title: string;
  slug: string;
  content: string;
  tags?: string[];
  author?: string;
  metaDescription?: string;
  ogImage?: string;
  publishedAt?: string | null;
}

export interface UpdateBlogPostInput {
  title?: string;
  slug?: string;
  content?: string;
  tags?: string[];
  author?: string;
  metaDescription?: string | null;
  ogImage?: string | null;
  publishedAt?: string | null;
}

/** List admin blog posts (all, including drafts) */
export function useBlogPosts() {
  return useQuery<BlogPost[]>({
    queryKey: ["blog"],
    queryFn: async () => {
      const res = await fetch("/api/blog");
      if (!res.ok) throw new Error("Failed to load blog posts");
      const json = await res.json();
      return json.data ?? [];
    },
  });
}

/** Get a single blog post by ID (admin) */
export function useBlogPost(id: string | null | undefined) {
  return useQuery<BlogPost>({
    queryKey: ["blog", id],
    queryFn: async () => {
      if (!id) throw new Error("Missing post ID");
      const res = await fetch(`/api/blog/${id}?admin=true`);
      if (!res.ok) throw new Error("Failed to load post");
      const json = await res.json();
      return json.data;
    },
    enabled: !!id,
  });
}

/** Create a blog post */
export function useCreateBlogPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateBlogPostInput) => {
      const res = await fetch("/api/blog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to create blog post");
      }
      const json = await res.json();
      return json.data as BlogPost;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["blog"] }),
  });
}

/** Update a blog post (by ID) */
export function useUpdateBlogPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateBlogPostInput & { id: string }) => {
      const res = await fetch(`/api/blog/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to update blog post");
      }
      const json = await res.json();
      return json.data as BlogPost;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["blog"] });
      qc.invalidateQueries({ queryKey: ["blog", variables.id] });
    },
  });
}

/** Delete a blog post */
export function useDeleteBlogPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/blog/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        throw new Error("Failed to delete blog post");
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["blog"] }),
  });
}
