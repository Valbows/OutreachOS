import Link from "next/link";
import { BlogService } from "@outreachos/services";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import DOMPurify from "isomorphic-dompurify";
import { NewsletterSubscribe } from "@/components/features/newsletter-subscribe";
import { buildBlogTitle, buildBlogDescription } from "../seo";
import { calculateReadTime } from "@/lib/blog/read-time";

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
  const readTimeMinutes = calculateReadTime(post.content);

  return (
    <div className="min-h-screen bg-surface">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-surface/80 backdrop-blur-xl border-b border-outline-variant/15">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-gradient-to-br from-primary to-primary-container" />
            <span className="font-bold tracking-tight text-on-surface">OutreachOS</span>
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/blog" className="text-sm text-primary font-medium">Blog</Link>
            <Link href="/pricing" className="text-sm text-on-surface-variant hover:text-on-surface transition-colors">Pricing</Link>
            <Link href="/login" className="text-sm text-on-surface-variant hover:text-on-surface transition-colors">Login</Link>
          </div>
        </div>
      </nav>

      {/* Back Link */}
      <div className="mx-auto max-w-4xl px-6 pt-12">
        <Link href="/blog" className="font-mono text-xs uppercase tracking-[0.2em] text-on-surface-variant hover:text-primary transition-colors inline-flex items-center gap-2">
          ← All Posts
        </Link>
      </div>

      {/* Article Header */}
      <header className="mx-auto max-w-4xl px-6 py-8">
        {post.tags && (post.tags as string[])[0] && (
          <span className="inline-block rounded-full bg-secondary/20 px-3 py-1 text-xs font-medium text-secondary mb-6">
            {(post.tags as string[])[0]}
          </span>
        )}
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-on-surface leading-[1.1]">
          {post.title}
        </h1>
        {post.metaDescription && (
          <p className="mt-6 text-xl text-on-surface-variant leading-relaxed max-w-3xl">
            {post.metaDescription}
          </p>
        )}
        <div className="mt-8 flex flex-wrap items-center gap-4 font-mono text-xs text-on-surface-variant">
          {post.author && (
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-secondary text-xs font-bold text-on-surface flex items-center justify-center">
                {post.author.slice(0, 2).toUpperCase()}
              </div>
              <span className="text-on-surface">{post.author}</span>
            </div>
          )}
          {post.publishedAt && (
            <>
              {post.author && <span className="opacity-50" aria-hidden="true">•</span>}
              <time dateTime={new Date(post.publishedAt).toISOString()}>
                {new Date(post.publishedAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </time>
            </>
          )}
          {(post.author || post.publishedAt) && (
            <span className="opacity-50" aria-hidden="true">•</span>
          )}
          <span>{readTimeMinutes} min read</span>
        </div>
      </header>

      {/* Hero Image Placeholder */}
      <div className="mx-auto max-w-5xl px-6 mb-12">
        <div className="aspect-[16/9] rounded-2xl bg-gradient-to-br from-primary/20 via-surface-variant to-secondary/15 relative overflow-hidden">
          <div className="absolute inset-0 shadow-[inset_0_0_60px_rgba(196,192,255,0.1)]" />
        </div>
      </div>

      {/* Article Body */}
      <main className="mx-auto max-w-4xl px-6 pb-16">
        <article
          className="prose prose-invert prose-lg max-w-none
            prose-headings:text-on-surface prose-headings:font-bold prose-headings:tracking-tight
            prose-h2:text-3xl prose-h2:mt-12 prose-h2:mb-4
            prose-h3:text-2xl prose-h3:mt-8 prose-h3:mb-3
            prose-p:text-on-surface prose-p:leading-relaxed prose-p:text-lg
            prose-a:text-primary prose-a:no-underline hover:prose-a:underline
            prose-strong:text-on-surface prose-strong:font-semibold
            prose-code:text-secondary prose-code:bg-surface-container prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:font-mono prose-code:text-sm prose-code:before:content-none prose-code:after:content-none
            prose-pre:bg-surface-container prose-pre:rounded-xl prose-pre:p-6
            prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:bg-surface-container-low prose-blockquote:py-4 prose-blockquote:px-6 prose-blockquote:rounded-r-lg prose-blockquote:not-italic
            prose-img:rounded-xl prose-img:shadow-lg
            prose-hr:border-outline-variant/20
            prose-ul:text-on-surface prose-ol:text-on-surface
            prose-li:text-on-surface prose-li:leading-relaxed"
          dangerouslySetInnerHTML={{ __html: sanitizedContent }}
        />

        {/* Author Bio */}
        {post.author && (
          <div className="mt-16 rounded-2xl bg-surface-container-low p-8">
            <div className="flex items-start gap-5">
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-primary to-secondary text-xl font-bold text-on-surface flex items-center justify-center flex-shrink-0">
                {post.author.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-on-surface-variant mb-1">
                  Written by
                </p>
                <h3 className="text-xl font-bold text-on-surface">{post.author}</h3>
                <p className="mt-2 text-sm text-on-surface-variant leading-relaxed">
                  Operator, writer, and builder sharing insights from the trenches of cold outreach and AI automation.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Newsletter */}
        <div className="mt-12">
          <NewsletterSubscribe
            accountId={post.accountId}
            heading="Get future posts in your inbox"
            description="Subscribe for new OutreachOS articles, product updates, and outreach tips."
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-outline-variant/15 mt-12">
        <div className="mx-auto max-w-7xl px-6 py-8 flex items-center justify-between">
          <p className="font-mono text-xs text-on-surface-variant">
            © {new Date().getFullYear()} OutreachOS. All rights reserved.
          </p>
          <div className="flex gap-6 text-xs text-on-surface-variant font-mono">
            <Link href="/privacy" className="hover:text-on-surface">Privacy</Link>
            <Link href="/terms" className="hover:text-on-surface">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
