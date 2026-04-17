/**
 * FormService — Form CRUD, template management, submission handling
 * Phase 5
 */

import {
  db,
  formTemplates,
  formSubmissions,
  contacts,
  accounts,
} from "@outreachos/db";
import { eq, and, desc, count, sql } from "drizzle-orm";

export type FormType = "minimal" | "modal" | "inline_banner" | "multi_step" | "side_drawer";

export interface FormField {
  name: string;
  type: "text" | "email" | "phone" | "dropdown" | "checkbox" | "textarea" | "hidden";
  required: boolean;
  label: string;
  placeholder?: string;
  options?: string[]; // for dropdown
  defaultValue?: string;
}

export interface CreateFormInput {
  accountId: string;
  name: string;
  type: FormType;
  fields: FormField[];
  htmlContent?: string;
  cssContent?: string;
  successMessage?: string;
  redirectUrl?: string;
  journeyId?: string;
  funnelId?: string;
}

export interface FormStep {
  id: string;
  stepNumber: number;
  title: string;
  fields: string[];
}

export interface UpdateFormInput {
  name?: string;
  type?: FormType;
  fields?: FormField[];
  steps?: FormStep[];
  htmlContent?: string;
  cssContent?: string;
  successMessage?: string;
  redirectUrl?: string | null;
  journeyId?: string | null;
  funnelId?: string | null;
}

export interface SubmitFormInput {
  formId: string;
  data: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

// Pre-built form templates
const FORM_TEMPLATES: Record<FormType, { html: string; css: string }> = {
  minimal: {
    html: `<form class="outreachos-form minimal">
  <div class="form-fields"></div>
  <button type="submit">Submit</button>
</form>`,
    css: `.outreachos-form.minimal { max-width: 400px; margin: 0 auto; font-family: Inter, sans-serif; }
.outreachos-form.minimal .form-field { margin-bottom: 12px; }
.outreachos-form.minimal label { display: block; font-size: 14px; margin-bottom: 4px; color: #374151; }
.outreachos-form.minimal input, .outreachos-form.minimal textarea { width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; }
.outreachos-form.minimal button { width: 100%; padding: 10px; background: #6366f1; color: white; border: none; border-radius: 6px; font-size: 14px; cursor: pointer; }`,
  },
  modal: {
    html: `<div class="outreachos-modal-overlay">
  <div class="outreachos-modal">
    <button class="modal-close" aria-label="Close">&times;</button>
    <form class="outreachos-form modal">
      <div class="form-fields"></div>
      <button type="submit">Submit</button>
    </form>
  </div>
</div>`,
    css: `.outreachos-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 9999; }
.outreachos-modal { background: white; border-radius: 12px; padding: 32px; max-width: 480px; width: 90%; position: relative; }
.modal-close { position: absolute; top: 12px; right: 12px; background: none; border: none; font-size: 24px; cursor: pointer; color: #6b7280; }`,
  },
  inline_banner: {
    html: `<div class="outreachos-banner">
  <form class="outreachos-form banner">
    <div class="banner-content">
      <div class="form-fields"></div>
      <button type="submit">Subscribe</button>
    </div>
  </form>
</div>`,
    css: `.outreachos-banner { background: #f3f4f6; padding: 24px; border-radius: 8px; }
.outreachos-form.banner .banner-content { display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap; }
.outreachos-form.banner .form-field { flex: 1; min-width: 200px; }`,
  },
  multi_step: {
    html: `<form class="outreachos-form multi-step">
  <div class="step-indicators"></div>
  <div class="step-content"></div>
  <div class="step-nav">
    <button type="button" class="prev-btn">Back</button>
    <button type="button" class="next-btn">Next</button>
    <button type="submit" class="submit-btn" style="display:none">Submit</button>
  </div>
</form>`,
    css: `.outreachos-form.multi-step { max-width: 500px; margin: 0 auto; }
.step-indicators { display: flex; gap: 8px; margin-bottom: 24px; }
.step-indicator { flex: 1; height: 4px; background: #e5e7eb; border-radius: 2px; }
.step-indicator.active { background: #6366f1; }
.step-nav { display: flex; justify-content: space-between; margin-top: 24px; }`,
  },
  side_drawer: {
    html: `<div class="outreachos-drawer">
  <div class="drawer-content">
    <button class="drawer-close" aria-label="Close">&times;</button>
    <form class="outreachos-form drawer">
      <div class="form-fields"></div>
      <button type="submit">Submit</button>
    </form>
  </div>
</div>`,
    css: `.outreachos-drawer { position: fixed; top: 0; right: 0; height: 100vh; width: 400px; background: white; box-shadow: -4px 0 16px rgba(0,0,0,0.1); z-index: 9999; transform: translateX(0); transition: transform 0.3s ease; }
.drawer-content { padding: 32px; height: 100%; overflow-y: auto; }
.drawer-close { background: none; border: none; font-size: 24px; cursor: pointer; position: absolute; top: 12px; right: 12px; }`,
  },
};

export class FormService {
  // === Form CRUD ===

  /** Create a new form */
  static async create(input: CreateFormInput) {
    return db.transaction(async (tx) => {
      // Verify account exists before creating form (within same transaction)
      const [account] = await tx
        .select({ id: accounts.id })
        .from(accounts)
        .where(eq(accounts.id, input.accountId))
        .limit(1);

      if (!account) {
        throw new Error("ACCOUNT_NOT_FOUND: Cannot create form for non-existent account");
      }

      const template = FORM_TEMPLATES[input.type];

      const [form] = await tx
        .insert(formTemplates)
        .values({
          accountId: input.accountId,
          name: input.name,
          type: input.type,
          fields: input.fields,
          htmlContent: input.htmlContent ?? template?.html ?? "",
          cssContent: input.cssContent ?? template?.css ?? "",
          successMessage: input.successMessage ?? "Thank you for your submission!",
          redirectUrl: input.redirectUrl ?? null,
          journeyId: input.journeyId ?? null,
          funnelId: input.funnelId ?? null,
        })
        .returning();

      return form;
    });
  }

  /** Get form by ID */
  static async getById(accountId: string, formId: string) {
    const [form] = await db
      .select()
      .from(formTemplates)
      .where(
        and(
          eq(formTemplates.id, formId),
          eq(formTemplates.accountId, accountId),
        ),
      )
      .limit(1);

    return form ?? null;
  }

  /** Get form by ID (public — no account check, for hosted form rendering) */
  static async getPublicForm(formId: string) {
    const [form] = await db
      .select({
        id: formTemplates.id,
        name: formTemplates.name,
        type: formTemplates.type,
        fields: formTemplates.fields,
        htmlContent: formTemplates.htmlContent,
        cssContent: formTemplates.cssContent,
        successMessage: formTemplates.successMessage,
        redirectUrl: formTemplates.redirectUrl,
      })
      .from(formTemplates)
      .where(eq(formTemplates.id, formId))
      .limit(1);

    return form ?? null;
  }

  /** List forms for an account */
  static async list(accountId: string) {
    return db
      .select()
      .from(formTemplates)
      .where(eq(formTemplates.accountId, accountId))
      .orderBy(desc(formTemplates.createdAt));
  }

  /** Update a form */
  static async update(accountId: string, formId: string, data: UpdateFormInput) {
    const [updated] = await db
      .update(formTemplates)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(formTemplates.id, formId),
          eq(formTemplates.accountId, accountId),
        ),
      )
      .returning();

    return updated ?? null;
  }

  /** Delete a form */
  static async delete(accountId: string, formId: string) {
    await db
      .delete(formTemplates)
      .where(
        and(
          eq(formTemplates.id, formId),
          eq(formTemplates.accountId, accountId),
        ),
      );
  }

  // === Submissions ===

  /** Record a form submission and optionally create/update contact */
  static async submit(
    input: SubmitFormInput,
    accountId?: string,
  ): Promise<{ submissionId: string; contactId?: string }> {
    return db.transaction(async (tx) => {
      // Verify the form exists before creating submission
      const [form] = await tx
        .select({ id: formTemplates.id })
        .from(formTemplates)
        .where(eq(formTemplates.id, input.formId))
        .limit(1);

      if (!form) {
        throw new Error(`Form not found: ${input.formId}`);
      }

      // Record submission
      const [submission] = await tx
        .insert(formSubmissions)
        .values({
          formId: input.formId,
          data: input.data,
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
        })
        .returning();

      // Increment submission count
      await tx
        .update(formTemplates)
        .set({
          submissionCount: sql`${formTemplates.submissionCount} + 1`,
        })
        .where(eq(formTemplates.id, input.formId));

      // Try to create or match contact if email is present
      let contactId: string | undefined;
      const rawEmail = input.data?.email;
      const email = typeof rawEmail === "string" && rawEmail.includes("@")
        ? rawEmail.trim().toLowerCase()
        : undefined;

      if (email && accountId) {
        // Check for existing contact
        const [existing] = await tx
          .select({ id: contacts.id })
          .from(contacts)
          .where(
            and(
              eq(contacts.email, email),
              eq(contacts.accountId, accountId),
            ),
          )
          .limit(1);

        if (existing) {
          contactId = existing.id;
        } else {
          // Helper to safely extract string from form data
          const getString = (key: string): string | undefined => {
            const val = input.data?.[key];
            return typeof val === "string" ? val.trim() : undefined;
          };

          // Create new contact from form data using upsert to handle races
          const upsertResult = await tx
            .insert(contacts)
            .values({
              accountId,
              firstName: getString("firstName") ?? getString("first_name") ?? "Unknown",
              lastName: getString("lastName") ?? getString("last_name") ?? "",
              email,
              companyName: getString("companyName") ?? getString("company") ?? null,
              customFields: input.data,
            })
            .onConflictDoNothing({
              target: [contacts.email, contacts.accountId],
            })
            .returning();

          if (upsertResult.length > 0) {
            // Insert succeeded
            contactId = upsertResult[0].id;
          } else {
            // Conflict occurred — fetch the existing contact
            const [existingContact] = await tx
              .select({ id: contacts.id })
              .from(contacts)
              .where(
                and(
                  eq(contacts.email, email),
                  eq(contacts.accountId, accountId),
                ),
              )
              .limit(1);
            contactId = existingContact?.id;
          }
        }

        // Link submission to contact
        if (contactId) {
          await tx
            .update(formSubmissions)
            .set({ contactId })
            .where(eq(formSubmissions.id, submission.id));
        }
      }

      return { submissionId: submission.id, contactId };
    });
  }

  /** List submissions for a form */
  static async listSubmissions(formId: string, limit = 50, offset = 0) {
    const data = await db
      .select()
      .from(formSubmissions)
      .where(eq(formSubmissions.formId, formId))
      .orderBy(desc(formSubmissions.submittedAt))
      .limit(limit)
      .offset(offset);

    const [totalResult] = await db
      .select({ count: count() })
      .from(formSubmissions)
      .where(eq(formSubmissions.formId, formId));

    return { data, total: totalResult?.count ?? 0 };
  }

  // === Embed Code Generation ===

  /** Generate embed code for a form */
  static generateEmbedCode(
    formId: string,
    baseUrl: string,
    method: "hosted" | "iframe" | "widget" = "iframe",
  ): string {
    const hostedUrl = `${baseUrl}/f/${formId}`;

    switch (method) {
      case "hosted":
        return hostedUrl;

      case "iframe":
        return `<iframe src="${hostedUrl}" width="100%" height="500" frameborder="0" style="border:none;max-width:600px;" title="Contact Form"></iframe>`;

      case "widget":
        return `<script>
(function() {
  var script = document.createElement('script');
  script.src = '${baseUrl}/widget/${formId}.js';
  script.async = true;
  document.head.appendChild(script);
})();
</script>
<div id="outreachos-form-${formId}"></div>`;
    }
  }

  /** Get pre-built form template HTML/CSS by type */
  static getTemplate(type: FormType): { html: string; css: string } | null {
    return FORM_TEMPLATES[type] ?? null;
  }

  /** List all available form template types */
  static getTemplateTypes(): Array<{ type: FormType; label: string }> {
    return [
      { type: "minimal", label: "Minimal" },
      { type: "modal", label: "Modal Popup" },
      { type: "inline_banner", label: "Inline Banner" },
      { type: "multi_step", label: "Multi-Step Wizard" },
      { type: "side_drawer", label: "Side Drawer" },
    ];
  }

  // === Form-to-Automation (Phase 5.6) ===

  /** Map a form to a journey or funnel for automatic enrollment on submission */
  static async mapToAutomation(
    accountId: string,
    formId: string,
    automation: { journeyId?: string; funnelId?: string },
  ) {
    const form = await FormService.getById(accountId, formId);
    if (!form) throw new Error("Form not found");

    const [updated] = await db
      .update(formTemplates)
      .set({
        journeyId: automation.journeyId ?? form.journeyId,
        funnelId: automation.funnelId ?? form.funnelId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(formTemplates.id, formId),
          eq(formTemplates.accountId, accountId),
        ),
      )
      .returning();

    return updated;
  }

  /** Get the automation mapping for a form */
  static async getAutomationMapping(accountId: string, formId: string) {
    const form = await FormService.getById(accountId, formId);
    if (!form) return null;

    return {
      formId: form.id,
      journeyId: form.journeyId,
      funnelId: form.funnelId,
    };
  }

  /**
   * Process automation after form submission.
   * Called after submit() — enrolls the contact in the mapped journey/funnel.
   * Returns the automation actions taken.
   */
  static async processAutomation(
    accountId: string,
    formId: string,
    contactId: string,
  ): Promise<{ enrolled: string[] }> {
    const form = await FormService.getById(accountId, formId);
    if (!form) return { enrolled: [] };

    const enrolled: string[] = [];

    // Enroll in journey if mapped
    if (form.journeyId) {
      try {
        const { JourneyService } = await import("./journey-service.js");
        await JourneyService.enrollGroup(form.journeyId, [{ id: contactId }]);
        enrolled.push(`journey:${form.journeyId}`);
      } catch (err) {
        console.error(`[FormService] Journey enrollment error for form ${formId}:`, err);
      }
    }

    // Enroll in funnel if mapped
    if (form.funnelId) {
      try {
        const { FunnelService } = await import("./funnel-service.js");
        await FunnelService.enrollQualifyingContacts(accountId, form.funnelId, [contactId]);
        enrolled.push(`funnel:${form.funnelId}`);
      } catch (err) {
        console.error(`[FormService] Funnel enrollment error for form ${formId}:`, err);
      }
    }

    return { enrolled };
  }
}
