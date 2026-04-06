/**
 * ContactService — Contact CRUD, CSV upload, group management, export
 */

import { db } from "@outreachos/db";
import { contacts, contactGroups, contactGroupMembers } from "@outreachos/db";
import { eq, and, ilike, or, inArray, sql, desc, asc } from "drizzle-orm";

export interface CreateContactInput {
  accountId: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  businessWebsite?: string | null;
  companyName?: string | null;
  city?: string | null;
  state?: string | null;
  linkedinUrl?: string | null;
  customFields?: Record<string, unknown> | null;
}

export interface UpdateContactInput {
  firstName?: string;
  lastName?: string;
  email?: string | null;
  businessWebsite?: string | null;
  companyName?: string | null;
  city?: string | null;
  state?: string | null;
  linkedinUrl?: string | null;
  customFields?: Record<string, unknown> | null;
  unsubscribed?: boolean;
}

export interface ContactListOptions {
  accountId: string;
  search?: string;
  groupId?: string;
  ids?: string[];
  sortBy?: "name" | "company" | "email" | "score" | "createdAt";
  sortDir?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export interface ParsedRow {
  firstName: string;
  lastName: string;
  businessWebsite: string;
  companyName: string;
  email?: string;
  city?: string;
  state?: string;
  linkedinUrl?: string;
  [key: string]: unknown;
}

export interface UploadResult {
  count: number;
  errors: { row: number; message: string }[];
}

export interface PreviewResult {
  headers: string[];
  autoMapping: Record<string, string>;
  unmapped: string[];
  suggestions: Record<string, { field: string; confidence: number }[]>;
  sampleRows: Record<string, string>[];
  totalRows: number;
  requiredFields: string[];
  missingRequired: string[];
}

const REQUIRED_COLUMNS = ["firstname", "lastname", "businesswebsite", "companyname"];

const COLUMN_MAP: Record<string, string> = {
  firstname: "firstName",
  first_name: "firstName",
  "first name": "firstName",
  fname: "firstName",
  first: "firstName",
  givenname: "firstName",
  given_name: "firstName",
  lastname: "lastName",
  last_name: "lastName",
  "last name": "lastName",
  lname: "lastName",
  last: "lastName",
  surname: "lastName",
  familyname: "lastName",
  businesswebsite: "businessWebsite",
  business_website: "businessWebsite",
  "business website": "businessWebsite",
  website: "businessWebsite",
  url: "businessWebsite",
  web: "businessWebsite",
  site: "businessWebsite",
  companyname: "companyName",
  company_name: "companyName",
  "company name": "companyName",
  company: "companyName",
  organization: "companyName",
  org: "companyName",
  orgname: "companyName",
  email: "email",
  "email address": "email",
  emailaddress: "email",
  mail: "email",
  e_mail: "email",
  city: "city",
  town: "city",
  location: "city",
  state: "state",
  province: "state",
  region: "state",
  st: "state",
  linkedin: "linkedinUrl",
  linkedin_url: "linkedinUrl",
  "linkedin url": "linkedinUrl",
  linkedinurl: "linkedinUrl",
  linkedinprofile: "linkedinUrl",
  "linkedin profile": "linkedinUrl",
  liurl: "linkedinUrl",
};

const MAX_EXPORT_CONTACTS = 100000;

/** Calculate Levenshtein distance between two strings */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/** Calculate similarity score (0-1) between two strings */
function similarityScore(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  const distance = levenshteinDistance(a, b);
  const maxLen = Math.max(a.length, b.length);
  return 1 - distance / maxLen;
}

export class ContactService {
  /** List contacts with filtering, search, sorting, and pagination */
  static async list(options: ContactListOptions) {
    const {
      accountId,
      search,
      groupId,
      ids,
      sortBy = "createdAt",
      sortDir = "desc",
      limit = 50,
      offset = 0,
    } = options;

    const sortFn = sortDir === "asc" ? asc : desc;
    const sortColumn =
      sortBy === "name"
        ? contacts.firstName
        : sortBy === "company"
          ? contacts.companyName
          : sortBy === "email"
            ? contacts.email
            : sortBy === "score"
              ? contacts.hunterScore
              : contacts.createdAt;

    const conditions = [eq(contacts.accountId, accountId)];

    // Filter by specific IDs if provided (server-side filtering)
    if (ids && ids.length > 0) {
      conditions.push(inArray(contacts.id, ids));
    }

    if (search) {
      const q = `%${search}%`;
      conditions.push(
        or(
          ilike(contacts.firstName, q),
          ilike(contacts.lastName, q),
          ilike(contacts.email, q),
          ilike(contacts.companyName, q),
        )!,
      );
    }

    let results;

    if (groupId) {
      // When filtering by group, use a subquery for contact IDs in the group
      const contactIdsInGroup = db
        .select({ contactId: contactGroupMembers.contactId })
        .from(contactGroupMembers)
        .where(eq(contactGroupMembers.groupId, groupId));

      results = await db
        .select()
        .from(contacts)
        .where(and(...conditions, inArray(contacts.id, contactIdsInGroup)))
        .orderBy(sortFn(sortColumn))
        .limit(limit)
        .offset(offset);
    } else {
      results = await db
        .select()
        .from(contacts)
        .where(and(...conditions))
        .orderBy(sortFn(sortColumn))
        .limit(limit)
        .offset(offset);
    }

    let countResult;
    if (groupId) {
      const contactIdsInGroup = db
        .select({ contactId: contactGroupMembers.contactId })
        .from(contactGroupMembers)
        .where(eq(contactGroupMembers.groupId, groupId));

      [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(contacts)
        .where(and(...conditions, inArray(contacts.id, contactIdsInGroup)));
    } else {
      [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(contacts)
        .where(and(...conditions));
    }

    return { data: results, total: Number(countResult?.count ?? 0) };
  }

  /** Get a single contact by ID (scoped to account) */
  static async getById(accountId: string, contactId: string) {
    const [contact] = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.id, contactId), eq(contacts.accountId, accountId)))
      .limit(1);
    return contact ?? null;
  }

  /** Create a single contact */
  static async create(input: CreateContactInput) {
    const [contact] = await db
      .insert(contacts)
      .values({
        accountId: input.accountId,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email ?? null,
        businessWebsite: input.businessWebsite ?? null,
        companyName: input.companyName ?? null,
        city: input.city ?? null,
        state: input.state ?? null,
        linkedinUrl: input.linkedinUrl ?? null,
        customFields: input.customFields ?? null,
      })
      .returning();
    return contact;
  }

  /** Bulk insert contacts from parsed rows */
  static async bulkCreate(accountId: string, rows: ParsedRow[]): Promise<UploadResult> {
    const errors: { row: number; message: string }[] = [];
    const validRows: CreateContactInput[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row.firstName?.trim() || !row.lastName?.trim()) {
        errors.push({ row: i + 2, message: "Missing first name or last name" });
        continue;
      }
      if (!row.businessWebsite?.trim() && !row.companyName?.trim()) {
        errors.push({ row: i + 2, message: "Missing business website and company name" });
        continue;
      }
      validRows.push({
        accountId,
        firstName: row.firstName.trim(),
        lastName: row.lastName.trim(),
        email: row.email?.trim() || null,
        businessWebsite: row.businessWebsite?.trim() || null,
        companyName: row.companyName?.trim() || null,
        city: row.city?.trim() || null,
        state: row.state?.trim() || null,
        linkedinUrl: row.linkedinUrl?.trim() || null,
      });
    }

    if (validRows.length > 0) {
      // Insert in batches of 500 to avoid hitting parameter limits
      const BATCH_SIZE = 500;
      await db.transaction(async (tx) => {
        for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
          const batch = validRows.slice(i, i + BATCH_SIZE);
          await tx.insert(contacts).values(batch);
        }
      });
    }

    return { count: validRows.length, errors };
  }

  /** Update a contact */
  static async update(accountId: string, contactId: string, input: UpdateContactInput) {
    const [updated] = await db
      .update(contacts)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(contacts.id, contactId), eq(contacts.accountId, accountId)))
      .returning();
    return updated ?? null;
  }

  /**
   * Atomically merge a single custom field into contact.customFields (JSONB).
   * Uses PostgreSQL's jsonb concatenation operator (||) to avoid TOCTOU race.
   * This is safe for concurrent updates from multiple agents/MCP sessions.
   */
  static async mergeCustomField(
    accountId: string,
    contactId: string,
    fieldName: string,
    fieldValue: unknown,
  ) {
    // Build the JSON object to merge: {"fieldName": value}
    const mergeObject = { [fieldName]: fieldValue };

    const [updated] = await db
      .update(contacts)
      .set({
        customFields: sql`COALESCE(${contacts.customFields}, '{}'::jsonb) || ${JSON.stringify(mergeObject)}::jsonb`,
        updatedAt: new Date(),
      })
      .where(and(eq(contacts.id, contactId), eq(contacts.accountId, accountId)))
      .returning();

    return updated ?? null;
  }

  /**
   * Atomically delete a single custom field from contact.customFields (JSONB).
   * Uses PostgreSQL's jsonb_delete to avoid TOCTOU race.
   */
  static async deleteCustomField(
    accountId: string,
    contactId: string,
    fieldName: string,
  ) {
    const [updated] = await db
      .update(contacts)
      .set({
        customFields: sql`${contacts.customFields} - ${fieldName}`,
        updatedAt: new Date(),
      })
      .where(and(eq(contacts.id, contactId), eq(contacts.accountId, accountId)))
      .returning();

    return updated ?? null;
  }

  /** Delete contacts */
  static async delete(accountId: string, contactIds: string[]): Promise<number> {
    if (contactIds.length === 0) return 0;
    const result = await db
      .delete(contacts)
      .where(and(inArray(contacts.id, contactIds), eq(contacts.accountId, accountId)))
      .returning({ id: contacts.id });
    return result.length;
  }

  /** Parse CSV content into rows with column mapping */
  static parseCSV(content: string): ParsedRow[] {
    const lines = content.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return [];

    let headers: string[];
    try {
      headers = ContactService.parseCSVLine(lines[0]).map((h) => h.trim().replace(/^"|"$/g, ""));
    } catch (err) {
      throw new Error(`Failed to parse CSV header (line 1): ${err instanceof Error ? err.message : "Invalid format"}`);
    }

    const mappedHeaders = headers.map((h) => {
      const normalized = h.toLowerCase().replace(/[^a-z0-9]/g, "");
      return COLUMN_MAP[normalized] || COLUMN_MAP[h.toLowerCase()] || h;
    });

    // Validate required columns exist
    const mappedLower = mappedHeaders.map((h) => h.toLowerCase());
    for (const req of REQUIRED_COLUMNS) {
      const mapped = COLUMN_MAP[req];
      if (mapped && !mappedLower.includes(mapped.toLowerCase())) {
        throw new Error(`Missing required column: ${req}`);
      }
    }

    const rows: ParsedRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      let values: string[];
      try {
        values = ContactService.parseCSVLine(lines[i]);
      } catch (err) {
        throw new Error(`Failed to parse CSV row at line ${i + 1}: ${err instanceof Error ? err.message : "Invalid format"}`);
      }

      const row: Record<string, unknown> = {};
      for (let j = 0; j < mappedHeaders.length; j++) {
        row[mappedHeaders[j]] = values[j]?.trim().replace(/^"|"$/g, "") || "";
      }
      rows.push(row as unknown as ParsedRow);
    }

    return rows;
  }

  /** Parse CSV content with custom user-provided column mapping */
  static parseCSVWithMapping(content: string, userMapping: Record<string, string>): ParsedRow[] {
    const lines = content.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return [];

    let headers: string[];
    try {
      headers = ContactService.parseCSVLine(lines[0]).map((h) => h.trim().replace(/^"|"$/g, ""));
    } catch (err) {
      throw new Error(`Failed to parse CSV header (line 1): ${err instanceof Error ? err.message : "Invalid format"}`);
    }

    // Apply user mapping: header -> field
    const mappedHeaders = headers.map((h) => {
      // If user provided a mapping for this header, use it; otherwise keep original
      return userMapping[h] || h;
    });

    // Validate required columns exist (check for required field names in mapped headers)
    const requiredFields = ["firstName", "lastName", "businessWebsite", "companyName"];
    const mappedLower = mappedHeaders.map((h) => h.toLowerCase());
    for (const req of requiredFields) {
      if (!mappedLower.includes(req.toLowerCase())) {
        throw new Error(`Missing required column: ${req}`);
      }
    }

    const rows: ParsedRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      let values: string[];
      try {
        values = ContactService.parseCSVLine(lines[i]);
      } catch (err) {
        throw new Error(`Failed to parse CSV row at line ${i + 1}: ${err instanceof Error ? err.message : "Invalid format"}`);
      }

      const row: Record<string, unknown> = {};
      for (let j = 0; j < mappedHeaders.length; j++) {
        const value = values[j]?.trim().replace(/^"|"$/g, "") || "";
        // Skip empty mappings
        if (mappedHeaders[j]) {
          row[mappedHeaders[j]] = value;
        }
      }
      rows.push(row as unknown as ParsedRow);
    }

    return rows;
  }

  /** Preview CSV content with auto-mapping, fuzzy suggestions, and sample rows */
  static previewCSV(content: string): PreviewResult {
    const lines = content.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) {
      return {
        headers: [],
        autoMapping: {},
        unmapped: [],
        suggestions: {},
        sampleRows: [],
        totalRows: 0,
        requiredFields: REQUIRED_COLUMNS.map((c) => COLUMN_MAP[c]),
        missingRequired: REQUIRED_COLUMNS.map((c) => COLUMN_MAP[c]),
      };
    }

    // Parse headers
    let headers: string[];
    try {
      headers = ContactService.parseCSVLine(lines[0]).map((h) => h.trim().replace(/^"|"$/g, ""));
    } catch (err) {
      throw new Error(`Failed to parse CSV header (line 1): ${err instanceof Error ? err.message : "Invalid format"}`);
    }

    // Auto-mapping
    const autoMapping: Record<string, string> = {};
    const unmapped: string[] = [];
    const suggestions: Record<string, { field: string; confidence: number }[]> = {};

    for (const header of headers) {
      const normalized = header.toLowerCase().replace(/[^a-z0-9]/g, "");
      const directMatch = COLUMN_MAP[normalized] || COLUMN_MAP[header.toLowerCase()];

      if (directMatch) {
        autoMapping[header] = directMatch;
      } else {
        unmapped.push(header);
        // Generate fuzzy suggestions
        const headerSuggestions = ContactService.fuzzyMatchSuggestion(header);
        if (headerSuggestions.length > 0) {
          suggestions[header] = headerSuggestions;
        }
      }
    }

    // Parse sample rows (first 3 data rows)
    const sampleRows: Record<string, string>[] = [];
    for (let i = 1; i < Math.min(lines.length, 4); i++) {
      try {
        const values = ContactService.parseCSVLine(lines[i]);
        const row: Record<string, string> = {};
        for (let j = 0; j < headers.length; j++) {
          row[headers[j]] = values[j]?.trim().replace(/^"|"$/g, "") || "";
        }
        sampleRows.push(row);
      } catch {
        // Skip malformed rows in preview
      }
    }

    // Calculate missing required fields
    const mappedFields = new Set(Object.values(autoMapping));
    const requiredFields = REQUIRED_COLUMNS.map((c) => COLUMN_MAP[c]);
    const missingRequired = requiredFields.filter((f) => !mappedFields.has(f));

    return {
      headers,
      autoMapping,
      unmapped,
      suggestions,
      sampleRows,
      totalRows: lines.length - 1, // Exclude header
      requiredFields,
      missingRequired,
    };
  }

  /** Generate fuzzy match suggestions for a header */
  static fuzzyMatchSuggestion(
    header: string,
    threshold = 0.6,
    maxSuggestions = 3
  ): { field: string; confidence: number }[] {
    const normalizedHeader = header.toLowerCase().replace(/[^a-z0-9]/g, "");
    const knownHeaders = Object.keys(COLUMN_MAP);

    const scored = knownHeaders
      .map((known) => {
        const normalizedKnown = known.toLowerCase().replace(/[^a-z0-9]/g, "");
        const score = similarityScore(normalizedHeader, normalizedKnown);
        return { field: COLUMN_MAP[known], score, original: known };
      })
      .filter((item) => item.score >= threshold)
      .sort((a, b) => b.score - a.score);

    // Deduplicate by field name
    const seen = new Set<string>();
    const unique: { field: string; confidence: number }[] = [];

    for (const item of scored) {
      if (!seen.has(item.field)) {
        seen.add(item.field);
        unique.push({ field: item.field, confidence: Math.round(item.score * 100) });
        if (unique.length >= maxSuggestions) break;
      }
    }

    return unique;
  }

  /** Parse a single CSV line handling quoted values */
  static parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  }

  // === Group Management ===

  /** List groups for an account */
  static async listGroups(accountId: string) {
    return db
      .select()
      .from(contactGroups)
      .where(eq(contactGroups.accountId, accountId))
      .orderBy(asc(contactGroups.name));
  }

  /** Get a single group by ID (scoped to account) */
  static async getGroupById(accountId: string, groupId: string) {
    const [group] = await db
      .select()
      .from(contactGroups)
      .where(and(eq(contactGroups.id, groupId), eq(contactGroups.accountId, accountId)))
      .limit(1);
    return group ?? null;
  }

  /** Create a group */
  static async createGroup(accountId: string, name: string, description?: string) {
    const [group] = await db
      .insert(contactGroups)
      .values({ accountId, name, description: description ?? null })
      .returning();
    return group;
  }

  /** Add contacts to a group */
  static async addToGroup(groupId: string, contactIds: string[]) {
    if (contactIds.length === 0) return;
    const values = contactIds.map((contactId) => ({ contactId, groupId }));
    await db.insert(contactGroupMembers).values(values).onConflictDoNothing();
  }

  /** Remove contacts from a group */
  static async removeFromGroup(groupId: string, contactIds: string[]) {
    if (contactIds.length === 0) return;
    await db
      .delete(contactGroupMembers)
      .where(
        and(
          eq(contactGroupMembers.groupId, groupId),
          inArray(contactGroupMembers.contactId, contactIds),
        ),
      );
  }

  /** Delete a group (members cascade) */
  static async deleteGroup(accountId: string, groupId: string) {
    await db
      .delete(contactGroups)
      .where(and(eq(contactGroups.id, groupId), eq(contactGroups.accountId, accountId)));
  }

  /** List contacts in a specific group with pagination */
  static async listByGroup(
    accountId: string,
    groupId: string,
    options: { limit?: number; offset?: number } = {},
  ) {
    const { limit = 100, offset = 0 } = options;
    
    const result = await db
      .select({
        id: contacts.id,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        email: contacts.email,
        businessWebsite: contacts.businessWebsite,
        companyName: contacts.companyName,
        enrichedAt: contacts.enrichedAt,
        hunterScore: contacts.hunterScore,
        hunterStatus: contacts.hunterStatus,
      })
      .from(contacts)
      .innerJoin(contactGroupMembers, eq(contacts.id, contactGroupMembers.contactId))
      .where(
        and(
          eq(contacts.accountId, accountId),
          eq(contactGroupMembers.groupId, groupId),
        )
      )
      .limit(limit)
      .offset(offset);
    
    return result;
  }

  /** Export contacts as CSV string */
  static async exportCSV(accountId: string, groupId?: string, ids?: string[]): Promise<string> {
    // Use server-side filtering via ids param to ensure all requested contacts are retrieved
    const { data: contactsToExport } = await ContactService.list({
      accountId,
      groupId,
      ids,
      limit: MAX_EXPORT_CONTACTS,
      offset: 0,
    });

    const headers = [
      "First Name",
      "Last Name",
      "Email",
      "Company Name",
      "Business Website",
      "City",
      "State",
      "LinkedIn URL",
      "Hunter Score",
      "Hunter Status",
      "Enriched At",
    ];

    const csvRows = [headers.join(",")];
    for (const c of contactsToExport) {
      const row = [
        ContactService.escapeCSV(c.firstName),
        ContactService.escapeCSV(c.lastName),
        ContactService.escapeCSV(c.email ?? ""),
        ContactService.escapeCSV(c.companyName ?? ""),
        ContactService.escapeCSV(c.businessWebsite ?? ""),
        ContactService.escapeCSV(c.city ?? ""),
        ContactService.escapeCSV(c.state ?? ""),
        ContactService.escapeCSV(c.linkedinUrl ?? ""),
        c.hunterScore?.toString() ?? "",
        ContactService.escapeCSV(c.hunterStatus ?? ""),
        c.enrichedAt?.toISOString() ?? "",
      ];
      csvRows.push(row.join(","));
    }

    return csvRows.join("\n");
  }

  /** Escape a value for CSV output */
  static escapeCSV(value: string): string {
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  /** Count unenriched contacts for an account */
  static async countUnenriched(accountId: string): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(contacts)
      .where(
        and(eq(contacts.accountId, accountId), sql`${contacts.enrichedAt} IS NULL`),
      );
    return Number(result?.count ?? 0);
  }

  /** Get unenriched contacts for batch enrichment with optional pagination */
  static async getUnenriched(
    accountId: string,
    groupId?: string,
    opts?: { limit?: number; offset?: number },
  ) {
    const { limit = 50, offset = 0 } = opts ?? {};

    const conditions = [
      eq(contacts.accountId, accountId),
      sql`${contacts.enrichedAt} IS NULL`,
    ];

    if (groupId) {
      const contactIdsInGroup = db
        .select({ contactId: contactGroupMembers.contactId })
        .from(contactGroupMembers)
        .where(eq(contactGroupMembers.groupId, groupId));

      conditions.push(inArray(contacts.id, contactIdsInGroup));
    }

    return db
      .select()
      .from(contacts)
      .where(and(...conditions))
      .limit(limit)
      .offset(offset);
  }

  /** Update enrichment data on a contact */
  static async updateEnrichment(
    accountId: string,
    contactId: string,
    data: {
      email?: string;
      hunterScore?: number;
      hunterStatus?: string;
      hunterSources?: string[];
      linkedinUrl?: string;
    },
  ) {
    const [updated] = await db
      .update(contacts)
      .set({
        ...data,
        enrichedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(contacts.id, contactId), eq(contacts.accountId, accountId)))
      .returning();
    return updated ?? null;
  }
}
