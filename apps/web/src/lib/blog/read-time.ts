/**
 * Calculate read time from content (in minutes).
 * Strips HTML/markdown and counts words at 200 WPM.
 */
export function calculateReadTime(content: string | null | undefined): number {
  if (!content) return 1;

  // Strip HTML tags and markdown syntax, normalize whitespace
  const plainText = content
    .replace(/<[^>]+>/g, " ") // HTML tags
    .replace(/[#*_`~>\[\]\(\)!]/g, " ") // Markdown syntax
    .replace(/\s+/g, " ")
    .trim();

  if (!plainText) return 1;

  const words = plainText.split(/\s+/).length;
  const minutes = Math.max(1, Math.round(words / 200));
  return minutes;
}
