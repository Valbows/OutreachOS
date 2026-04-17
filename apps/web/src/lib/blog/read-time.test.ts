import { describe, it, expect } from "vitest";
import { calculateReadTime } from "./read-time";

describe("calculateReadTime", () => {
  it("returns 1 minute for empty or null content", () => {
    expect(calculateReadTime(null)).toBe(1);
    expect(calculateReadTime(undefined)).toBe(1);
    expect(calculateReadTime("")).toBe(1);
    expect(calculateReadTime("   ")).toBe(1);
  });

  it("returns 1 minute for very short content", () => {
    expect(calculateReadTime("Hello world")).toBe(1);
    expect(calculateReadTime("This is a short post.")).toBe(1);
  });

  it("calculates based on 200 words per minute", () => {
    // 200 words -> 1 minute
    const shortText = Array(200).fill("word").join(" ");
    expect(calculateReadTime(shortText)).toBe(1);

    // 400 words -> 2 minutes
    const mediumText = Array(400).fill("word").join(" ");
    expect(calculateReadTime(mediumText)).toBe(2);

    // 1600 words -> 8 minutes
    const longText = Array(1600).fill("word").join(" ");
    expect(calculateReadTime(longText)).toBe(8);
  });

  it("strips HTML tags before counting words", () => {
    const html = `<p>${Array(400).fill("word").join(" ")}</p><div>extra</div>`;
    // 400 words + 1 "extra" = ~401 words -> 2 minutes
    expect(calculateReadTime(html)).toBe(2);
  });

  it("strips markdown syntax before counting words", () => {
    const markdown = `# Heading\n\n**bold** _italic_ and \`code\` ${Array(198).fill("word").join(" ")}`;
    // "Heading bold italic and code" (5) + 198 = 203 words -> ~1 min
    expect(calculateReadTime(markdown)).toBe(1);
  });

  it("handles mixed whitespace correctly", () => {
    const text = "word1\n\nword2\t\tword3   word4";
    // 4 words -> 1 minute (minimum)
    expect(calculateReadTime(text)).toBe(1);
  });
});
