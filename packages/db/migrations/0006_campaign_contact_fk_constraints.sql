-- Add missing FK constraints from campaign tables to contacts.
-- All three columns are NOT NULL, so CASCADE is the correct behaviour:
-- deleting a contact removes their send history, replies, and journey state.

ALTER TABLE "message_instances"
  ADD CONSTRAINT "message_instances_contact_id_contacts_id_fk"
  FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE;
--> statement-breakpoint

ALTER TABLE "replies"
  ADD CONSTRAINT "replies_contact_id_contacts_id_fk"
  FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE;
--> statement-breakpoint

ALTER TABLE "journey_enrollments"
  ADD CONSTRAINT "journey_enrollments_contact_id_contacts_id_fk"
  FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE;
