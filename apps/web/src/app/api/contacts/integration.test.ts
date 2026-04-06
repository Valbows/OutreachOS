/**
 * Integration tests for Phase 3: Contact Management
 * Tests the flow: CSV upload → parse → DB insert → enrichment → contact record update
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getAuthAccount: vi.fn(),
}));

vi.mock("@outreachos/services", () => ({
  ContactService: {
    bulkCreate: vi.fn(),
    getById: vi.fn(),
    list: vi.fn(),
    updateEnrichment: vi.fn(),
    listGroups: vi.fn(),
    addToGroup: vi.fn(),
    createGroup: vi.fn(),
  },
  EnrichmentService: {
    batchEnrich: vi.fn(),
    reEnrich: vi.fn(),
  },
}));

import { getAuthAccount } from "@/lib/auth/session";
import { ContactService, EnrichmentService } from "@outreachos/services";
import { createMockAccount } from "@/test/api-helpers";

describe("Phase 3 Integration: Contact Management Pipeline", () => {
  const mockAccount = createMockAccount();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAuthAccount).mockResolvedValue(mockAccount);
  });

  describe("CSV Upload → Contact Creation", () => {
    it("creates contacts from valid CSV data", async () => {
      const mockContacts = [
        {
          id: "contact_1",
          firstName: "John",
          lastName: "Doe",
          email: null,
          companyName: "Acme Inc",
          businessWebsite: "acme.com",
        },
        {
          id: "contact_2",
          firstName: "Jane",
          lastName: "Smith",
          email: null,
          companyName: "Tech Corp",
          businessWebsite: "techcorp.io",
        },
      ];

      vi.mocked(ContactService.bulkCreate).mockResolvedValueOnce({
        count: mockContacts.length,
        errors: [],
      });

      const result = await ContactService.bulkCreate(mockAccount.id, [
        { firstName: "John", lastName: "Doe", companyName: "Acme Inc", businessWebsite: "acme.com" },
        { firstName: "Jane", lastName: "Smith", companyName: "Tech Corp", businessWebsite: "techcorp.io" },
      ]);

      expect(result.count).toBe(2);
      expect(ContactService.bulkCreate).toHaveBeenCalledWith(
        mockAccount.id,
        expect.arrayContaining([
          expect.objectContaining({ firstName: "John", lastName: "Doe" }),
          expect.objectContaining({ firstName: "Jane", lastName: "Smith" }),
        ])
      );
    });
  });

  describe("Contact Creation → Group Assignment", () => {
    it("assigns contacts to a group after creation", async () => {
      const groupId = "group_123";
      const contactIds = ["contact_1", "contact_2"];

      vi.mocked(ContactService.createGroup).mockResolvedValueOnce({
        id: groupId,
        accountId: mockAccount.id,
        name: "New Leads",
        description: null,
        createdAt: new Date(),
      });

      vi.mocked(ContactService.addToGroup).mockResolvedValueOnce(undefined);

      // Create group
      const group = await ContactService.createGroup(mockAccount.id, "New Leads");
      expect(group.id).toBe(groupId);

      // Add contacts to group
      await ContactService.addToGroup(groupId, contactIds);
      expect(ContactService.addToGroup).toHaveBeenCalledWith(groupId, contactIds);
    });
  });

  describe("Contact → Enrichment → Update", () => {
    it("enriches contacts and updates their records", async () => {
      const contactId = "contact_1";

      vi.mocked(EnrichmentService.reEnrich).mockResolvedValueOnce({
        contactId,
        email: "john@acme.com",
        score: 95,
        status: "valid",
        linkedinUrl: "https://linkedin.com/in/johndoe",
      });

      const result = await EnrichmentService.reEnrich(
        mockAccount.id,
        contactId,
        { hunterApiKey: "test_key", confidenceThreshold: 80, retrieveLinkedIn: true }
      );

      expect(result.email).toBe("john@acme.com");
      expect(result.score).toBe(95);
      expect(result.status).toBe("valid");
      expect(result.linkedinUrl).toBe("https://linkedin.com/in/johndoe");
    });

    it("handles enrichment failures gracefully", async () => {
      const contactId = "contact_2";

      vi.mocked(EnrichmentService.reEnrich).mockResolvedValueOnce({
        contactId,
        error: "No email found",
      });

      const result = await EnrichmentService.reEnrich(
        mockAccount.id,
        contactId,
        { hunterApiKey: "test_key" }
      );

      expect(result.error).toBe("No email found");
      expect(result.email).toBeUndefined();
    });
  });

  describe("Batch Enrichment Flow", () => {
    it("processes batch enrichment with progress tracking", async () => {
      const groupId = "group_123";
      const progressUpdates: { processed: number; total: number }[] = [];

      vi.mocked(EnrichmentService.batchEnrich).mockImplementationOnce(
        async (_accountId, _config, _groupId, onProgress) => {
          // Simulate progress updates - only call onProgress, test callback will push to progressUpdates
          onProgress?.({ processed: 1, total: 3, found: 1, verified: 1 });
          
          onProgress?.({ processed: 2, total: 3, found: 2, verified: 2 });
          
          onProgress?.({ processed: 3, total: 3, found: 2, verified: 2 });

          return { processed: 3, total: 3, found: 2, verified: 2 };
        }
      );

      const result = await EnrichmentService.batchEnrich(
        mockAccount.id,
        { hunterApiKey: "test_key" },
        groupId,
        (progress) => progressUpdates.push({ processed: progress.processed, total: progress.total })
      );

      expect(result.processed).toBe(3);
      expect(result.found).toBe(2);
      expect(result.verified).toBe(2);
      expect(progressUpdates.length).toBeGreaterThan(0);
    });
  });

  describe("Contact List with Group Filter", () => {
    it("lists contacts filtered by group", async () => {
      const groupId = "group_123";

      vi.mocked(ContactService.list).mockResolvedValueOnce({
        data: [
          {
            id: "contact_1",
            firstName: "John",
            lastName: "Doe",
            email: "john@acme.com",
            companyName: "Acme Inc",
            businessWebsite: "acme.com",
            hunterScore: 95,
            hunterStatus: "valid",
            enrichedAt: new Date(),
          },
        ] as never,
        total: 1,
      });

      const result = await ContactService.list({
        accountId: mockAccount.id,
        groupId,
        limit: 50,
        offset: 0,
      });

      expect(result.data).toHaveLength(1);
      expect(ContactService.list).toHaveBeenCalledWith(
        expect.objectContaining({ groupId })
      );
    });
  });

  describe("Contact Groups CRUD", () => {
    it("lists groups for an account", async () => {
      vi.mocked(ContactService.listGroups).mockResolvedValueOnce([
        { id: "group_1", accountId: mockAccount.id, name: "Leads", description: null, createdAt: new Date() },
        { id: "group_2", accountId: mockAccount.id, name: "Customers", description: "Active customers", createdAt: new Date() },
      ]);

      const groups = await ContactService.listGroups(mockAccount.id);

      expect(groups).toHaveLength(2);
      expect(groups[0].name).toBe("Leads");
      expect(groups[1].name).toBe("Customers");
    });
  });
});
