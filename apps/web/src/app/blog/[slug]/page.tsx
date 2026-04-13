import Link from "next/link";
import { BlogService } from "@outreachos/services";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import DOMPurify from "isomorphic-dompurify";
import { NewsletterSubscribe } from "@/components/features/newsletter-subscribe";
import { buildBlogTitle, buildBlogDescription } from "../seo";

export const revalidate = 60;

export async function generateStaticParams() {
  const slugs = await BlogService.getAllSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await BlogService.getBySlug(slug);
  if (!post) return {};
  const title = buildBlogTitle(post.title);
  const description = buildBlogDescription(post.metaDescription, null);
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: post.ogImage ? [post.ogImage] : undefined,
      type: "article",
      publishedTime: post.publishedAt ? new Date(post.publishedAt).toISOString() : undefined,
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await BlogService.getBySlug(slug);
  if (!post) notFound();

  // Sanitize HTML content to prevent XSS attacks
  const sanitizedContent = DOMPurify.sanitize(post.content);

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-outline-variant bg-surface-container-low">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <Link href="/blog" className="text-sm text-on-surface-variant hover:text-primary transition-colors">
            ← All Posts
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <article>
          <h1 className="text-3xl font-bold tracking-tight text-on-surface mb-3">{post.title}</h1>
          <div className="flex items-center gap-3 text-sm text-on-surface-variant mb-8">
            {post.author && <span>By {post.author}</span>}
            {post.publishedAt && (
              <time dateTime={new Date(post.publishedAt).toISOString()}>
                {new Date(post.publishedAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </time>
            )}
          </div>
          {post.tags && (post.tags as string[]).length > 0 && (
            <div className="flex gap-2 mb-6">
              {(post.tags as string[]).map((tag) => (
                <span key={tag} className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
                  {tag}
                </span>
              ))}
            </div>
          )}
          {/* Render sanitized HTML content */}
          <div
            className="prose prose-invert max-w-none text-on-surface prose-headings:text-on-surface prose-a:text-primary prose-strong:text-on-surface prose-code:text-primary"
            dangerouslySetInnerHTML={{ __html: sanitizedContent }}
          />
          <div className="mt-12">
            <NewsletterSubscribe
              accountId={post.accountId}
              heading="Get future posts in your inbox"
              description="Subscribe for new OutreachOS articles, product updates, and outreach tips."
            />
          </div>
        </article>
      </main>
    </div>
  );
}
