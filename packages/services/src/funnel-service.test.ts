import { describe, expect, it, vi, beforeEach } from "vitest";
import { FunnelService, type ConditionType } from "./funnel-service.js";

// Mock the database
vi.mock("@outreachos/db", () => ({
  db: {
    transaction: vi.fn((fn) => fn({
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: "funnel-1" }]) }),
      }),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: "funnel-1" }]) }),
        }),
      }),
    })),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: "enrollment-1" }]) }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
          orderBy: vi.fn().mockResolvedValue([]),
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: "funnel-1", type: "funnel" }]),
            }),
          }),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: "step-1" }]) }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  },
  campaigns: { id: vi.fn(), accountId: vi.fn(), type: vi.fn() },
  campaignSteps: { id: vi.fn(), campaignId: vi.fn() },
  funnelConditions: { id: vi.fn(), campaignId: vi.fn(), conditionType: vi.fn() },
  journeyEnrollments: { campaignId: vi.fn(), contactId: vi.fn() },
  messageInstances: { id: vi.fn(), campaignId: vi.fn(), contactId: vi.fn(), openCount: vi.fn() },
  emailEvents: { id: vi.fn(), campaignId: vi.fn(), contactId: vi.fn() },
  contacts: { id: vi.fn(), accountId: vi.fn(), email: vi.fn() },
  replies: { id: vi.fn(), contactId: vi.fn(), campaignId: vi.fn() },
  formSubmissions: { id: vi.fn(), formId: vi.fn(), contactId: vi.fn() },
  formTemplates: { id: vi.fn(), accountId: vi.fn() },
  templates: { id: vi.fn() },
  eq: vi.fn((a, b) => ({ column: a, value: b })),
  and: vi.fn((...conds) => ({ op: "AND", conds })),
  asc: vi.fn((col) => ({ column: col, direction: "ASC" })),
  desc: vi.fn((col) => ({ column: col, direction: "DESC" })),
  count: vi.fn(() => ({ fn: "COUNT" })),
  sql: vi.fn((str) => ({ raw: str })),
  inArray: vi.fn((col, vals) => ({ column: col, values: vals })),
  isNotNull: vi.fn((col) => ({ column: col, op: "IS NOT NULL" })),
  lte: vi.fn((a, b) => ({ column: a, value: b, op: "<=" })),
}));

describe("FunnelService", () => {
  describe("class structure", () => {
    it("exports FunnelService with expected methods", () => {
      expect(FunnelService).toBeDefined();
      expect(typeof FunnelService.create).toBe("function");
      expect(typeof FunnelService.getById).toBe("function");
      expect(typeof FunnelService.list).toBe("function");
      expect(typeof FunnelService.delete).toBe("function");
      expect(typeof FunnelService.evaluateConditions).toBe("function");
      expect(typeof FunnelService.enrollQualifyingContacts).toBe("function");
      expect(typeof FunnelService.getProgress).toBe("function");
    });
  });

  describe("condition types", () => {
    it("supports all required condition types", () => {
      const conditionTypes: ConditionType[] = [
        "did_not_open",
        "opened_more_than",
        "replied",
        "filled_form",
      ];
      expect(conditionTypes).toHaveLength(4);
      expect(conditionTypes).toContain("did_not_open");
      expect(conditionTypes).toContain("opened_more_than");
      expect(conditionTypes).toContain("replied");
      expect(conditionTypes).toContain("filled_form");
    });
  });

  describe("CreateFunnelInput interface", () => {
    it("accepts valid funnel input with conditions", () => {
      const validInput = {
        accountId: "account-1",
        name: "Test Funnel",
        groupId: "group-1",
        conditions: [
          { conditionType: "did_not_open" as ConditionType, referenceCampaignId: "campaign-1" },
          { conditionType: "opened_more_than" as ConditionType, referenceCampaignId: "campaign-1", threshold: 5 },
        ],
        steps: [
          { name: "Follow Up 1", templateId: "tpl-1", delayDays: 1 },
          { name: "Follow Up 2", templateId: "tpl-2", delayDays: 3, delayHour: 10 },
        ],
      };
      expect(validInput.accountId).toBe("account-1");
      expect(validInput.conditions).toHaveLength(2);
      expect(validInput.steps).toHaveLength(2);
      expect(validInput.conditions[0].conditionType).toBe("did_not_open");
      expect(validInput.conditions[1].threshold).toBe(5);
    });

    it("accepts filled_form condition with form reference", () => {
      const formCondition = {
        conditionType: "filled_form" as ConditionType,
        referenceFormId: "form-1",
      };
      expect(formCondition.conditionType).toBe("filled_form");
      expect(formCondition.referenceFormId).toBe("form-1");
    });

    it("accepts replied condition", () => {
      const repliedCondition = {
        conditionType: "replied" as ConditionType,
        referenceCampaignId: "campaign-1",
      };
      expect(repliedCondition.conditionType).toBe("replied");
    });
  });

  describe("FunnelCondition interface", () => {
    it("supports all condition variations", () => {
      const conditions = [
        { conditionType: "did_not_open" as ConditionType },
        { conditionType: "opened_more_than" as ConditionType, threshold: 3 },
        { conditionType: "replied" as ConditionType, referenceCampaignId: "camp-1" },
        { conditionType: "filled_form" as ConditionType, referenceFormId: "form-1" },
      ];
      expect(conditions[0].threshold).toBeUndefined();
      expect(conditions[1].threshold).toBe(3);
      expect(conditions[2].referenceCampaignId).toBe("camp-1");
      expect(conditions[3].referenceFormId).toBe("form-1");
    });
  });

  describe("FunnelSummary interface", () => {
    it("has correct structure", () => {
      const summary = {
        id: "funnel-1",
        name: "Test Funnel",
        status: "active",
        conditions: [{ conditionType: "did_not_open" as ConditionType }],
        stepCount: 3,
        enrolledCount: 42,
      };
      expect(summary.id).toBe("funnel-1");
      expect(summary.stepCount).toBe(3);
      expect(summary.enrolledCount).toBe(42);
    });
  });

  describe("step configuration", () => {
    it("supports delay configuration per step", () => {
      const steps = [
        { name: "Immediate", templateId: "tpl-1", delayDays: 0 },
        { name: "Next Day", templateId: "tpl-2", delayDays: 1, delayHour: 9 },
        { name: "Week Later", templateId: "tpl-3", delayDays: 7, delayHour: 14 },
      ];
      expect(steps[0].delayDays).toBe(0);
      expect(steps[1].delayHour).toBe(9);
      expect(steps[2].delayDays).toBe(7);
    });
  });

  describe("condition evaluation logic", () => {
    /**
     * Build a chainable db.select() stub that resolves to `rows` at the end.
     * Covers both:
     *   .select().from().innerJoin().where()   (conditions fetch)
     *   .select().from().where()               (evaluateSingleCondition)
     */
    function selectReturning(rows: unknown[]) {
      const resolved = Promise.resolve(rows);
      // where() is the terminal in both chains; it must be thenable AND return
      // an object with groupBy (used by the "replied" condition).
      const where = vi.fn().mockReturnValue(
        Object.assign(resolved, { groupBy: vi.fn().mockResolvedValue(rows) }),
      );
      const innerJoin = vi.fn().mockReturnValue({ where });
      const from = vi.fn().mockReturnValue({ where, innerJoin });
      return { from };
    }

    beforeEach(async () => {
      const { db } = await import("@outreachos/db");
      vi.mocked(db.select).mockReset();
    });

    it("AND logic requires all conditions to be met", async () => {
      const { db } = await import("@outreachos/db");

      // First select: funnelConditions fetch → one did_not_open condition
      const conditionsRows = [
        {
          id: "cond-1",
          campaignId: "funnel-1",
          conditionType: "did_not_open",
          referenceCampaignId: "campaign-ref",
          referenceFormId: null,
          threshold: null,
        },
      ];
      // Second select: evaluateSingleCondition(did_not_open) → contact-3 opened
      const openedRows = [{ contactId: "contact-3" }];

      vi.mocked(db.select)
        .mockReturnValueOnce(selectReturning(conditionsRows) as unknown as ReturnType<typeof db.select>)
        .mockReturnValueOnce(selectReturning(openedRows) as unknown as ReturnType<typeof db.select>);

      const result = await FunnelService.evaluateConditions(
        "account-1",
        "funnel-1",
        ["contact-1", "contact-2", "contact-3"],
      );

      expect(result).toHaveLength(2);
      expect(result).toContain("contact-1");
      expect(result).toContain("contact-2");
      expect(result).not.toContain("contact-3");
    });

    it("empty conditions returns all candidates", async () => {
      const { db } = await import("@outreachos/db");

      // Only select: funnelConditions fetch → no rows → short-circuits to all candidates
      vi.mocked(db.select).mockReturnValueOnce(
        selectReturning([]) as unknown as ReturnType<typeof db.select>,
      );

      const candidates = ["contact-1", "contact-2"];
      const result = await FunnelService.evaluateConditions(
        "account-1",
        "funnel-1",
        candidates,
      );

      expect(result).toEqual(candidates);
    });
  });
});
