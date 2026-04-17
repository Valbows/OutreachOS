"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui";

export interface BlogPostFormValues {
  title: string;
  slug: string;
  content: string;
  author: string;
  tags: string;
  metaDescription: string;
  ogImage: string;
  publishedAt: string | null;
}

export interface BlogPostEditorProps {
  initialValues?: Partial<BlogPostFormValues>;
  postId?: string;
  submitLabel?: string;
  onSubmit: (values: {
    title: string;
    slug: string;
    content: string;
    author?: string;
    tags?: string[];
    metaDescription?: string;
    ogImage?: string;
    publishedAt?: string | null;
  }) => Promise<void>;
  isSubmitting?: boolean;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function renderMarkdownPreview(md: string): string {
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = md.split(/\r?\n/);
  const out: string[] = [];
  let inList = false;
  let inCode = false;

  const inline = (text: string) =>
    escape(text)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, linkText, url) => {
        // Escape URL for safe use in HTML attribute
        const safeUrl = url
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");
        return `<a href="${safeUrl}" target="_blank" rel="noreferrer">${linkText}</a>`;
      });

  for (const line of lines) {
    if (line.startsWith("```")) {
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
      inCode = !inCode;
      out.push(inCode ? "<pre><code>" : "</code></pre>");
      continue;
    }
    if (inCode) {
      out.push(escape(line));
      continue;
    }
    if (/^#{1,6} /.test(line)) {
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
      const level = line.match(/^(#{1,6}) /)?.[1].length ?? 1;
      const text = line.replace(/^#{1,6} /, "");
      out.push(`<h${level}>${inline(text)}</h${level}>`);
      continue;
    }
    if (/^[-*] /.test(line)) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${inline(line.replace(/^[-*] /, ""))}</li>`);
      continue;
    }
    if (line.trim() === "") {
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
      continue;
    }
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
    out.push(`<p>${inline(line)}</p>`);
  }
  if (inList) out.push("</ul>");
  if (inCode) out.push("</code></pre>");
  return out.join("\n");
}

export function BlogPostEditor({
  initialValues,
  postId,
  submitLabel = "Save",
  onSubmit,
  isSubmitting,
}: BlogPostEditorProps) {
  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [slug, setSlug] = useState(initialValues?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!!initialValues?.slug);
  const [content, setContent] = useState(initialValues?.content ?? "");
  const [author, setAuthor] = useState(initialValues?.author ?? "");
  const [tagsInput, setTagsInput] = useState(initialValues?.tags ?? "");
  const [metaDescription, setMetaDescription] = useState(initialValues?.metaDescription ?? "");
  const [ogImage, setOgImage] = useState(initialValues?.ogImage ?? "");
  const [publishedAt, setPublishedAt] = useState<string | null>(
    initialValues?.publishedAt ?? null,
  );
  const [view, setView] = useState<"write" | "preview">("write");
  const [formError, setFormError] = useState("");

  const isPublished = !!publishedAt;
  const previewHtml = useMemo(() => renderMarkdownPreview(content), [content]);

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (!slugTouched) setSlug(slugify(value));
  };

  const validate = (): string | null => {
    if (!title.trim()) return "Title is required";
    if (!slug.trim()) return "Slug is required";
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return "Slug must be lowercase alphanumeric with hyphens (e.g. my-post-title)";
    }
    if (!content.trim()) return "Content is required";
    if (ogImage && !/^https?:\/\//i.test(ogImage)) {
      return "OG Image must be a valid URL starting with http(s)";
    }
    if (metaDescription.length > 300) {
      return "Meta description must be 300 characters or fewer";
    }
    return null;
  };

  const handleSubmit = async (submitPublishedAt?: string | null) => {
    setFormError("");
    const err = validate();
    if (err) {
      setFormError(err);
      return;
    }
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    try {
      await onSubmit({
        title: title.trim(),
        slug: slug.trim(),
        content,
        author: author.trim() || undefined,
        tags: tags.length > 0 ? tags : undefined,
        metaDescription: metaDescription.trim() || undefined,
        ogImage: ogImage.trim() || undefined,
        publishedAt: submitPublishedAt ?? publishedAt,
      });
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Failed to save post");
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-6">
        {/* Main editor */}
        <div className="md:col-span-2 space-y-4">
          <div>
            <label htmlFor="post-title" className="block text-xs font-medium text-on-surface-variant mb-1">
              Title
            </label>
            <input
              id="post-title"
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Your post title"
              className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-base font-semibold text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              aria-required="true"
            />
          </div>

          <div>
            <label htmlFor="post-slug" className="block text-xs font-medium text-on-surface-variant mb-1">
              Slug
            </label>
            <input
              id="post-slug"
              type="text"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugTouched(true);
              }}
              placeholder="my-post-title"
              className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm font-mono text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              aria-required="true"
            />
            <p className="mt-1 text-xs text-on-surface-variant">
              Public URL: <span className="font-mono">/blog/{slug || "your-slug"}</span>
            </p>
          </div>

          {/* Content editor tabs */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span id="content-label" className="block text-xs font-medium text-on-surface-variant">
                Content (Markdown)
              </span>
              <div className="flex items-center gap-1" role="tablist" aria-label="Editor view">
                <button
                  id="tab-write"
                  role="tab"
                  aria-selected={view === "write"}
                  aria-controls="panel-write"
                  onClick={() => setView("write")}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    view === "write"
                      ? "bg-primary/10 text-primary"
                      : "text-on-surface-variant hover:bg-surface-container"
                  }`}
                  type="button"
                >
                  Write
                </button>
                <button
                  id="tab-preview"
                  role="tab"
                  aria-selected={view === "preview"}
                  aria-controls="panel-preview"
                  onClick={() => setView("preview")}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    view === "preview"
                      ? "bg-primary/10 text-primary"
                      : "text-on-surface-variant hover:bg-surface-container"
                  }`}
                  type="button"
                >
                  Preview
                </button>
              </div>
            </div>
            {view === "write" ? (
              <textarea
                id="panel-write"
                role="tabpanel"
                aria-labelledby="tab-write content-label"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={20}
                placeholder="# Hello world&#10;&#10;Write your markdown here..."
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 font-mono text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                aria-required="true"
              />
            ) : (
              <div
                id="panel-preview"
                role="tabpanel"
                aria-labelledby="tab-preview content-label"
                className="prose prose-sm max-w-none rounded-lg border border-outline-variant bg-surface p-4 min-h-[400px] text-on-surface"
                data-testid="markdown-preview"
                dangerouslySetInnerHTML={{ __html: previewHtml || "<p><em>Nothing to preview</em></p>" }}
              />
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="rounded-xl border border-outline-variant bg-surface-container-low p-4 space-y-3">
            <h3 className="text-sm font-semibold text-on-surface">Publishing</h3>
            <div>
              <div className="text-xs text-on-surface-variant mb-1">Status</div>
              <div
                data-testid="publish-status"
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                  isPublished
                    ? "bg-secondary/20 text-secondary"
                    : "bg-outline-variant/20 text-on-surface-variant"
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {isPublished ? "Published" : "Draft"}
              </div>
            </div>
            {isPublished && publishedAt && (
              <div className="text-xs text-on-surface-variant">
                Published:{" "}
                {new Date(publishedAt).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </div>
            )}
            <div className="flex flex-col gap-2 pt-2">
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => handleSubmit()}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Saving..." : submitLabel}
              </Button>
              {isPublished ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => handleSubmit(null)}
                  disabled={isSubmitting}
                >
                  Unpublish
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => handleSubmit(new Date().toISOString())}
                  disabled={isSubmitting}
                >
                  Save & Publish
                </Button>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-outline-variant bg-surface-container-low p-4 space-y-3">
            <h3 className="text-sm font-semibold text-on-surface">Metadata</h3>
            <div>
              <label htmlFor="post-author" className="block text-xs font-medium text-on-surface-variant mb-1">
                Author
              </label>
              <input
                id="post-author"
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Jane Doe"
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label htmlFor="post-tags" className="block text-xs font-medium text-on-surface-variant mb-1">
                Tags (comma-separated)
              </label>
              <input
                id="post-tags"
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="marketing, tips, email"
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label htmlFor="post-meta" className="block text-xs font-medium text-on-surface-variant mb-1">
                Meta Description
              </label>
              <textarea
                id="post-meta"
                value={metaDescription}
                onChange={(e) => setMetaDescription(e.target.value)}
                rows={3}
                placeholder="SEO description (max 300 chars)"
                maxLength={300}
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <p className="mt-1 text-xs text-on-surface-variant">
                {metaDescription.length}/300
              </p>
            </div>
            <div>
              <label htmlFor="post-ogimage" className="block text-xs font-medium text-on-surface-variant mb-1">
                OG Image URL
              </label>
              <input
                id="post-ogimage"
                type="url"
                value={ogImage}
                onChange={(e) => setOgImage(e.target.value)}
                placeholder="https://example.com/image.png"
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {postId && (
            <div className="rounded-xl border border-outline-variant bg-surface-container-low p-4 space-y-2">
              <h3 className="text-sm font-semibold text-on-surface">Export</h3>
              <p className="text-xs text-on-surface-variant">Download this post in a single format.</p>
              <div className="grid grid-cols-3 gap-2">
                <a
                  href={`/api/blog/${postId}/export?format=markdown`}
                  download
                  className="rounded-md border border-outline-variant px-2 py-1.5 text-xs text-center hover:bg-surface-container-high transition-colors"
                >
                  Markdown
                </a>
                <a
                  href={`/api/blog/${postId}/export?format=html`}
                  download
                  className="rounded-md border border-outline-variant px-2 py-1.5 text-xs text-center hover:bg-surface-container-high transition-colors"
                >
                  HTML
                </a>
                <a
                  href={`/api/blog/${postId}/export?format=json`}
                  download
                  className="rounded-md border border-outline-variant px-2 py-1.5 text-xs text-center hover:bg-surface-container-high transition-colors"
                >
                  JSON
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {formError && (
        <div role="alert" className="rounded-lg bg-error/10 px-4 py-2 text-sm text-error">
          {formError}
        </div>
      )}
    </div>
  );
}
