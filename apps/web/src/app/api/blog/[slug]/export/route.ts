import { NextRequest, NextResponse } from "next/server";
import { getAuthAccount } from "@/lib/auth/session";
import { BlogService } from "@outreachos/services";

type ExportFormat = "markdown" | "html" | "json";

/**
 * Sanitize a string for safe use in Content-Disposition filename.
 * - Allows only A-Za-z0-9._-
 * - Replaces everything else with hyphen
 * - Strips CR/LF to prevent header injection
 * - Limits to 255 chars
 * - Falls back to default if empty
 */
function sanitizeFilename(input: string, defaultName: string = "post"): string {
  // Remove CR/LF first to prevent header injection
  const noNewlines = input.replace(/[\r\n]/g, "");
  // Replace unsafe characters with hyphen
  const sanitized = noNewlines.replace(/[^A-Za-z0-9._-]/g, "-");
  // Limit length
  const truncated = sanitized.slice(0, 255);
  // Fallback if empty
  return truncated || defaultName;
}

function postToMarkdown(post: {
  title: string;
  slug: string;
  content: string;
  tags: string[] | null;
  author: string | null;
  metaDescription: string | null;
  publishedAt: Date | string | null;
}): string {
  const frontmatter = [
    "---",
    `title: ${JSON.stringify(post.title)}`,
    `slug: ${post.slug}`,
    post.author ? `author: ${JSON.stringify(post.author)}` : null,
    post.metaDescription ? `description: ${JSON.stringify(post.metaDescription)}` : null,
    post.tags && post.tags.length > 0
      ? `tags: [${post.tags.map((t) => JSON.stringify(t)).join(", ")}]`
      : null,
    post.publishedAt
      ? `publishedAt: ${new Date(post.publishedAt).toISOString()}`
      : null,
    "---",
    "",
  ]
    .filter(Boolean)
    .join("\n");

  return `${frontmatter}\n${post.content}\n`;
}

/**
 * Escape HTML special characters to prevent XSS in code blocks.
 * Preserves whitespace and newlines for proper code formatting.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function markdownToHtml(md: string): string {
  // Lightweight markdown → HTML conversion: headings, bold, italic, links, lists, code, paragraphs.
  const lines = md.split(/\r?\n/);
  const out: string[] = [];
  let inList = false;
  let inCode = false;

  /**
   * Validate URL scheme for safety. Returns true for http, https, mailto, tel.
   * Rejects javascript:, data:, vbscript:, file:, etc.
   */
  const isSafeUrl = (url: string): boolean => {
    try {
      const lower = url.toLowerCase().trim();
      // Allow relative URLs (start with / or ./ or ../)
      if (lower.startsWith("/") || lower.startsWith("./") || lower.startsWith("../")) {
        return true;
      }
      const parsed = new URL(url);
      const safeSchemes = ["http:", "https:", "mailto:", "tel:"];
      return safeSchemes.includes(parsed.protocol);
    } catch {
      // Invalid URL format - treat as unsafe
      return false;
    }
  };

  const inline = (text: string) => {
    // Step 1: Process markdown links FIRST on raw text (before HTML escaping)
    // This prevents URL corruption (e.g., & becoming &amp;)
    let processed = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, linkText, url) => {
      // Validate URL scheme on the original unescaped URL
      if (isSafeUrl(url)) {
        // Escape link text for HTML, encode URL for href attribute
        const safeLinkText = escapeHtml(linkText);
        const safeUrl = encodeURI(url).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
        return `<a href="${safeUrl}">${safeLinkText}</a>`;
      }
      // Unsafe scheme: escape and render as plain text (no link)
      return `[${escapeHtml(linkText)}](${escapeHtml(url)})`;
    });

    // Step 2: HTML-escape the remaining text to prevent XSS
    let escaped = escapeHtml(processed);

    // Step 3: Perform other formatting replacements on the escaped string
    // Note: Skip replacing content inside <a> tags (they're already processed)
    return escaped
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>");
  };

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
      out.push(escapeHtml(line));
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

function postToHtml(post: {
  title: string;
  content: string;
  author: string | null;
  metaDescription: string | null;
  publishedAt: Date | string | null;
}): string {
  const escaped = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escaped(post.title)}</title>
  ${post.metaDescription ? `<meta name="description" content="${escaped(post.metaDescription)}">` : ""}
</head>
<body>
  <article>
    <h1>${escaped(post.title)}</h1>
    ${post.author ? `<p><em>By ${escaped(post.author)}</em></p>` : ""}
    ${post.publishedAt ? `<p><time datetime="${new Date(post.publishedAt).toISOString()}">${new Date(post.publishedAt).toDateString()}</time></p>` : ""}
    ${markdownToHtml(post.content)}
  </article>
</body>
</html>
`;
}

/** Export a single blog post by ID in the requested format. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const account = await getAuthAccount();
    if (!account) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formatParam = request.nextUrl.searchParams.get("format") ?? "markdown";
    if (!["markdown", "html", "json"].includes(formatParam)) {
      return NextResponse.json(
        { error: "Invalid format. Use markdown, html, or json." },
        { status: 400 },
      );
    }
    const format = formatParam as ExportFormat;

    const { slug } = await params;
    const post = await BlogService.getById(account.id, slug);
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const fileBase = sanitizeFilename(post.slug || "post");

    if (format === "markdown") {
      return new NextResponse(postToMarkdown(post), {
        status: 200,
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": `attachment; filename="${fileBase}.md"`,
        },
      });
    }
    if (format === "html") {
      return new NextResponse(postToHtml(post), {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `attachment; filename="${fileBase}.html"`,
        },
      });
    }

    // json
    return new NextResponse(JSON.stringify(post, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileBase}.json"`,
      },
    });
  } catch (error) {
    console.error("Blog export error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
