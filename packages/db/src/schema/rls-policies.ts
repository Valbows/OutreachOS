/**
 * Row Level Security (RLS) Policies for Multi-Tenant Isolation
 * 
 * These SQL statements enable RLS on all tenant tables and create policies
 * that enforce account_id-based access control at the database level.
 * 
 * Run these via drizzle-kit execute or as part of migration:
 *   npx drizzle-kit execute --config=drizzle.config.ts --file=src/schema/rls-policies.ts
 */

export const rlsEnableSql = `
-- Enable RLS on all tenant tables
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiment_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE linkedin_playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE hunter_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE resend_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_billing ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_plans ENABLE ROW LEVEL SECURITY;

-- Force RLS for table owners (bypass only when explicitly needed)
ALTER TABLE accounts FORCE ROW LEVEL SECURITY;
ALTER TABLE contacts FORCE ROW LEVEL SECURITY;
ALTER TABLE contact_groups FORCE ROW LEVEL SECURITY;
ALTER TABLE contact_group_members FORCE ROW LEVEL SECURITY;
ALTER TABLE campaigns FORCE ROW LEVEL SECURITY;
ALTER TABLE templates FORCE ROW LEVEL SECURITY;
ALTER TABLE campaign_steps FORCE ROW LEVEL SECURITY;
ALTER TABLE experiments FORCE ROW LEVEL SECURITY;
ALTER TABLE experiment_batches FORCE ROW LEVEL SECURITY;
ALTER TABLE message_instances FORCE ROW LEVEL SECURITY;
ALTER TABLE email_events FORCE ROW LEVEL SECURITY;
ALTER TABLE replies FORCE ROW LEVEL SECURITY;
ALTER TABLE form_templates FORCE ROW LEVEL SECURITY;
ALTER TABLE form_submissions FORCE ROW LEVEL SECURITY;
ALTER TABLE linkedin_playbooks FORCE ROW LEVEL SECURITY;
ALTER TABLE api_keys FORCE ROW LEVEL SECURITY;
ALTER TABLE api_usage FORCE ROW LEVEL SECURITY;
ALTER TABLE webhooks FORCE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries FORCE ROW LEVEL SECURITY;
ALTER TABLE llm_usage_log FORCE ROW LEVEL SECURITY;
ALTER TABLE hunter_usage_log FORCE ROW LEVEL SECURITY;
ALTER TABLE resend_usage_log FORCE ROW LEVEL SECURITY;
ALTER TABLE account_billing FORCE ROW LEVEL SECURITY;
ALTER TABLE billing_plans FORCE ROW LEVEL SECURITY;
`;

export const rlsPolicySql = `
-- Accounts: Users can only see their own account
CREATE POLICY account_isolation ON accounts
  FOR ALL
  USING (id = current_setting('app.current_account_id', true)::uuid);

-- Contacts: Isolated by account_id
CREATE POLICY contact_isolation ON contacts
  FOR ALL
  USING (account_id = current_setting('app.current_account_id', true)::uuid);

-- Contact Groups: Isolated by account_id
CREATE POLICY contact_group_isolation ON contact_groups
  FOR ALL
  USING (account_id = current_setting('app.current_account_id', true)::uuid);

-- Contact Group Members: Isolated through contact's account
CREATE POLICY contact_group_member_isolation ON contact_group_members
  FOR ALL
  USING (
    contact_id IN (
      SELECT id FROM contacts 
      WHERE account_id = current_setting('app.current_account_id', true)::uuid
    )
  );

-- Campaigns: Isolated by account_id
CREATE POLICY campaign_isolation ON campaigns
  FOR ALL
  USING (account_id = current_setting('app.current_account_id', true)::uuid);

-- Templates: Isolated by account_id
CREATE POLICY template_isolation ON templates
  FOR ALL
  USING (account_id = current_setting('app.current_account_id', true)::uuid);

-- Campaign Steps: Isolated through campaign's account
CREATE POLICY campaign_step_isolation ON campaign_steps
  FOR ALL
  USING (
    campaign_id IN (
      SELECT id FROM campaigns 
      WHERE account_id = current_setting('app.current_account_id', true)::uuid
    )
  );

-- Experiments: Isolated by account_id
CREATE POLICY experiment_isolation ON experiments
  FOR ALL
  USING (account_id = current_setting('app.current_account_id', true)::uuid);

-- Experiment Batches: Isolated through experiment's account
CREATE POLICY experiment_batch_isolation ON experiment_batches
  FOR ALL
  USING (
    experiment_id IN (
      SELECT id FROM experiments 
      WHERE account_id = current_setting('app.current_account_id', true)::uuid
    )
  );

-- Message Instances: Isolated through campaign's account
CREATE POLICY message_instance_isolation ON message_instances
  FOR ALL
  USING (
    campaign_id IN (
      SELECT id FROM campaigns 
      WHERE account_id = current_setting('app.current_account_id', true)::uuid
    )
  );

-- Email Events: Isolated through message_instance -> campaign
CREATE POLICY email_event_isolation ON email_events
  FOR ALL
  USING (
    message_instance_id IN (
      SELECT mi.id FROM message_instances mi
      JOIN campaigns c ON mi.campaign_id = c.id
      WHERE c.account_id = current_setting('app.current_account_id', true)::uuid
    )
  );

-- Replies: Isolated through contact's account
CREATE POLICY reply_isolation ON replies
  FOR ALL
  USING (
    contact_id IN (
      SELECT id FROM contacts 
      WHERE account_id = current_setting('app.current_account_id', true)::uuid
    )
  );

-- Form Templates: Isolated by account_id
CREATE POLICY form_template_isolation ON form_templates
  FOR ALL
  USING (account_id = current_setting('app.current_account_id', true)::uuid);

-- Form Submissions: Isolated through form_template's account
CREATE POLICY form_submission_isolation ON form_submissions
  FOR ALL
  USING (
    form_template_id IN (
      SELECT id FROM form_templates 
      WHERE account_id = current_setting('app.current_account_id', true)::uuid
    )
  );

-- LinkedIn Playbooks: Isolated by account_id
CREATE POLICY linkedin_playbook_isolation ON linkedin_playbooks
  FOR ALL
  USING (account_id = current_setting('app.current_account_id', true)::uuid);

-- API Keys: Isolated by account_id
CREATE POLICY api_key_isolation ON api_keys
  FOR ALL
  USING (account_id = current_setting('app.current_account_id', true)::uuid);

-- API Usage: Isolated by account_id
CREATE POLICY api_usage_isolation ON api_usage
  FOR ALL
  USING (account_id = current_setting('app.current_account_id', true)::uuid);

-- Webhooks: Isolated by account_id
CREATE POLICY webhook_isolation ON webhooks
  FOR ALL
  USING (account_id = current_setting('app.current_account_id', true)::uuid);

-- Webhook Deliveries: Isolated through webhook's account
CREATE POLICY webhook_delivery_isolation ON webhook_deliveries
  FOR ALL
  USING (
    webhook_id IN (
      SELECT id FROM webhooks 
      WHERE account_id = current_setting('app.current_account_id', true)::uuid
    )
  );

-- LLM Usage Log: Isolated by account_id
CREATE POLICY llm_usage_log_isolation ON llm_usage_log
  FOR ALL
  USING (account_id = current_setting('app.current_account_id', true)::uuid);

-- Hunter Usage Log: Isolated by account_id
CREATE POLICY hunter_usage_log_isolation ON hunter_usage_log
  FOR ALL
  USING (account_id = current_setting('app.current_account_id', true)::uuid);

-- Resend Usage Log: Isolated by account_id
CREATE POLICY resend_usage_log_isolation ON resend_usage_log
  FOR ALL
  USING (account_id = current_setting('app.current_account_id', true)::uuid);

-- Account Billing: Isolated by account_id
CREATE POLICY account_billing_isolation ON account_billing
  FOR ALL
  USING (account_id = current_setting('app.current_account_id', true)::uuid);

-- Billing Plans: Isolated by account_id
CREATE POLICY billing_plan_isolation ON billing_plans
  FOR ALL
  USING (account_id = current_setting('app.current_account_id', true)::uuid);
`;

export const rlsFullSetupSql = `${rlsEnableSql}\n${rlsPolicySql}`;

// UUID validation regex
const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * Helper to set the current account ID for RLS context
 * Validates that accountId is a well-formed UUID before generating SQL
 * Use this in your application before database operations
 * @throws Error if accountId is not a valid UUID
 */
export const setAccountIdSql = (accountId: string): string => {
  if (!UUID_REGEX.test(accountId)) {
    throw new Error(`Invalid accountId: must be a valid UUID, received: ${accountId}`);
  }
  return `SET LOCAL app.current_account_id = '${accountId}';`;
};
