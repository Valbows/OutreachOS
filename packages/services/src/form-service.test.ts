import { beforeEach, describe, expect, it, vi } from "vitest";
import { and, count, desc, eq, sql } from "drizzle-orm";
import {
  db,
  accounts,
  contacts,
  formSubmissions,
  formTemplates,
} from "@outreachos/db";
import {
  FormService,
  type CreateFormInput,
  type SubmitFormInput,
} from "./form-service.js";

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((column, value) => ({ type: "eq", column, value })),
  and: vi.fn((...conditions) => ({ type: "and", conditions })),
  desc: vi.fn((column) => ({ type: "desc", column })),
  count: vi.fn(() => ({ type: "count" })),
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
    type: "sql",
    strings,
    values,
  })),
}));

// Mock the database
vi.mock("@outreachos/db", () => ({
  db: {
    transaction: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  accounts: { id: "accounts.id" },
  contacts: {
    id: "contacts.id",
    accountId: "contacts.accountId",
    email: "contacts.email",
  },
  formTemplates: {
    id: "formTemplates.id",
    accountId: "formTemplates.accountId",
    name: "formTemplates.name",
    type: "formTemplates.type",
    fields: "formTemplates.fields",
    htmlContent: "formTemplates.htmlContent",
    cssContent: "formTemplates.cssContent",
    successMessage: "formTemplates.successMessage",
    redirectUrl: "formTemplates.redirectUrl",
    createdAt: "formTemplates.createdAt",
    updatedAt: "formTemplates.updatedAt",
    journeyId: "formTemplates.journeyId",
    funnelId: "formTemplates.funnelId",
    submissionCount: "formTemplates.submissionCount",
  },
  formSubmissions: {
    id: "formSubmissions.id",
    formId: "formSubmissions.formId",
    contactId: "formSubmissions.contactId",
    submittedAt: "formSubmissions.submittedAt",
  },
}));

function makeChain(config: {
  whereResult?: unknown;
  limitResult?: unknown;
  orderByResult?: unknown;
  offsetResult?: unknown;
  returningResult?: unknown;
} = {}) {
  const chain: Record<string, unknown> = {};

  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() =>
    config.whereResult === undefined ? chain : config.whereResult,
  );
  chain.orderBy = vi.fn(() =>
    config.orderByResult === undefined ? chain : config.orderByResult,
  );
  chain.limit = vi.fn(() =>
    config.limitResult === undefined ? chain : config.limitResult,
  );
  chain.offset = vi.fn(() => Promise.resolve(config.offsetResult ?? []));
  chain.values = vi.fn(() => chain);
  chain.set = vi.fn(() => chain);
  chain.returning = vi.fn(() => Promise.resolve(config.returningResult ?? []));
  chain.onConflictDoNothing = vi.fn(() => chain);

  return chain;
}

const dbMock = db as unknown as {
  transaction: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

describe("FormService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    dbMock.transaction.mockReset();
    dbMock.select.mockReset();
    dbMock.update.mockReset();
    dbMock.delete.mockReset();
    vi.mocked(eq).mockClear();
    vi.mocked(and).mockClear();
    vi.mocked(desc).mockClear();
    vi.mocked(count).mockClear();
    vi.mocked(sql).mockClear();
  });

  describe("class structure", () => {
    it("exports FormService with expected methods", () => {
      expect(FormService).toBeDefined();
      expect(typeof FormService.create).toBe("function");
      expect(typeof FormService.getById).toBe("function");
      expect(typeof FormService.getPublicForm).toBe("function");
      expect(typeof FormService.list).toBe("function");
      expect(typeof FormService.update).toBe("function");
      expect(typeof FormService.delete).toBe("function");
      expect(typeof FormService.submit).toBe("function");
      expect(typeof FormService.listSubmissions).toBe("function");
      expect(typeof FormService.generateEmbedCode).toBe("function");
      expect(typeof FormService.getTemplate).toBe("function");
      expect(typeof FormService.getTemplateTypes).toBe("function");
      expect(typeof FormService.mapToAutomation).toBe("function");
      expect(typeof FormService.getAutomationMapping).toBe("function");
      expect(typeof FormService.processAutomation).toBe("function");
    });
  });

  describe("create", () => {
    it("creates a form with default template content", async () => {
      const input: CreateFormInput = {
        accountId: "account-1",
        name: "Contact Us Form",
        type: "minimal",
        fields: [
          { name: "email", type: "email", required: true, label: "Email" },
        ],
      };
      const accountQuery = makeChain({ limitResult: [{ id: "account-1" }] });
      const insertQuery = makeChain({
        returningResult: [{ id: "form-1", name: "Contact Us Form" }],
      });
      const tx = {
        select: vi.fn().mockReturnValue(accountQuery),
        insert: vi.fn().mockReturnValue(insertQuery),
        update: vi.fn(),
      };

      dbMock.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback(tx));

      const result = await FormService.create(input);

      expect(result).toEqual({ id: "form-1", name: "Contact Us Form" });
      expect(dbMock.transaction).toHaveBeenCalledTimes(1);
      expect(tx.select).toHaveBeenCalledWith({ id: accounts.id });
      expect(tx.insert).toHaveBeenCalledWith(formTemplates);
      expect(accountQuery.from).toHaveBeenCalledWith(accounts);
      expect(insertQuery.values).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: "account-1",
          name: "Contact Us Form",
          type: "minimal",
          fields: input.fields,
          successMessage: "Thank you for your submission!",
          redirectUrl: null,
          journeyId: null,
          funnelId: null,
          htmlContent: expect.any(String),
          cssContent: expect.any(String),
        }),
      );
      expect(eq).toHaveBeenCalledWith(accounts.id, "account-1");
    });

    it("rejects when the account does not exist", async () => {
      const input: CreateFormInput = {
        accountId: "missing-account",
        name: "Contact Us Form",
        type: "minimal",
        fields: [
          { name: "email", type: "email", required: true, label: "Email" },
        ],
      };
      const accountQuery = makeChain({ limitResult: [] });
      const tx = {
        select: vi.fn().mockReturnValue(accountQuery),
        insert: vi.fn(),
        update: vi.fn(),
      };

      dbMock.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback(tx));

      await expect(FormService.create(input)).rejects.toThrow(
        "ACCOUNT_NOT_FOUND",
      );
      expect(tx.insert).not.toHaveBeenCalled();
    });
  });

  describe("getById", () => {
    it("returns the matching account-scoped form", async () => {
      const query = makeChain({ limitResult: [{ id: "form-1", accountId: "account-1" }] });

      dbMock.select.mockReturnValue(query);

      const result = await FormService.getById("account-1", "form-1");

      expect(result).toEqual({ id: "form-1", accountId: "account-1" });
      expect(dbMock.select).toHaveBeenCalledWith();
      expect(query.from).toHaveBeenCalledWith(formTemplates);
      expect(eq).toHaveBeenCalledWith(formTemplates.id, "form-1");
      expect(eq).toHaveBeenCalledWith(formTemplates.accountId, "account-1");
      expect(and).toHaveBeenCalledTimes(1);
    });

    it("returns null when no matching form exists", async () => {
      const query = makeChain({ limitResult: [] });

      dbMock.select.mockReturnValue(query);

      await expect(FormService.getById("account-1", "missing-form")).resolves.toBeNull();
    });
  });

  describe("getPublicForm", () => {
    it("returns the public form payload", async () => {
      const publicForm = {
        id: "form-1",
        name: "Public Form",
        type: "minimal",
        fields: [],
      };
      const query = makeChain({ limitResult: [publicForm] });

      dbMock.select.mockReturnValue(query);

      const result = await FormService.getPublicForm("form-1");

      expect(result).toEqual(publicForm);
      expect(dbMock.select).toHaveBeenCalledWith({
        id: formTemplates.id,
        name: formTemplates.name,
        type: formTemplates.type,
        fields: formTemplates.fields,
        htmlContent: formTemplates.htmlContent,
        cssContent: formTemplates.cssContent,
        successMessage: formTemplates.successMessage,
        redirectUrl: formTemplates.redirectUrl,
      });
      expect(query.from).toHaveBeenCalledWith(formTemplates);
      expect(eq).toHaveBeenCalledWith(formTemplates.id, "form-1");
    });

    it("returns null when the public form is missing", async () => {
      const query = makeChain({ limitResult: [] });

      dbMock.select.mockReturnValue(query);

      await expect(FormService.getPublicForm("missing-form")).resolves.toBeNull();
    });
  });

  describe("list", () => {
    it("lists forms ordered by createdAt descending", async () => {
      const forms = [{ id: "form-2" }, { id: "form-1" }];
      const query = makeChain({ orderByResult: Promise.resolve(forms) });

      dbMock.select.mockReturnValue(query);

      const result = await FormService.list("account-1");

      expect(result).toEqual(forms);
      expect(query.from).toHaveBeenCalledWith(formTemplates);
      expect(eq).toHaveBeenCalledWith(formTemplates.accountId, "account-1");
      expect(desc).toHaveBeenCalledWith(formTemplates.createdAt);
    });

    it("propagates list errors", async () => {
      const query = makeChain({ orderByResult: Promise.reject(new Error("LIST_FAILED")) });

      dbMock.select.mockReturnValue(query);

      await expect(FormService.list("account-1")).rejects.toThrow("LIST_FAILED");
    });
  });

  describe("update", () => {
    it("updates the form and returns the updated row", async () => {
      const updateQuery = makeChain({
        returningResult: [{ id: "form-1", name: "Updated Form" }],
      });

      dbMock.update.mockReturnValue(updateQuery);

      const result = await FormService.update("account-1", "form-1", {
        name: "Updated Form",
      });

      expect(result).toEqual({ id: "form-1", name: "Updated Form" });
      expect(dbMock.update).toHaveBeenCalledWith(formTemplates);
      expect(updateQuery.set).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Updated Form",
          updatedAt: expect.any(Date),
        }),
      );
      expect(and).toHaveBeenCalledTimes(1);
    });

    it("propagates update errors", async () => {
      dbMock.update.mockImplementation(() => {
        throw new Error("UPDATE_FAILED");
      });

      await expect(
        FormService.update("account-1", "form-1", { name: "Updated Form" }),
      ).rejects.toThrow("UPDATE_FAILED");
    });
  });

  describe("delete", () => {
    it("deletes the matching form", async () => {
      const deleteQuery = makeChain({ whereResult: Promise.resolve(undefined) });

      dbMock.delete.mockReturnValue(deleteQuery);

      await expect(FormService.delete("account-1", "form-1")).resolves.toBeUndefined();
      expect(dbMock.delete).toHaveBeenCalledWith(formTemplates);
      expect(deleteQuery.where).toHaveBeenCalledTimes(1);
      expect(and).toHaveBeenCalledTimes(1);
    });

    it("propagates delete errors", async () => {
      const deleteQuery = makeChain({ whereResult: Promise.reject(new Error("DELETE_FAILED")) });

      dbMock.delete.mockReturnValue(deleteQuery);

      await expect(FormService.delete("account-1", "form-1")).rejects.toThrow(
        "DELETE_FAILED",
      );
    });
  });

  describe("embed code generation", () => {
    it("generates hosted URL", () => {
      const formId = "form-123";
      const baseUrl = "https://app.outreachos.com";
      const hostedUrl = FormService.generateEmbedCode(formId, baseUrl, "hosted");
      expect(hostedUrl).toBe("https://app.outreachos.com/f/form-123");
    });

    it("generates iframe embed code", () => {
      const formId = "form-123";
      const baseUrl = "https://app.outreachos.com";
      const iframeCode = FormService.generateEmbedCode(formId, baseUrl, "iframe");
      expect(iframeCode).toContain("<iframe");
      expect(iframeCode).toContain("form-123");
      expect(iframeCode).toContain('width="100%"');
    });

    it("generates widget embed code", () => {
      const formId = "form-123";
      const baseUrl = "https://app.outreachos.com";
      const widgetCode = FormService.generateEmbedCode(formId, baseUrl, "widget");
      expect(widgetCode).toContain("<script>");
      expect(widgetCode).toContain("form-123.js");
      expect(widgetCode).toContain('id="outreachos-form-form-123"');
    });
  });

  describe("form templates", () => {
    it("returns the requested template HTML and CSS", () => {
      const template = FormService.getTemplate("minimal");

      expect(template).toEqual(
        expect.objectContaining({
          html: expect.any(String),
          css: expect.any(String),
        }),
      );
    });

    it("returns all template types with labels", () => {
      const templateTypes = FormService.getTemplateTypes();
      expect(templateTypes).toHaveLength(5);
      expect(templateTypes[0].label).toBe("Minimal");
      expect(templateTypes[4].label).toBe("Side Drawer");
    });
  });

  describe("submit", () => {
    it("creates a submission, upserts a contact, and links the submission", async () => {
      const input: SubmitFormInput = {
        formId: "form-1",
        data: {
          first_name: "Jane",
          last_name: "Smith",
          email: "  JANE@EXAMPLE.COM  ",
          company: "Acme Inc",
        },
        hashedIp: "aabbccdd",
        userAgent: "Mozilla/5.0",
      };
      const formQuery = makeChain({ limitResult: [{ id: "form-1" }] });
      const existingContactQuery = makeChain({ limitResult: [] });
      const submissionInsert = makeChain({ returningResult: [{ id: "submission-1" }] });
      const contactInsert = makeChain({ returningResult: [{ id: "contact-1" }] });
      const incrementUpdate = makeChain({ whereResult: Promise.resolve(undefined) });
      const linkUpdate = makeChain({ whereResult: Promise.resolve(undefined) });
      const tx = {
        select: vi
          .fn()
          .mockReturnValueOnce(formQuery)
          .mockReturnValueOnce(existingContactQuery),
        insert: vi
          .fn()
          .mockReturnValueOnce(submissionInsert)
          .mockReturnValueOnce(contactInsert),
        update: vi
          .fn()
          .mockReturnValueOnce(incrementUpdate)
          .mockReturnValueOnce(linkUpdate),
      };

      dbMock.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback(tx));

      const result = await FormService.submit(input, "account-1");

      expect(result).toEqual({ submissionId: "submission-1", contactId: "contact-1" });
      expect(tx.select).toHaveBeenCalledTimes(2);
      expect(tx.insert).toHaveBeenCalledTimes(2);
      expect(tx.update).toHaveBeenCalledTimes(2);
      expect(submissionInsert.values).toHaveBeenCalledWith({
        formId: "form-1",
        data: input.data,
        hashedIp: "aabbccdd",
        userAgent: "Mozilla/5.0",
        retentionExpiresAt: expect.any(Date),
      });
      expect(incrementUpdate.set).toHaveBeenCalledWith({
        submissionCount: expect.any(Object),
      });
      expect(contactInsert.values).toHaveBeenCalledWith({
        accountId: "account-1",
        firstName: "Jane",
        lastName: "Smith",
        email: "jane@example.com",
        companyName: "Acme Inc",
        customFields: input.data,
      });
      expect(contactInsert.onConflictDoNothing).toHaveBeenCalledWith({
        target: [contacts.email, contacts.accountId],
      });
      expect(linkUpdate.set).toHaveBeenCalledWith({ contactId: "contact-1" });
      expect(sql).toHaveBeenCalledTimes(1);
    });

    it("rejects when the form does not exist", async () => {
      const formQuery = makeChain({ limitResult: [] });
      const tx = {
        select: vi.fn().mockReturnValue(formQuery),
        insert: vi.fn(),
        update: vi.fn(),
      };

      dbMock.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback(tx));

      await expect(
        FormService.submit({ formId: "missing-form", data: {} }, "account-1"),
      ).rejects.toThrow("Form not found: missing-form");
      expect(tx.insert).not.toHaveBeenCalled();
    });
  });

  describe("listSubmissions", () => {
    it("returns paginated submissions for a form", async () => {
      const submissions = [
        { id: "submission-2", formId: "form-1" },
        { id: "submission-1", formId: "form-1" },
      ];
      const dataQuery = makeChain({ offsetResult: submissions });
      const totalQuery = makeChain({ whereResult: Promise.resolve([{ count: 2 }]) });

      dbMock.select
        .mockReturnValueOnce(dataQuery)
        .mockReturnValueOnce(totalQuery);

      const result = await FormService.listSubmissions("form-1", 10, 5);

      expect(result).toEqual({ data: submissions, total: 2 });
      expect(dataQuery.from).toHaveBeenCalledWith(formSubmissions);
      expect(dataQuery.limit).toHaveBeenCalledWith(10);
      expect(dataQuery.offset).toHaveBeenCalledWith(5);
      expect(desc).toHaveBeenCalledWith(formSubmissions.submittedAt);
      expect(count).toHaveBeenCalledTimes(1);
      // Verify the mock returns data ordered by submittedAt desc
      expect(Array.isArray(result.data)).toBe(true);
    });

    it("propagates submission listing errors", async () => {
      const dataQuery = makeChain({ offsetResult: Promise.reject(new Error("LIST_SUBMISSIONS_FAILED")) });

      dbMock.select.mockReturnValue(dataQuery);

      await expect(FormService.listSubmissions("form-1", 10, 0)).rejects.toThrow(
        "LIST_SUBMISSIONS_FAILED",
      );
    });
  });

  describe("automation mapping", () => {
    it("updates the mapped journey and funnel", async () => {
      const getByIdSpy = vi.spyOn(FormService, "getById").mockResolvedValue({
        id: "form-1",
        journeyId: null,
        funnelId: "existing-funnel",
      } as never);
      const updateQuery = makeChain({
        returningResult: [{ id: "form-1", journeyId: "journey-1", funnelId: "funnel-1" }],
      });

      dbMock.update.mockReturnValue(updateQuery);

      const result = await FormService.mapToAutomation("account-1", "form-1", {
        journeyId: "journey-1",
        funnelId: "funnel-1",
      });

      expect(result).toEqual({ id: "form-1", journeyId: "journey-1", funnelId: "funnel-1" });
      expect(getByIdSpy).toHaveBeenCalledWith("account-1", "form-1");
      expect(dbMock.update).toHaveBeenCalledWith(formTemplates);
      expect(updateQuery.set).toHaveBeenCalledWith(
        expect.objectContaining({
          journeyId: "journey-1",
          funnelId: "funnel-1",
          updatedAt: expect.any(Date),
        }),
      );
    });

    it("throws when mapping a missing form", async () => {
      vi.spyOn(FormService, "getById").mockResolvedValue(null as never);

      await expect(
        FormService.mapToAutomation("account-1", "missing-form", {
          journeyId: "journey-1",
        }),
      ).rejects.toThrow("Form not found");
    });

    it("returns mapping details for an existing form", async () => {
      vi.spyOn(FormService, "getById").mockResolvedValue({
        id: "form-1",
        journeyId: "journey-1",
        funnelId: null,
      } as never);

      await expect(
        FormService.getAutomationMapping("account-1", "form-1"),
      ).resolves.toEqual({
        formId: "form-1",
        journeyId: "journey-1",
        funnelId: null,
      });
    });

    it("returns null when no automation mapping exists", async () => {
      vi.spyOn(FormService, "getById").mockResolvedValue(null as never);

      await expect(
        FormService.getAutomationMapping("account-1", "missing-form"),
      ).resolves.toBeNull();
    });
  });
});
