/** SEO helpers shared by blog pages and tests */

const BLOG_SITE_NAME = "OutreachOS Blog";
const TITLE_MAX = 60;
const DESCRIPTION_MAX = 160;

export function buildBlogTitle(postTitle: string): string {
  const full = `${postTitle} | ${BLOG_SITE_NAME}`;
  if (full.length <= TITLE_MAX + 3) return full;
  return postTitle.slice(0, TITLE_MAX) + "... | " + BLOG_SITE_NAME;
}

export function buildBlogDescription(
  metaDescription: string | null | undefined,
  excerpt: string | null | undefined,
): string | undefined {
  const raw = metaDescription ?? excerpt ?? undefined;
  if (!raw) return undefined;
  return raw.length <= DESCRIPTION_MAX ? raw : raw.slice(0, DESCRIPTION_MAX);
}
