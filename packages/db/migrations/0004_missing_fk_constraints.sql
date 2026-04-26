--> statement-breakpoint
-- form_submissions.contact_id → contacts(id) ON DELETE SET NULL
ALTER TABLE "form_submissions"
  ADD CONSTRAINT "form_submissions_contact_id_fk"
  FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL;

--> statement-breakpoint
-- form_templates.journey_id → campaigns(id) ON DELETE SET NULL
ALTER TABLE "form_templates"
  ADD CONSTRAINT "form_templates_journey_id_fk"
  FOREIGN KEY ("journey_id") REFERENCES "campaigns"("id") ON DELETE SET NULL;

--> statement-breakpoint
-- form_templates.funnel_id → campaigns(id) ON DELETE SET NULL
ALTER TABLE "form_templates"
  ADD CONSTRAINT "form_templates_funnel_id_fk"
  FOREIGN KEY ("funnel_id") REFERENCES "campaigns"("id") ON DELETE SET NULL;

--> statement-breakpoint
-- linkedin_playbooks.contact_id → contacts(id) ON DELETE SET NULL
ALTER TABLE "linkedin_playbooks"
  ADD CONSTRAINT "linkedin_playbooks_contact_id_fk"
  FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL;

--> statement-breakpoint
-- linkedin_playbooks.group_id → contact_groups(id) ON DELETE SET NULL
ALTER TABLE "linkedin_playbooks"
  ADD CONSTRAINT "linkedin_playbooks_group_id_fk"
  FOREIGN KEY ("group_id") REFERENCES "contact_groups"("id") ON DELETE SET NULL;

--> statement-breakpoint
-- resend_usage_log.campaign_id → campaigns(id) ON DELETE SET NULL
ALTER TABLE "resend_usage_log"
  ADD CONSTRAINT "resend_usage_log_campaign_id_fk"
  FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL;

--> statement-breakpoint
-- resend_usage_log.contact_id → contacts(id) ON DELETE SET NULL
ALTER TABLE "resend_usage_log"
  ADD CONSTRAINT "resend_usage_log_contact_id_fk"
  FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL;
