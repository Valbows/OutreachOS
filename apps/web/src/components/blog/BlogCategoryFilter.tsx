"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  metaDescription?: string | null;
  author?: string | null;
  tags?: unknown;
  readTimeMinutes?: number;
}

interface BlogCategoryFilterProps {
  posts: BlogPost[];
  categories?: string[];
}

const DEFAULT_CATEGORIES = ["All", "Strategy", "AI & Automation", "Deliverability", "Case Studies"];

export function BlogCategoryFilter({ posts, categories = DEFAULT_CATEGORIES }: BlogCategoryFilterProps) {
  // Default to first category passed in (or "All" if the array is empty)
  const [selectedCategory, setSelectedCategory] = useState<string>(
    () => categories[0] ?? "All",
  );

  // If the categories prop changes and the current selection is no longer in
  // the list, reset to the first available category (or "All" if empty).
  useEffect(() => {
    if (categories.length === 0) {
      setSelectedCategory("All");
    } else if (!categories.includes(selectedCategory)) {
      setSelectedCategory(categories[0]);
    }
  }, [categories, selectedCategory]);

  const filteredPosts = useMemo(() => {
    // Treat the first entry in the categories list as the "show all" value,
    // so a custom categories prop works consistently.
    if (selectedCategory === "All" || selectedCategory === categories[0]) {
      return posts;
    }
    const needle = selectedCategory.toLowerCase();
    return posts.filter((p) => {
      const tags = Array.isArray(p.tags) ? (p.tags as string[]) : [];
      return tags.some((t) => typeof t === "string" && t.toLowerCase() === needle);
    });
  }, [posts, selectedCategory, categories]);

  return (
    <>
      {/* Category Pills */}
      <section className="mx-auto max-w-7xl px-6 mb-12">
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              aria-pressed={selectedCategory === cat}
              className={`rounded-full px-4 py-1.5 text-sm transition-all ${
                selectedCategory === cat
                  ? "bg-secondary/20 text-secondary font-medium"
                  : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      {/* Article Grid */}
      <section className="mx-auto max-w-7xl px-6 mb-16">
        {filteredPosts.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-on-surface-variant">
              No posts in <span className="text-primary font-medium">{selectedCategory}</span> yet.
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPosts.map((post) => (
              <Link
                key={post.id}
                href={`/blog/${post.slug}`}
                className="group rounded-2xl bg-surface-container-low p-6 transition-all hover:bg-surface-container"
              >
                <div className="aspect-[16/10] rounded-lg bg-gradient-to-br from-surface-variant via-primary/5 to-secondary/5 mb-5" />
                {(() => {
                  const firstTag = Array.isArray(post.tags) ? (post.tags as string[])[0] : null;
                  return firstTag ? (
                    <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-xs text-primary mb-3">
                      {firstTag}
                    </span>
                  ) : null;
                })()}
                <h3 className="text-xl font-semibold text-on-surface tracking-tight leading-snug group-hover:text-primary transition-colors line-clamp-2">
                  {post.title}
                </h3>
                {post.metaDescription && (
                  <p className="mt-3 text-sm text-on-surface-variant line-clamp-2 leading-relaxed">
                    {post.metaDescription}
                  </p>
                )}
                <div className="mt-5 flex items-center gap-3 font-mono text-xs text-on-surface-variant">
                  {post.author && (
                    <>
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-gradient-to-br from-primary to-secondary text-[10px] font-bold text-on-surface flex items-center justify-center">
                          {post.author.slice(0, 2).toUpperCase()}
                        </div>
                        <span>{post.author}</span>
                      </div>
                      <span className="opacity-50" aria-hidden="true">•</span>
                    </>
                  )}
                  <span>{post.readTimeMinutes ?? 1} min</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
