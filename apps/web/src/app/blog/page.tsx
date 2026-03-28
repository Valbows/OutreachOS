import Link from "next/link";
import { BlogService } from "@outreachos/services";

export const revalidate = 60; // ISR: revalidate every 60 seconds

export default async function BlogListPage() {
  const posts = await BlogService.listPublished(20, 0);

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-outline-variant bg-surface-container-low">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <Link href="/" className="text-sm text-on-surface-variant hover:text-primary transition-colors">
            ← Back to OutreachOS
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-on-surface mt-2">Blog</h1>
          <p className="text-sm text-on-surface-variant mt-1">Tips, guides, and updates on email outreach.</p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        {posts.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-on-surface-variant">No posts published yet. Check back soon!</p>
          </div>
        ) : (
          <div className="space-y-8">
            {posts.map((post) => (
              <article key={post.id} className="group">
                <Link href={`/blog/${post.slug}`} className="block">
                  <h2 className="text-xl font-semibold text-on-surface group-hover:text-primary transition-colors">
                    {post.title}
                  </h2>
                  {post.metaDescription && (
                    <p className="mt-1 text-sm text-on-surface-variant line-clamp-2">
                      {post.metaDescription}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-3 text-xs text-on-surface-variant">
                    {post.author && <span>{post.author}</span>}
                    {post.publishedAt && (
                      <time dateTime={new Date(post.publishedAt).toISOString()}>
                        {new Date(post.publishedAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </time>
                    )}
                    {post.tags && post.tags.length > 0 && (
                      <div className="flex gap-1">
                        {(post.tags as string[]).map((tag) => (
                          <span key={tag} className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </Link>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
