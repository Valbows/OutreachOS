import { describe, expect, it, vi } from "vitest";
import { JourneyService, JOURNEY_STATES, STEP_STATE_MAP, type CreateJourneyInput } from "./journey-service.js";

// Mock the database
vi.mock("@outreachos/db", () => ({
  db: {
    transaction: vi.fn((fn) => fn({
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: "journey-1" }]) }),
      }),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: "account-1" }]) }),
        }),
      }),
    })),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: "enrollment-1" }]) }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: "journey-1", type: "journey" }]),
          orderBy: vi.fn().mockResolvedValue([
            { id: "step-1", stepNumber: 1, name: "Initial", delayDays: 0 },
            { id: "step-2", stepNumber: 2, name: "1st Follow Up", delayDays: 3 },
          ]),
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
  journeyEnrollments: { campaignId: vi.fn(), contactId: vi.fn() },
  contacts: { id: vi.fn(), accountId: vi.fn() },
  templates: { id: vi.fn() },
  messageInstances: { id: vi.fn(), campaignId: vi.fn(), contactId: vi.fn() },
  eq: vi.fn((a, b) => ({ column: a, value: b })),
  and: vi.fn((...conds) => ({ op: "AND", conds })),
  asc: vi.fn((col) => ({ column: col, direction: "ASC" })),
  desc: vi.fn((col) => ({ column: col, direction: "DESC" })),
  lte: vi.fn((a, b) => ({ column: a, value: b, op: "<=" })),
  isNull: vi.fn((col) => ({ column: col, op: "IS NULL" })),
  count: vi.fn(() => ({ fn: "COUNT" })),
  sql: vi.fn((str) => ({ raw: str })),
  inArray: vi.fn((col, vals) => ({ column: col, values: vals })),
}));

describe("JourneyService", () => {
  describe("class structure", () => {
    it("exports JourneyService with expected methods", () => {
      expect(JourneyService).toBeDefined();
      expect(typeof JourneyService.create).toBe("function");
      expect(typeof JourneyService.getById).toBe("function");
      expect(typeof JourneyService.list).toBe("function");
      expect(typeof JourneyService.updateStep).toBe("function");
      expect(typeof JourneyService.delete).toBe("function");
      expect(typeof JourneyService.enrollGroup).toBe("function");
      expect(typeof JourneyService.getProgress).toBe("function");
      expect(typeof JourneyService.processDueSends).toBe("function");
    });
  });

  describe("state machine constants", () => {
    it("has correct journey states in order", () => {
      expect(JOURNEY_STATES).toEqual([
        "enrolled",
        "initial_sent",
        "first_followup_sent",
        "second_followup_sent",
        "hail_mary_sent",
        "completed",
      ]);
    });

    it("maps step names to correct states", () => {
      expect(STEP_STATE_MAP).toMatchObject({
        "Initial": "initial_sent",
        "1st Follow Up": "first_followup_sent",
        "2nd Follow Up": "second_followup_sent",
        "Hail Mary": "hail_mary_sent",
      });
    });
  });

  describe("default steps configuration", () => {
    it("inserts 4 default steps with correct delays when no steps are provided", async () => {
      const stepsInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });
      const campaignInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "journey-1" }]),
        }),
      });

      const tx = {
        insert: vi.fn()
          .mockReturnValueOnce(campaignInsert()) // campaigns insert
          .mockReturnValueOnce(stepsInsert()),    // campaignSteps insert
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: "account-1" }]),
            }),
          }),
        }),
      };

      const { db } = await import("@outreachos/db");
      vi.mocked(db.transaction).mockImplementationOnce(
        ((fn: (tx: unknown) => unknown) => fn(tx)) as never,
      );

      await JourneyService.create({ accountId: "account-1", name: "Test Journey" });

      // Inspect what values() was called with on the campaignSteps insert chain
      const stepsChain = stepsInsert.mock.results[0].value as {
        values: ReturnType<typeof vi.fn>;
      };
      const insertedSteps = stepsChain.values.mock.calls[0][0] as Array<{
        stepNumber: number;
        name: string;
        delayDays: number;
      }>;

      expect(insertedSteps).toHaveLength(4);
      expect(insertedSteps[0]).toMatchObject({ stepNumber: 1, name: "Initial", delayDays: 0 });
      expect(insertedSteps[1]).toMatchObject({ stepNumber: 2, name: "1st Follow Up", delayDays: 3 });
      expect(insertedSteps[2]).toMatchObject({ stepNumber: 3, name: "2nd Follow Up", delayDays: 5 });
      expect(insertedSteps[3]).toMatchObject({ stepNumber: 4, name: "Hail Mary", delayDays: 7 });
    });
  });

  describe("input validation", () => {
    it("accepts valid CreateJourneyInput", async () => {
      const validInput: CreateJourneyInput = {
        accountId: "account-1",
        name: "Test Journey",
        groupId: "group-1",
        steps: [
          { name: "Initial", templateId: "tpl-1", delayDays: 0 },
          { name: "Follow Up", templateId: "tpl-2", delayDays: 3, delayHour: 10 },
        ],
        removeOnReply: true,
        removeOnUnsubscribe: true,
      };

      await expect(JourneyService.create(validInput)).resolves.toBeDefined();
    });

    it("rejects invalid CreateJourneyInput when required fields are empty", async () => {
      const invalidInput: CreateJourneyInput = {
        accountId: "",
        name: "",
        groupId: "group-1",
        steps: [
          { name: "Initial", templateId: "tpl-1", delayDays: 0 },
        ],
        removeOnReply: true,
        removeOnUnsubscribe: true,
      };

      await expect(JourneyService.create(invalidInput)).rejects.toThrow();
    });
  });

  describe("enrollment options", () => {
    it("forwards removeOnReply and removeOnUnsubscribe to the enrollment record", async () => {
      const { db } = await import("@outreachos/db");

      // Make db.select return a steps list so enrollGroup doesn't throw
      const valuesMock = vi.fn().mockResolvedValue(undefined);
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([
              { id: "step-1", stepNumber: 1, name: "Initial", delayDays: 0, delayHour: null },
            ]),
          }),
        }),
      } as never);

      // Capture the values() call on db.insert(journeyEnrollments)
      vi.mocked(db.insert).mockReturnValueOnce({
        values: valuesMock,
      } as never);

      await JourneyService.enrollGroup(
        "journey-1",
        [{ id: "contact-1" }],
        { removeOnReply: true, removeOnUnsubscribe: false },
      );

      expect(valuesMock).toHaveBeenCalledOnce();
      expect(valuesMock).toHaveBeenCalledWith(
        expect.objectContaining({
          removeOnReply: true,
          removeOnUnsubscribe: false,
          campaignId: "journey-1",
          contactId: "contact-1",
        }),
      );
    });
  });

  describe("addStep validation", () => {
    it("rejects empty name", async () => {
      await expect(
        JourneyService.addStep("account-1", "journey-1", {
          name: "",
          delayDays: 3,
        }),
      ).rejects.toThrow("Invalid journey input");
    });

    it("rejects whitespace-only name", async () => {
      await expect(
        JourneyService.addStep("account-1", "journey-1", {
          name: "   ",
          delayDays: 3,
        }),
      ).rejects.toThrow("Invalid journey input");
    });

    it("rejects negative delayDays", async () => {
      await expect(
        JourneyService.addStep("account-1", "journey-1", {
          name: "Follow Up",
          delayDays: -1,
        }),
      ).rejects.toThrow("Invalid journey input");
    });

    it("accepts valid input", async () => {
      const { db } = await import("@outreachos/db");

      // Mock journey ownership check (outside transaction)
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: "journey-1" }]),
          }),
        }),
      } as never);

      // Mock transaction for atomic max step + insert
      const returningMock = vi.fn().mockResolvedValue([{ id: "step-3", name: "New Step" }]);
      const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
      const insertMock = vi.fn().mockReturnValue({ values: valuesMock });

      const tx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ maxNumber: 2 }]),
          }),
        }),
        insert: insertMock,
      };

      vi.mocked(db.transaction).mockImplementationOnce(
        ((fn: (tx: unknown) => unknown) => fn(tx)) as never,
      );

      const result = await JourneyService.addStep("account-1", "journey-1", {
        name: "New Step",
        delayDays: 5,
        templateId: "tpl-1",
      });

      expect(result).toBeDefined();
      expect(result.name).toBe("New Step");
      // Verify insert was called with correct stepNumber (max 2 + 1 = 3)
      expect(valuesMock).toHaveBeenCalledWith(expect.objectContaining({ stepNumber: 3 }));
    });
  });

  describe("deleteStep enrollment handling", () => {
    it("reassigns enrollments to next step when deleting a step", async () => {
      const { db } = await import("@outreachos/db");
      const whereMock = vi.fn().mockResolvedValue(undefined);
      const setMock = vi.fn().mockReturnValue({ where: whereMock });
      const updateMock = vi.fn().mockReturnValue({ set: setMock });
      const deleteWhereMock = vi.fn().mockResolvedValue(undefined);
      const deleteMock = vi.fn().mockReturnValue({ where: deleteWhereMock });

      // Mock step ownership verification (step exists) - includes campaigns.type filter
      const andMock = vi.fn().mockReturnValue({ op: "AND", conds: [] });
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockImplementation((...args) => {
              // Capture the and() call with all filters including campaigns.type
              andMock(...args);
              return { limit: vi.fn().mockResolvedValue([{ id: "step-2", stepNumber: 2 }]) };
            }),
          }),
        }),
      } as never);

      const tx = {
        select: vi.fn()
          // Mock next step query
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([{ id: "step-3", stepNumber: 3 }]),
                }),
              }),
            }),
          })
          // Mock enrollments at step query
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ id: "enrollment-1", status: "enrolled" }]),
            }),
          })
          // Mock remaining steps for renumbering
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue([
                  { id: "step-1", stepNumber: 1 },
                  { id: "step-3", stepNumber: 3 },
                ]),
              }),
            }),
          }),
        update: updateMock,
        delete: deleteMock,
      };

      vi.mocked(db.transaction).mockImplementationOnce(
        ((fn: (tx: unknown) => unknown) => fn(tx)) as never,
      );

      const result = await JourneyService.deleteStep("account-1", "journey-1", "step-2");

      expect(result.deleted).toBe(true);
      expect(result.reassignedCount).toBe(1);
      // Verify enrollment was updated to next step
      expect(setMock).toHaveBeenCalledWith(expect.objectContaining({ currentStepId: "step-3" }));
    });

    it("marks enrollments as completed when deleting the last step", async () => {
      const { db } = await import("@outreachos/db");
      const whereMock = vi.fn().mockResolvedValue(undefined);
      const setMock = vi.fn().mockReturnValue({ where: whereMock });
      const updateMock = vi.fn().mockReturnValue({ set: setMock });
      const deleteWhereMock = vi.fn().mockResolvedValue(undefined);
      const deleteMock = vi.fn().mockReturnValue({ where: deleteWhereMock });

      // Mock step ownership verification - includes campaigns.type filter
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockImplementation(() => {
              return { limit: vi.fn().mockResolvedValue([{ id: "step-4", stepNumber: 4 }]) };
            }),
          }),
        }),
      } as never);

      const tx = {
        select: vi.fn()
          // Mock next step query (no next step - this is the last one)
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([]),
                }),
              }),
            }),
          })
          // Mock enrollments at step query
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ id: "enrollment-2", status: "enrolled" }]),
            }),
          })
          // Mock remaining steps for renumbering
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue([
                  { id: "step-1", stepNumber: 1 },
                  { id: "step-2", stepNumber: 2 },
                  { id: "step-3", stepNumber: 3 },
                ]),
              }),
            }),
          }),
        update: updateMock,
        delete: deleteMock,
      };

      vi.mocked(db.transaction).mockImplementationOnce(
        ((fn: (tx: unknown) => unknown) => fn(tx)) as never,
      );

      const result = await JourneyService.deleteStep("account-1", "journey-1", "step-4");

      expect(result.deleted).toBe(true);
      expect(result.reassignedCount).toBe(1);
      // Verify enrollment was marked completed
      expect(setMock).toHaveBeenCalledWith(expect.objectContaining({ status: "completed" }));
    });
  });
});
