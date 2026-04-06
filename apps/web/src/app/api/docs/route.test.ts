import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/docs", () => {
  it("returns the OpenAPI spec with CORS headers", async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(data.openapi).toBe("3.1.0");
    expect(data.info.title).toBe("OutreachOS API");
    expect(data.components.schemas.Campaign.properties.type.enum).toContain("ab_test");
    expect(data.paths["/campaigns"].get.summary).toBe("List campaigns");
    expect(data.paths["/linkedin"].post.summary).toBe("Generate LinkedIn copy");
    expect(data.tags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Campaigns" }),
        expect.objectContaining({ name: "Contacts" }),
        expect.objectContaining({ name: "Templates" }),
        expect.objectContaining({ name: "LinkedIn" }),
      ]),
    );
  });
});
