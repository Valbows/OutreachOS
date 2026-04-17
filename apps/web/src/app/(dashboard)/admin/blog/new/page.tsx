"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BlogPostEditor } from "@/components/blog/BlogPostEditor";
import { useCreateBlogPost } from "@/lib/hooks/use-blog";

export default function NewBlogPostPage() {
  const router = useRouter();
  const createPost = useCreateBlogPost();

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

      <h1 className="text-2xl font-semibold tracking-tight text-on-surface mb-6">
        New Blog Post
      </h1>

      <BlogPostEditor
        submitLabel="Save draft"
        isSubmitting={createPost.isPending}
        onSubmit={async (values) => {
          try {
            const created = await createPost.mutateAsync({
              title: values.title,
              slug: values.slug,
              content: values.content,
              author: values.author,
              tags: values.tags,
              metaDescription: values.metaDescription,
              ogImage: values.ogImage,
              publishedAt: values.publishedAt ?? undefined,
            });
            router.push(`/admin/blog/${created.id}/edit`);
          } catch (e) {
            // Error is surfaced via the form error handling in BlogPostEditor
            // The parent catch block in BlogPostEditor will display the error
            throw e;
          }
        }}
      />
    </div>
  );
}
