/**
 * EnrichmentService — Hunter.io email finder/verifier, batch processing
 * Rate-limit handling with exponential backoff and retry queue.
 */

import { ContactService } from "./contact-service.js";

const HUNTER_BASE_URL = "https://api.hunter.io/v2";
const DEFAULT_CONFIDENCE_THRESHOLD = 80;
const VALID_STATUSES = new Set(["valid", "accept_all"]);
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const DEFAULT_FETCH_TIMEOUT_MS = 30000; // 30 second timeout per request
const ENRICHMENT_CHUNK_SIZE = 500; // Process contacts in chunks to prevent OOM

export interface EnrichmentConfig {
  hunterApiKey: string;
  confidenceThreshold?: number;
  retrieveLinkedIn?: boolean;
}

export interface EnrichmentResult {
  contactId: string;
  email?: string;
  score?: number;
  status?: string;
  sources?: string[];
  linkedinUrl?: string;
  error?: string;
  errorCode?: "NOT_FOUND" | "NO_DOMAIN" | "NO_EMAIL" | "LOW_CONFIDENCE" | "INVALID_STATUS" | "ENRICHMENT_FAILED";
}

export interface BatchProgress {
  processed: number;
  total: number;
  found: number;
  verified: number;
}

interface HunterEmailFinderResponse {
  data: {
    email: string;
    score: number;
    sources: { domain: string; uri: string; extracted_on: string }[];
    linkedin_url?: string;
    position?: string;
    company?: string;
  };
}

interface HunterEmailVerifierResponse {
  data: {
    result: string; // "deliverable" | "undeliverable" | "risky" | "unknown"
    score: number;
    status: string; // "valid" | "invalid" | "accept_all" | "webmail" | "disposable" | "unknown"
  };
}

export class EnrichmentService {
  /**
   * Enrich a single contact via Hunter.io Email Finder + Verifier.
   * Returns the enrichment result or an error.
   */
  static async enrichContact(
    contactId: string,
    firstName: string,
    lastName: string,
    domain: string,
    config: EnrichmentConfig,
  ): Promise<EnrichmentResult> {
    const threshold = config.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD;

    try {
      // Step 1: Email Finder
      const finderData = await EnrichmentService.emailFinder(
        config.hunterApiKey,
        domain,
        firstName,
        lastName,
      );

      if (!finderData.data.email) {
        return { contactId, error: "No email found", errorCode: "NO_EMAIL" };
      }

      const score = finderData.data.score;

      // Check confidence threshold
      if (score < threshold) {
        return {
          contactId,
          email: finderData.data.email,
          score,
          error: `Score ${score} below threshold ${threshold}`,
          errorCode: "LOW_CONFIDENCE",
        };
      }

      // Step 2: Email Verifier
      const verifierData = await EnrichmentService.emailVerifier(
        config.hunterApiKey,
        finderData.data.email,
      );

      const verifiedStatus = verifierData.data.status;

      // Check inclusion criteria: confidence >= threshold AND status is valid/accept_all
      if (!VALID_STATUSES.has(verifiedStatus)) {
        return {
          contactId,
          email: finderData.data.email,
          score,
          status: verifiedStatus,
          error: `Status "${verifiedStatus}" not in accepted set`,
          errorCode: "INVALID_STATUS",
        };
      }

      const sources = finderData.data.sources?.map((s) => s.uri).filter(Boolean) ?? [];

      return {
        contactId,
        email: finderData.data.email,
        score: verifierData.data.score,
        status: verifiedStatus,
        sources,
        linkedinUrl: config.retrieveLinkedIn ? finderData.data.linkedin_url : undefined,
      };
    } catch (err) {
      return {
        contactId,
        error: err instanceof Error ? err.message : "Enrichment failed",
        errorCode: "ENRICHMENT_FAILED",
      };
    }
  }

  /**
   * Persist enrichment result to the database if useful data was found.
   * Private helper used by batchEnrich and reEnrich.
   */
  private static async persistEnrichment(
    accountId: string,
    contactId: string,
    result: EnrichmentResult,
  ): Promise<void> {
    if (result.email || result.linkedinUrl) {
      await ContactService.updateEnrichment(accountId, contactId, {
        email: result.email,
        hunterScore: result.score,
        hunterStatus: result.status,
        hunterSources: result.sources,
        linkedinUrl: result.linkedinUrl,
      });
    }
  }

  /**
   * Batch enrich all unenriched contacts for an account.
   * Processes sequentially to respect Hunter.io rate limits.
   * Calls onProgress for each processed contact.
   */
  static async batchEnrich(
    accountId: string,
    config: EnrichmentConfig,
    groupId?: string,
    onProgress?: (progress: BatchProgress) => void,
  ): Promise<BatchProgress> {
    const progress: BatchProgress = {
      processed: 0,
      total: 0, // Updated as we discover contacts
      found: 0,
      verified: 0,
    };

    let offset = 0;
    let hasMore = true;

    // Process contacts in chunks to prevent OOM for large accounts
    while (hasMore) {
      const chunk = await ContactService.getUnenriched(accountId, groupId, {
        limit: ENRICHMENT_CHUNK_SIZE,
        offset,
      });

      if (chunk.length === 0) {
        hasMore = false;
        break;
      }

      // Update total estimate: processed so far + current chunk + potential more
      // Once we get a partial chunk, we know we've reached the end
      if (chunk.length < ENRICHMENT_CHUNK_SIZE) {
        progress.total = progress.processed + chunk.length;
        hasMore = false;
      } else {
        // Estimate: at least what we've seen so far + one more chunk
        progress.total = progress.processed + chunk.length + ENRICHMENT_CHUNK_SIZE;
      }

      // Process each contact in the current chunk
      for (const contact of chunk) {
        const domain = EnrichmentService.extractDomain(contact.businessWebsite);

        if (!domain) {
          progress.processed++;
          onProgress?.(progress);
          continue;
        }

        const result = await EnrichmentService.enrichContact(
          contact.id,
          contact.firstName,
          contact.lastName,
          domain,
          config,
        );

        // Update contact in DB if we found useful data
        await EnrichmentService.persistEnrichment(accountId, contact.id, result);
        if (result.email || result.linkedinUrl) {
          progress.found++;
          if (result.status && VALID_STATUSES.has(result.status)) {
            progress.verified++;
          }
        }

        progress.processed++;
        onProgress?.(progress);

        // Throttle: ~15 req/s on free plan → ~67ms between requests
        // Using 150ms for safety margin (covers finder + verifier = 2 requests per contact)
        await EnrichmentService.delay(150);
      }

      offset += chunk.length;
    }

    // Final total is exactly what we processed
    progress.total = progress.processed;
    return progress;
  }

  /**
   * Re-enrich a single contact by ID.
   */
  static async reEnrich(
    accountId: string,
    contactId: string,
    config: EnrichmentConfig,
  ): Promise<EnrichmentResult> {
    const contact = await ContactService.getById(accountId, contactId);
    if (!contact) {
      return { contactId, error: "Contact not found", errorCode: "NOT_FOUND" };
    }

    const domain = EnrichmentService.extractDomain(contact.businessWebsite);
    if (!domain) {
      return { contactId, error: "No business website to derive domain", errorCode: "NO_DOMAIN" };
    }

    const result = await EnrichmentService.enrichContact(
      contactId,
      contact.firstName,
      contact.lastName,
      domain,
      config,
    );

    if (result.email || result.linkedinUrl) {
      await EnrichmentService.persistEnrichment(accountId, contactId, result);
    }

    return result;
  }

  /**
   * Re-enrich all contacts in a group (including already enriched ones).
   * Useful for refreshing stale data.
   */
  static async reEnrichGroup(
    accountId: string,
    groupId: string,
    config: EnrichmentConfig,
    onProgress?: (progress: BatchProgress) => void,
  ): Promise<BatchProgress> {
    const progress: BatchProgress = {
      processed: 0,
      total: 0,
      found: 0,
      verified: 0,
    };

    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      // Get ALL contacts in the group (not just unenriched)
      const chunk = await ContactService.listByGroup(accountId, groupId, {
        limit: ENRICHMENT_CHUNK_SIZE,
        offset,
      });

      if (chunk.length === 0) {
        hasMore = false;
        break;
      }

      if (chunk.length < ENRICHMENT_CHUNK_SIZE) {
        progress.total = progress.processed + chunk.length;
        hasMore = false;
      } else {
        progress.total = progress.processed + chunk.length + ENRICHMENT_CHUNK_SIZE;
      }

      for (const contact of chunk) {
        const domain = EnrichmentService.extractDomain(contact.businessWebsite);

        if (!domain) {
          progress.processed++;
          onProgress?.(progress);
          continue;
        }

        const result = await EnrichmentService.enrichContact(
          contact.id,
          contact.firstName,
          contact.lastName,
          domain,
          config,
        );

        await EnrichmentService.persistEnrichment(accountId, contact.id, result);
        if (result.email || result.linkedinUrl) {
          progress.found++;
          if (result.status && VALID_STATUSES.has(result.status)) {
            progress.verified++;
          }
        }

        progress.processed++;
        onProgress?.(progress);

        // Throttle: ~150ms between requests for safety
        await EnrichmentService.delay(150);
      }

      offset += chunk.length;
    }

    progress.total = progress.processed;
    return progress;
  }

  // === Hunter.io API Calls with Retry ===

  /** Hunter.io Email Finder with exponential backoff retry */
  static async emailFinder(
    apiKey: string,
    domain: string,
    firstName: string,
    lastName: string,
  ): Promise<HunterEmailFinderResponse> {
    const url = new URL(`${HUNTER_BASE_URL}/email-finder`);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("domain", domain);
    url.searchParams.set("first_name", firstName);
    url.searchParams.set("last_name", lastName);

    return EnrichmentService.fetchWithRetry<HunterEmailFinderResponse>(url.toString());
  }

  /** Hunter.io Email Verifier with exponential backoff retry */
  static async emailVerifier(
    apiKey: string,
    email: string,
  ): Promise<HunterEmailVerifierResponse> {
    const url = new URL(`${HUNTER_BASE_URL}/email-verifier`);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("email", email);

    return EnrichmentService.fetchWithRetry<HunterEmailVerifierResponse>(url.toString());
  }

  /** Generic fetch with timeout and exponential backoff for rate-limit (429) handling */
  static async fetchWithRetry<T>(
    url: string,
    retries = MAX_RETRIES,
    timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
  ): Promise<T> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      // Create a timeout promise that rejects after timeoutMs
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          controller.abort();
          reject(new Error("Request timeout"));
        }, timeoutMs);
      });

      try {
        const response = await Promise.race([
          fetch(url, { signal: controller.signal }),
          timeoutPromise,
        ]);

        if (response.ok) {
          // Keep timeout active through body parsing
          const data = await Promise.race([
            response.json() as Promise<T>,
            timeoutPromise,
          ]);
          clearTimeout(timeoutId!);
          return data;
        }

        // Rate limited — retry with exponential backoff or Retry-After header
        if (response.status === 429 && attempt < retries) {
          clearTimeout(timeoutId!);
          const retryAfter = response.headers.get("Retry-After");
          let delay: number;
          if (retryAfter) {
            // Retry-After can be seconds (integer) or HTTP-date string
            const seconds = parseInt(retryAfter, 10);
            delay = isNaN(seconds) ? BASE_DELAY_MS * Math.pow(2, attempt) : seconds * 1000;
          } else {
            delay = BASE_DELAY_MS * Math.pow(2, attempt);
          }
          await EnrichmentService.delay(delay);
          continue;
        }

        // Other errors — keep timeout active through error body parsing
        const errorBody = await Promise.race([
          response.text().catch(() => ""),
          timeoutPromise.catch(() => ""),
        ]);
        clearTimeout(timeoutId!);
        throw new Error(
          `Hunter.io API error ${response.status}: ${errorBody.slice(0, 200)}`,
        );
      } catch (err) {
        if (timeoutId) clearTimeout(timeoutId);

        // Handle abort/timeout errors as transient failures that can be retried
        if (err instanceof Error) {
          if ((err.name === "AbortError" || err.message === "Request timeout") && attempt < retries) {
            await EnrichmentService.delay(BASE_DELAY_MS * Math.pow(2, attempt));
            continue;
          }
        }

        // Re-throw non-abort errors or if retries exhausted
        throw err;
      }
    }

    throw new Error("Max retries exceeded for Hunter.io API (timeout or persistent errors)");
  }

  /** Extract domain from a URL or website string */
  static extractDomain(website: string | null | undefined): string | null {
    if (!website) return null;
    try {
      const url = website.startsWith("http") ? website : `https://${website}`;
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      // If it looks like a bare domain, return it
      const cleaned = website.replace(/^www\./, "").split("/")[0];
      return cleaned.includes(".") ? cleaned : null;
    }
  }

  /** Promise-based delay */
  static delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
