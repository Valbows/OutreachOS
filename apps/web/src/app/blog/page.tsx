import Link from "next/link";
import { BlogService } from "@outreachos/services";
import { NewsletterSubscribeCard } from "@/components/blog/NewsletterSubscribeCard";
import { BlogCategoryFilter } from "@/components/blog/BlogCategoryFilter";
import { calculateReadTime } from "@/lib/blog/read-time";

export const revalidate = 60; // ISR: revalidate every 60 seconds

export const metadata = {
  title: "Blog | OutreachOS - Insights on Cold Outreach & AI",
  description: "Tactics, teardowns, and data from operators running millions of emails.",
};

export default async function BlogListPage() {
  const rawPosts = await BlogService.listPublished(20, 0);
  // Compute readTimeMinutes server-side so client components receive plain numbers
  const posts = rawPosts.map((p) => ({
    ...p,
    readTimeMinutes: calculateReadTime(p.content),
  }));
  const [featured, ...rest] = posts;

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
            <Link
              href="#subscribe"
              className="rounded-md bg-gradient-to-br from-primary to-primary-container px-4 py-2 text-sm font-semibold text-on-primary-fixed hover:shadow-lg hover:shadow-primary/20 transition-all"
            >
              Subscribe
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-6 py-16 lg:py-24">
        <div className="max-w-3xl">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-secondary mb-4">
            OutreachOS Journal
          </p>
          <h1 className="text-5xl lg:text-7xl font-bold tracking-tight text-on-surface leading-[1.05]">
            Insights on Cold Outreach & AI
          </h1>
          <p className="mt-6 text-lg text-on-surface-variant max-w-2xl leading-relaxed">
            Tactics, teardowns, and data from operators running millions of emails.
          </p>
        </div>
      </section>

      {/* Featured Article */}
      {featured && (
        <section className="mx-auto max-w-7xl px-6 mb-16">
          <Link
            href={`/blog/${featured.slug}`}
            className="group block rounded-2xl bg-surface-container-low p-8 lg:p-12 transition-all hover:bg-surface-container hover:shadow-[0_0_60px_-20px] hover:shadow-primary/20"
          >
            <div className="grid lg:grid-cols-2 gap-8 items-center">
              <div className="aspect-[16/10] rounded-xl bg-gradient-to-br from-primary/20 via-surface-variant to-secondary/10" />
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <span className="rounded-full bg-secondary/20 px-3 py-1 text-xs font-medium text-secondary">
                    Featured
                  </span>
                  {featured.tags && (featured.tags as string[])[0] && (
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
                      {(featured.tags as string[])[0]}
                    </span>
                  )}
                </div>
                <h2 className="text-3xl lg:text-4xl font-bold text-on-surface tracking-tight leading-tight group-hover:text-primary transition-colors">
                  {featured.title}
                </h2>
                {featured.metaDescription && (
                  <p className="mt-4 text-on-surface-variant leading-relaxed line-clamp-3">
                    {featured.metaDescription}
                  </p>
                )}
                <div className="mt-6 flex items-center gap-4 font-mono text-xs text-on-surface-variant">
                  {featured.author && <span>{featured.author}</span>}
                  {featured.publishedAt && (
                    <>
                      {featured.author && <span className="opacity-50" aria-hidden="true">•</span>}
                      <time>{new Date(featured.publishedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</time>
                    </>
                  )}
                  {(featured.author || featured.publishedAt) && (
                    <span className="opacity-50" aria-hidden="true">•</span>
                  )}
                  <span>{featured.readTimeMinutes} min read</span>
                </div>
              </div>
            </div>
          </Link>
        </section>
      )}

      {/* Interactive Category Filter + Article Grid */}
      {rest.length === 0 && !featured ? (
        <section className="mx-auto max-w-7xl px-6 mb-16">
          <div className="text-center py-16">
            <p className="text-on-surface-variant">No posts published yet. Check back soon!</p>
          </div>
        </section>
      ) : (
        <BlogCategoryFilter posts={rest} />
      )}

      {/* Subscribe Widget */}
      <section id="subscribe" className="mx-auto max-w-5xl px-6 mb-24">
        <NewsletterSubscribeCard variant="inline" />
      </section>

      {/* Footer */}
      <footer className="border-t border-outline-variant/15 mt-24">
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
