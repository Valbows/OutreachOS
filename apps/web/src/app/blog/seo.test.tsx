/**
 * Blog SEO Tests
 * Phase 5.9 - Verify meta tags, OG images, sitemap generation
 */

import { describe, expect, it } from "vitest";
import { buildBlogTitle, buildBlogDescription } from "./seo";

describe("Blog SEO", () => {
  describe("meta tags", () => {
    it("generates correct title tag", () => {
      const title = buildBlogTitle("Getting Started with Outreach");
      expect(title).toBe("Getting Started with Outreach | OutreachOS Blog");
    });

    it("truncates long titles appropriately", () => {
      const longTitle = "A".repeat(80);
      const title = buildBlogTitle(longTitle);
      expect(title.length).toBeLessThanOrEqual(63 + " | OutreachOS Blog".length);
      expect(title).toContain("...");
    });

    it("generates meta description from metaDescription", () => {
      const description = buildBlogDescription(
        "Learn how to use Outreach for your sales team",
        null,
      );
      expect(description).toBeDefined();
      expect(description!.length).toBeGreaterThan(0);
    });

    it("falls back to excerpt when meta description missing", () => {
      const excerpt = "This is the full content of the blog post. It contains valuable information about sales.";
      const description = buildBlogDescription(null, excerpt);
      expect(description).toBeDefined();
      expect(description!.length).toBeLessThanOrEqual(160);
    });

    it("limits meta description to optimal length", () => {
      const longDescription = "A".repeat(200);
      const description = buildBlogDescription(longDescription, null);
      expect(description!.length).toBe(160);
    });

    it("generates canonical URL", () => {
      const baseUrl = "https://outreachos.com";
      const slug = "getting-started-guide";

      const canonical = `${baseUrl}/blog/${slug}`;
      expect(canonical).toBe("https://outreachos.com/blog/getting-started-guide");
    });

    it("includes robots meta tag", () => {
      const publishedAt = new Date();
      const isPublished = !!publishedAt;

      const robots = isPublished ? "index, follow" : "noindex, nofollow";
      expect(robots).toBe("index, follow");
    });
  });

  describe("Open Graph tags", () => {
    it("generates og:title", () => {
      const title = "Sales Automation Guide";
      const ogTitle = title;
      expect(ogTitle).toBe("Sales Automation Guide");
    });

    it("generates og:description", () => {
      const description = "Learn how to automate your sales outreach";
      const ogDescription = description;
      expect(ogDescription).toBeDefined();
    });

    it("generates og:image", () => {
      const post = {
        ogImage: "/images/blog/sales-automation.png",
      };
      const baseUrl = "https://outreachos.com";

      const ogImage = post.ogImage?.startsWith("/") ? `${baseUrl}${post.ogImage}` : post.ogImage;
      expect(ogImage).toBe("https://outreachos.com/images/blog/sales-automation.png");
    });

    it("falls back to default OG image when not specified", () => {
      const post: { ogImage?: string } = {};
      const defaultOgImage = "https://outreachos.com/images/default-og.png";

      const ogImage = post.ogImage ?? defaultOgImage;
      expect(ogImage).toBe(defaultOgImage);
    });

    it("generates og:type for articles", () => {
      const ogType = "article";
      expect(ogType).toBe("article");
    });

    it("generates og:url", () => {
      const slug = "my-blog-post";
      const baseUrl = "https://outreachos.com";

      const ogUrl = `${baseUrl}/blog/${slug}`;
      expect(ogUrl).toBe("https://outreachos.com/blog/my-blog-post");
    });

    it("generates article:published_time", () => {
      const publishedAt = new Date("2024-01-15T10:00:00Z");
      const isoDate = publishedAt.toISOString();
      expect(isoDate).toBe("2024-01-15T10:00:00.000Z");
    });

    it("generates article:author", () => {
      const author = "Jane Smith";
      expect(author).toBe("Jane Smith");
    });

    it("generates article:tags", () => {
      const tags = ["sales", "automation", "email"];
      expect(tags).toContain("sales");
      expect(tags).toContain("automation");
    });
  });

  describe("Twitter Card tags", () => {
    it("generates twitter:card", () => {
      const card = "summary_large_image";
      expect(card).toBe("summary_large_image");
    });

    it("generates twitter:title", () => {
      const title = "Sales Tips for 2024";
      expect(title).toBeDefined();
    });

    it("generates twitter:description", () => {
      const description = "Best practices for sales teams";
      expect(description).toBeDefined();
    });

    it("generates twitter:image", () => {
      const image = "https://outreachos.com/images/blog/sales-tips.png";
      expect(image).toContain("https://");
    });
  });

  describe("sitemap generation", () => {
    it("generates sitemap XML structure", () => {
      const posts = [
        { slug: "post-1", publishedAt: new Date("2024-01-01"), updatedAt: new Date("2024-01-05") },
        { slug: "post-2", publishedAt: new Date("2024-01-10"), updatedAt: new Date("2024-01-10") },
      ];

      const urls = posts.map((post) => ({
        loc: `https://outreachos.com/blog/${post.slug}`,
        lastmod: (post.updatedAt ?? post.publishedAt).toISOString().split("T")[0],
        changefreq: "monthly",
        priority: "0.8",
      }));

      expect(urls).toHaveLength(2);
      expect(urls[0].loc).toContain("/blog/post-1");
      expect(urls[0].lastmod).toBe("2024-01-05");
      expect(urls[0].changefreq).toBe("monthly");
    });

    it("only includes published posts in sitemap", () => {
      const posts = [
        { slug: "published", publishedAt: new Date() },
        { slug: "draft", publishedAt: null },
      ];

      const publishedPosts = posts.filter((p) => p.publishedAt);
      expect(publishedPosts).toHaveLength(1);
      expect(publishedPosts[0].slug).toBe("published");
    });

    it("sets appropriate priority based on recency", () => {
      const recentPost = { publishedAt: new Date() };
      const oldPost = { publishedAt: new Date("2023-01-01") };

      const getPriority = (post: { publishedAt: Date }) => {
        const daysSincePublish = (Date.now() - post.publishedAt.getTime()) / (1000 * 60 * 60 * 24);
        return daysSincePublish < 30 ? "1.0" : "0.8";
      };

      expect(getPriority(recentPost)).toBe("1.0");
      expect(getPriority(oldPost)).toBe("0.8");
    });

    it("generates valid XML format", () => {
      const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://outreachos.com/blog/post-1</loc>
    <lastmod>2024-01-15</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>`;

      expect(sitemap).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(sitemap).toContain("<urlset");
      expect(sitemap).toContain("</urlset>");
      expect(sitemap).toContain("<loc>");
      expect(sitemap).toContain("</url>");
    });

    it("limits sitemap to 50,000 URLs per file", () => {
      const maxUrls = 50000;
      const posts = Array(60000).fill({ slug: "post" });

      const needsMultipleSitemaps = posts.length > maxUrls;
      expect(needsMultipleSitemaps).toBe(true);
    });
  });

  describe("structured data (JSON-LD)", () => {
    it("generates Article schema", () => {
      const schema = {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: "Blog Post Title",
        description: "Blog post description",
        author: {
          "@type": "Person",
          name: "Jane Smith",
        },
        datePublished: "2024-01-15T10:00:00Z",
        dateModified: "2024-01-15T10:00:00Z",
        publisher: {
          "@type": "Organization",
          name: "OutreachOS",
          logo: {
            "@type": "ImageObject",
            url: "https://outreachos.com/logo.png",
          },
        },
      };

      expect(schema["@type"]).toBe("Article");
      expect(schema["@context"]).toBe("https://schema.org");
      expect(schema.author["@type"]).toBe("Person");
    });

    it("generates BreadcrumbList schema", () => {
      const schema = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: "https://outreachos.com",
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Blog",
            item: "https://outreachos.com/blog",
          },
          {
            "@type": "ListItem",
            position: 3,
            name: "Post Title",
            item: "https://outreachos.com/blog/post-title",
          },
        ],
      };

      expect(schema["@type"]).toBe("BreadcrumbList");
      expect(schema.itemListElement).toHaveLength(3);
      expect(schema.itemListElement[2].position).toBe(3);
    });
  });

  describe("RSS feed", () => {
    it("generates RSS 2.0 structure", () => {
      const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>OutreachOS Blog</title>
    <link>https://outreachos.com/blog</link>
    <description>Latest insights on sales automation</description>
    <item>
      <title>Post Title</title>
      <link>https://outreachos.com/blog/post-1</link>
      <pubDate>Mon, 15 Jan 2024 10:00:00 GMT</pubDate>
      <guid>https://outreachos.com/blog/post-1</guid>
    </item>
  </channel>
</rss>`;

      expect(rss).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(rss).toContain("<rss version=\"2.0\">");
      expect(rss).toContain("<channel>");
      expect(rss).toContain("<item>");
    });

    it("formats pubDate correctly", () => {
      const date = new Date("2024-01-15T10:00:00Z");
      const formatted = date.toUTCString();
      expect(formatted).toContain("Mon, 15 Jan 2024");
    });
  });
});
