/**
 * LinkedInService — LinkedIn copy generation, playbook management
 * Phase 6: LinkedIn Playbook with LLM-powered copy generation
 */

import { eq, and, desc, count, sql } from "drizzle-orm";
import { db, linkedinPlaybooks, contacts, contactGroups, contactGroupMembers, accounts } from "@outreachos/db";
import { LLMService } from "./llm-service.js";
import type { LLMConfig } from "./llm-service.js";
import { CryptoService } from "./crypto-service.js";

export interface BatchGenerateInput {
  accountId: string;
  contactIds?: string[];
  groupId?: string;
  prompt: string;
  researchNotes?: string;
}

export interface BatchGenerateResult {
  entries: PlaybookEntry[];
  errors: { contactId?: string; error: string }[];
  total: number;
  successCount: number;
  errorCount: number;
}

export interface GenerateCopyInput {
  accountId: string;
  contactId?: string;
  groupId?: string;
  prompt: string;
  researchNotes?: string;
}

export interface PlaybookEntry {
  id: string;
  accountId: string;
  contactId: string | null;
  groupId: string | null;
  prompt: string | null;
  generatedCopy: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlaybookListOptions {
  accountId: string;
  limit?: number;
  offset?: number;
  status?: string;
}

export class LinkedInService {
  /** Generate LinkedIn copy for multiple contacts (batch generation) */
  static async batchGenerateCopy(input: BatchGenerateInput): Promise<BatchGenerateResult> {
    const llmConfig = await LinkedInService.getLLMConfig(input.accountId);
    
    let targetContactIds: string[] = [];
    
    if (input.contactIds && input.contactIds.length > 0) {
      targetContactIds = input.contactIds;
    } else if (input.groupId) {
      // Get all contacts from the group
      const members = await db
        .select({ contactId: contactGroupMembers.contactId })
        .from(contactGroupMembers)
        .where(eq(contactGroupMembers.groupId, input.groupId));
      targetContactIds = members.map(m => m.contactId);
    }
    
    if (targetContactIds.length === 0) {
      return {
        entries: [],
        errors: [{ error: "No contacts selected" }],
        total: 0,
        successCount: 0,
        errorCount: 1,
      };
    }
    
    // Limit batch size to prevent overwhelming the system
    const MAX_BATCH_SIZE = 50;
    if (targetContactIds.length > MAX_BATCH_SIZE) {
      targetContactIds = targetContactIds.slice(0, MAX_BATCH_SIZE);
    }
    
    // Fetch all contacts in one query
    const contactsData = await db
      .select({
        id: contacts.id,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        companyName: contacts.companyName,
        linkedinUrl: contacts.linkedinUrl,
      })
      .from(contacts)
      .where(and(
        eq(contacts.accountId, input.accountId),
        sql`${contacts.id} IN (${sql.join(targetContactIds.map(id => sql`${id}`), sql`, `)})`
      ));
    
    const entries: PlaybookEntry[] = [];
    const errors: { contactId?: string; error: string }[] = [];
    
    // Generate copy for each contact sequentially to avoid rate limits
    for (const contact of contactsData) {
      try {
        const contactInfo = {
          name: `${contact.firstName} ${contact.lastName}`,
          company: contact.companyName ?? undefined,
          linkedinUrl: contact.linkedinUrl ?? undefined,
        };
        
        const result = await LLMService.generateLinkedInCopy(
          input.accountId,
          llmConfig,
          contactInfo,
          input.prompt,
          input.researchNotes,
        );
        
        const [playbook] = await db
          .insert(linkedinPlaybooks)
          .values({
            accountId: input.accountId,
            contactId: contact.id,
            groupId: input.groupId ?? null,
            prompt: input.prompt,
            generatedCopy: result.text,
            status: "generated",
          })
          .returning();
        
        entries.push(playbook);
      } catch (err) {
        errors.push({
          contactId: contact.id,
          error: err instanceof Error ? err.message : "Generation failed",
        });
      }
    }
    
    return {
      entries,
      errors,
      total: targetContactIds.length,
      successCount: entries.length,
      errorCount: errors.length,
    };
  }

  /** Generate LinkedIn copy for a specific contact */
  static async generateCopy(input: GenerateCopyInput): Promise<PlaybookEntry> {
    const llmConfig = await LinkedInService.getLLMConfig(input.accountId);

    let contactInfo: { name: string; company?: string; linkedinUrl?: string } = {
      name: "Contact",
    };

    if (input.contactId) {
      const [contact] = await db
        .select({
          firstName: contacts.firstName,
          lastName: contacts.lastName,
          companyName: contacts.companyName,
          linkedinUrl: contacts.linkedinUrl,
        })
        .from(contacts)
        .where(and(eq(contacts.id, input.contactId), eq(contacts.accountId, input.accountId)))
        .limit(1);

      if (contact) {
        contactInfo = {
          name: `${contact.firstName} ${contact.lastName}`,
          company: contact.companyName ?? undefined,
          linkedinUrl: contact.linkedinUrl ?? undefined,
        };
      }
    }

    const result = await LLMService.generateLinkedInCopy(
      input.accountId,
      llmConfig,
      contactInfo,
      input.prompt,
      input.researchNotes,
    );

    const [playbook] = await db
      .insert(linkedinPlaybooks)
      .values({
        accountId: input.accountId,
        contactId: input.contactId ?? null,
        groupId: input.groupId ?? null,
        prompt: input.prompt,
        generatedCopy: result.text,
        status: "generated",
      })
      .returning();

    return playbook;
  }

  /** Regenerate copy for an existing playbook entry */
  static async regenerateCopy(accountId: string, playbookId: string): Promise<PlaybookEntry> {
    const [existing] = await db
      .select()
      .from(linkedinPlaybooks)
      .where(and(eq(linkedinPlaybooks.id, playbookId), eq(linkedinPlaybooks.accountId, accountId)))
      .limit(1);

    if (!existing) {
      throw new Error("PLAYBOOK_NOT_FOUND: LinkedIn playbook entry not found");
    }

    const llmConfig = await LinkedInService.getLLMConfig(accountId);

    let contactInfo: { name: string; company?: string; linkedinUrl?: string } = {
      name: "Contact",
    };

    if (existing.contactId) {
      const [contact] = await db
        .select({
          firstName: contacts.firstName,
          lastName: contacts.lastName,
          companyName: contacts.companyName,
          linkedinUrl: contacts.linkedinUrl,
        })
        .from(contacts)
        .where(and(eq(contacts.id, existing.contactId), eq(contacts.accountId, accountId)))
        .limit(1);

      if (contact) {
        contactInfo = {
          name: `${contact.firstName} ${contact.lastName}`,
          company: contact.companyName ?? undefined,
          linkedinUrl: contact.linkedinUrl ?? undefined,
        };
      }
    }

    const result = await LLMService.generateLinkedInCopy(
      accountId,
      llmConfig,
      contactInfo,
      existing.prompt ?? "Generate a professional LinkedIn message",
      undefined,
    );

    const [updated] = await db
      .update(linkedinPlaybooks)
      .set({
        generatedCopy: result.text,
        status: "generated",
        updatedAt: new Date(),
      })
      .where(and(eq(linkedinPlaybooks.id, playbookId), eq(linkedinPlaybooks.accountId, accountId)))
      .returning();

    return updated;
  }

  /** List playbook entries for an account */
  static async list(options: PlaybookListOptions): Promise<{ entries: PlaybookEntry[]; total: number }> {
    const limit = Math.min(options.limit ?? 50, 100);
    const offset = options.offset ?? 0;

    const conditions = [eq(linkedinPlaybooks.accountId, options.accountId)];
    if (options.status) {
      conditions.push(eq(linkedinPlaybooks.status, options.status));
    }

    const [totalResult] = await db
      .select({ count: count() })
      .from(linkedinPlaybooks)
      .where(and(...conditions));

    const entries = await db
      .select()
      .from(linkedinPlaybooks)
      .where(and(...conditions))
      .orderBy(desc(linkedinPlaybooks.createdAt))
      .limit(limit)
      .offset(offset);

    return { entries, total: totalResult.count };
  }

  /** Get a single playbook entry */
  static async getById(accountId: string, playbookId: string): Promise<PlaybookEntry | null> {
    const [entry] = await db
      .select()
      .from(linkedinPlaybooks)
      .where(and(eq(linkedinPlaybooks.id, playbookId), eq(linkedinPlaybooks.accountId, accountId)))
      .limit(1);

    return entry ?? null;
  }

  /**
   * Record a LinkedIn response for an existing playbook entry.
   * Enables future optimization by storing response text and outcome.
   */
  static async recordResponse(
    accountId: string,
    playbookId: string,
    responseText: string,
    outcome: "positive" | "negative" | "neutral" = "neutral",
  ): Promise<PlaybookEntry> {
    const [existing] = await db
      .select()
      .from(linkedinPlaybooks)
      .where(and(eq(linkedinPlaybooks.id, playbookId), eq(linkedinPlaybooks.accountId, accountId)))
      .limit(1);

    if (!existing) {
      throw new Error("PLAYBOOK_NOT_FOUND: LinkedIn playbook entry not found");
    }

    const currentResponseData = existing.responseData ?? {};
    const previousResponses = currentResponseData.responses ?? [];

    const newResponseData = {
      lastResponse: responseText,
      lastOutcome: outcome,
      responses: [
        ...previousResponses,
        {
          text: responseText,
          outcome,
          receivedAt: new Date().toISOString(),
        },
      ],
    };

    const [updated] = await db
      .update(linkedinPlaybooks)
      .set({
        status: "responded",
        responseData: newResponseData,
        updatedAt: new Date(),
      })
      .where(and(eq(linkedinPlaybooks.id, playbookId), eq(linkedinPlaybooks.accountId, accountId)))
      .returning();

    if (!updated) {
      throw new Error("PLAYBOOK_NOT_FOUND: LinkedIn playbook entry not found");
    }

    return updated;
  }

  /** Update playbook status (e.g., mark as "sent") */
  static async updateStatus(
    accountId: string,
    playbookId: string,
    status: string,
  ): Promise<PlaybookEntry> {
    const [updated] = await db
      .update(linkedinPlaybooks)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(linkedinPlaybooks.id, playbookId), eq(linkedinPlaybooks.accountId, accountId)))
      .returning();

    if (!updated) {
      throw new Error("PLAYBOOK_NOT_FOUND: LinkedIn playbook entry not found");
    }

    return updated;
  }

  /** Delete a playbook entry */
  static async delete(accountId: string, playbookId: string): Promise<void> {
    const result = await db
      .delete(linkedinPlaybooks)
      .where(and(eq(linkedinPlaybooks.id, playbookId), eq(linkedinPlaybooks.accountId, accountId)));

    if (result.rowCount === 0) {
      throw new Error("PLAYBOOK_NOT_FOUND: LinkedIn playbook entry not found");
    }
  }

  /** Get LLM config for an account, decrypting BYOK keys if present */
  private static async getLLMConfig(accountId: string): Promise<LLMConfig> {
    const [account] = await db
      .select({
        llmProvider: accounts.llmProvider,
        llmModel: accounts.llmModel,
        byokKeys: accounts.byokKeys,
      })
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1);

    if (!account) {
      throw new Error("ACCOUNT_NOT_FOUND: Account not found");
    }

    const provider = (account.llmProvider ?? "gemini") as "gemini" | "openrouter";

    // Try BYOK keys first, then fall back to platform keys
    let apiKey: string | undefined;
    let fallbackApiKey: string | undefined;

    if (account.byokKeys) {
      const { keys: decrypted, errors } = CryptoService.decryptKeys(account.byokKeys);
      if (errors.length > 0) {
        console.error("Failed to decrypt some BYOK keys for account:", errors.join("; "));
      }
      if (provider === "gemini" && decrypted.gemini) {
        apiKey = decrypted.gemini;
      } else if (provider === "openrouter" && decrypted.openrouter) {
        apiKey = decrypted.openrouter;
      }
      // Set fallback from opposite provider
      if (decrypted.openrouter && provider === "gemini") {
        fallbackApiKey = decrypted.openrouter;
      }
    }

    // Fall back to platform environment keys
    let usingPlatformKey = false;
    if (!apiKey) {
      apiKey = provider === "gemini"
        ? process.env.GEMINI_API_KEY
        : process.env.OPENROUTER_API_KEY;
      if (apiKey) usingPlatformKey = true;
    }
    if (!fallbackApiKey) {
      fallbackApiKey = process.env.OPENROUTER_API_KEY;
    }

    if (!apiKey) {
      throw new Error(`LLM_KEY_MISSING: No API key configured for provider: ${provider}`);
    }

    return {
      apiKey,
      model: account.llmModel ?? undefined,
      provider,
      fallbackApiKey,
      routingMode: "auto",
      usingPlatformKey,
    };
  }
}
