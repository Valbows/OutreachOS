"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { BlogPostEditor } from "@/components/blog/BlogPostEditor";
import { useBlogPost, useUpdateBlogPost } from "@/lib/hooks/use-blog";

export default function EditBlogPostPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { data: post, isLoading, error } = useBlogPost(id);
  const updatePost = useUpdateBlogPost();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="rounded-xl border border-outline-variant bg-surface-container-low p-12 text-center">
        <h3 className="text-sm font-medium text-on-surface mb-1">Post not found</h3>
        <p className="text-xs text-on-surface-variant mb-4">
          {error?.message ?? "The post you're looking for doesn't exist."}
        </p>
        <Link
          href="/admin/blog"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary/90 transition-colors"
        >
          Back to Blog
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin/blog"
          className="text-sm text-on-surface-variant hover:text-on-surface transition-colors"
        >
          &larr; Back to Blog
        </Link>
      </div>

      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-on-surface">
          Edit Blog Post
        </h1>
        {post.publishedAt && (
          <Link
            href={`/blog/${post.slug}`}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-primary hover:underline"
          >
            View live &rarr;
          </Link>
        )}
      </div>

      <BlogPostEditor
        postId={post.id}
        submitLabel="Save changes"
        isSubmitting={updatePost.isPending}
        initialValues={{
          title: post.title,
          slug: post.slug,
          content: post.content,
          author: post.author ?? "",
          tags: (post.tags ?? []).join(", "),
          metaDescription: post.metaDescription ?? "",
          ogImage: post.ogImage ?? "",
          publishedAt: post.publishedAt,
        }}
        onSubmit={async (values) => {
          await updatePost.mutateAsync({
            id: post.id,
            title: values.title,
            slug: values.slug,
            content: values.content,
            author: values.author?.trim() || undefined,
            tags: values.tags?.length ? values.tags : undefined,
            metaDescription: values.metaDescription?.trim() || undefined,
            ogImage: values.ogImage?.trim() || undefined,
            publishedAt: values.publishedAt,
          });
        }}
      />
    </div>
  );
}
