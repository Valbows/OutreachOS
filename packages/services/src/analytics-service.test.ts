import { describe, expect, it } from "vitest";
import { AnalyticsService } from "./analytics-service.js";

describe("AnalyticsService", () => {
  describe("class structure", () => {
    it("exports AnalyticsService with expected methods", () => {
      expect(AnalyticsService).toBeDefined();
      expect(typeof AnalyticsService.getCampaignMetrics).toBe("function");
      expect(typeof AnalyticsService.getHourlyMetrics).toBe("function");
      expect(typeof AnalyticsService.getDailyMetrics).toBe("function");
    });
  });
});
