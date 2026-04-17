"use client";

import Link from "next/link";
import { useState } from "react";
import { useBlogPosts, useDeleteBlogPost, useUpdateBlogPost } from "@/lib/hooks/use-blog";
import { Button } from "@/components/ui";

type FilterStatus = "all" | "published" | "draft";

export default function BlogAdminPage() {
  const { data: posts, isLoading, error } = useBlogPosts();
  const deletePost = useDeleteBlogPost();
  const updatePost = useUpdateBlogPost();
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingPostId, setTogglingPostId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const filtered = (posts ?? []).filter((p) => {
    if (filter === "published") return !!p.publishedAt;
    if (filter === "draft") return !p.publishedAt;
    return true;
  });

  const totalCount = posts?.length ?? 0;
  const publishedCount = (posts ?? []).filter((p) => !!p.publishedAt).length;
  const draftCount = totalCount - publishedCount;

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    setErrorMsg("");
    setDeletingId(id);
    try {
      await deletePost.mutateAsync(id);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Failed to delete post");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleTogglePublish(id: string, currentlyPublished: boolean) {
    setErrorMsg("");
    setTogglingPostId(id);
    try {
      await updatePost.mutateAsync({
        id,
        publishedAt: currentlyPublished ? null : new Date().toISOString(),
      });
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Failed to update publish state");
    } finally {
      setTogglingPostId(null);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-on-surface">Blog</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Author, edit, and publish blog posts for your public site.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/api/blog/export"
            className="inline-flex items-center gap-2 rounded-lg border border-outline-variant px-3 py-2 text-sm text-on-surface hover:bg-surface-container-high transition-colors"
            download
          >
            Export all (JSON)
          </a>
          <Link
            href="/admin/blog/new"
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-br from-primary to-primary-container px-4 py-2.5 text-sm font-semibold text-on-primary-fixed hover:shadow-lg hover:shadow-primary/20 transition-all"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            New Post
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <StatCard label="All Posts" value={totalCount.toString()} accent="primary" />
        <StatCard label="Published" value={publishedCount.toString()} accent="secondary" />
        <StatCard label="Drafts" value={draftCount.toString()} accent="tertiary" />
      </div>

      {/* Filters */}
      <div
        className="flex items-center gap-1 mb-4"
        role="tablist"
        aria-label="Filter by status"
      >
        {(["all", "published", "draft"] as FilterStatus[]).map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
              filter === f
                ? "bg-primary/10 text-primary"
                : "text-on-surface-variant hover:bg-surface-container"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {errorMsg && (
        <div role="alert" className="mb-4 rounded-lg bg-error/10 px-4 py-2 text-xs text-error">
          {errorMsg}
        </div>
      )}

      {/* List */}
      <div className="rounded-2xl bg-surface-container-low overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-on-surface-variant">Loading posts...</div>
        ) : error ? (
          <div className="p-12 text-center" role="alert">
            <h3 className="text-lg font-semibold text-error">Failed to load posts</h3>
            <p className="mt-2 text-sm text-on-surface-variant">
              Please try again.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <h3 className="text-lg font-semibold text-on-surface">No posts yet</h3>
            <p className="mt-2 text-sm text-on-surface-variant">
              {filter === "all"
                ? "Create your first blog post to get started."
                : `No ${filter} posts. Try switching filters.`}
            </p>
            {filter === "all" && (
              <Link
                href="/admin/blog/new"
                className="inline-flex items-center gap-2 mt-6 rounded-lg bg-gradient-to-br from-primary to-primary-container px-4 py-2 text-sm font-semibold text-on-primary-fixed hover:shadow-lg hover:shadow-primary/20 transition-all"
              >
                New Post
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left font-mono text-xs uppercase tracking-wider text-on-surface-variant">
                  <th className="px-6 py-4 font-medium">Title</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Published</th>
                  <th className="px-6 py-4 font-medium">Updated</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((post) => {
                  const isPublished = !!post.publishedAt;
                  return (
                    <tr
                      key={post.id}
                      className="border-t border-outline-variant/10 hover:bg-surface-container/50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <Link
                          href={`/admin/blog/${post.id}/edit`}
                          className="font-semibold text-on-surface hover:text-primary transition-colors"
                        >
                          {post.title}
                        </Link>
                        <div className="text-xs text-on-surface-variant font-mono mt-0.5">
                          /{post.slug}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                            isPublished
                              ? "bg-secondary/20 text-secondary"
                              : "bg-outline-variant/20 text-on-surface-variant"
                          }`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          {isPublished ? "published" : "draft"}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-on-surface-variant">
                        {post.publishedAt
                          ? new Date(post.publishedAt).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "—"}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-on-surface-variant">
                        {new Date(post.updatedAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleTogglePublish(post.id, isPublished)}
                            disabled={togglingPostId === post.id || updatePost.isPending}
                          >
                            {togglingPostId === post.id ? (isPublished ? "Unpublishing..." : "Publishing...") : (isPublished ? "Unpublish" : "Publish")}
                          </Button>
                          <Link
                            href={`/admin/blog/${post.id}/edit`}
                            className="text-sm text-primary hover:underline"
                          >
                            Edit
                          </Link>
                          <button
                            onClick={() => handleDelete(post.id, post.title)}
                            disabled={deletingId === post.id}
                            className="text-sm text-error hover:underline disabled:opacity-50"
                            aria-label={`Delete ${post.title}`}
                          >
                            {deletingId === post.id ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "primary" | "secondary" | "tertiary";
}) {
  const accentClass = {
    primary: "text-primary",
    secondary: "text-secondary",
    tertiary: "text-tertiary",
  }[accent];

  return (
    <div className="rounded-xl bg-surface-container-low p-5 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-current opacity-[0.03] pointer-events-none" />
      <p className="font-mono text-xs uppercase tracking-wider text-on-surface-variant">{label}</p>
      <p className={`mt-2 font-mono text-3xl font-bold ${accentClass}`}>{value}</p>
    </div>
  );
}
