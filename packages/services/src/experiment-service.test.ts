import { describe, expect, it } from "vitest";
import { ExperimentService, computeOpenRate } from "./experiment-service.js";

describe("ExperimentService", () => {
  describe("class structure", () => {
    it("exports ExperimentService with expected methods", () => {
      expect(ExperimentService).toBeDefined();
      expect(typeof ExperimentService.list).toBe("function");
      expect(typeof ExperimentService.getById).toBe("function");
      expect(typeof ExperimentService.create).toBe("function");
      expect(typeof ExperimentService.delete).toBe("function");
      expect(typeof ExperimentService.createBatch).toBe("function");
      expect(typeof ExperimentService.getBatches).toBe("function");
      expect(typeof ExperimentService.evaluateBatch).toBe("function");
      expect(typeof ExperimentService.checkForChampion).toBe("function");
      expect(typeof ExperimentService.promoteChampion).toBe("function");
      expect(typeof ExperimentService.getSummary).toBe("function");
    });

    it("exports computeOpenRate helper for testing", () => {
      expect(typeof computeOpenRate).toBe("function");
    });
  });

  describe("computeOpenRate", () => {
    it("computes open rate correctly with mixed statuses", () => {
      expect(computeOpenRate([])).toBe(0);
      expect(
        computeOpenRate([
          { openCount: 1, status: "opened" },
          { openCount: 0, status: "sent" },
        ]),
      ).toBe(0.5);
      expect(
        computeOpenRate([
          { openCount: 3, status: "opened" },
          { openCount: 1, status: "clicked" },
          { openCount: 0, status: "delivered" },
        ]),
      ).toBeCloseTo(0.667, 2);
    });

    it("counts clicked as opened", () => {
      expect(
        computeOpenRate([
          { openCount: 0, status: "clicked" },
          { openCount: 0, status: "sent" },
        ]),
      ).toBe(0.5);
    });

    it("handles null openCount", () => {
      expect(
        computeOpenRate([
          { openCount: null, status: "opened" },
          { openCount: null, status: "sent" },
        ]),
      ).toBe(0.5);
    });
  });
});
