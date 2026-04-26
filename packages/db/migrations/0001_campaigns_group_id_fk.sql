--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_group_id_contact_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."contact_groups"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
