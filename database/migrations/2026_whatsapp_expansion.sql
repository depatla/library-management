-- WhatsApp/Twilio feature expansion — schema migration
-- Run this against the existing database in pgAdmin.
--
-- IMPORTANT: run in TWO steps, not as one script:
--   1. Run the "STEP 1" block below and commit it (pgAdmin: Execute Script commits
--      automatically if autocommit is on; otherwise click Commit before continuing).
--      Postgres does not allow a new enum value to be used in the same transaction
--      that added it, so STEP 2 will fail if run together with STEP 1 in one transaction.
--   2. Then run the "STEP 2" block.
--
-- Safe to run once against a fresh dev DB that already has schema.sql applied.

-- ============================================================================
-- STEP 1 — new enum values (run this block first, then commit)
-- ============================================================================

ALTER TYPE whatsapp_message_status ADD VALUE IF NOT EXISTS 'opted_out';

CREATE TYPE whatsapp_message_direction AS ENUM ('outbound', 'inbound');
CREATE TYPE whatsapp_broadcast_status AS ENUM ('pending', 'in_progress', 'completed', 'completed_with_errors');
CREATE TYPE whatsapp_broadcast_recipient_status AS ENUM ('pending', 'sent', 'failed', 'skipped');

-- ============================================================================
-- STEP 2 — table alterations, new tables, indexes, RLS (run after Step 1 commits)
-- ============================================================================

-- whatsapp_templates: Content API support
ALTER TABLE whatsapp_templates ADD COLUMN IF NOT EXISTS content_sid VARCHAR(100);
ALTER TABLE whatsapp_templates ADD COLUMN IF NOT EXISTS variable_mapping JSONB NOT NULL DEFAULT '{}'::jsonb;

-- whatsapp_messages: direction, retry tracking, persisted content variables
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS direction whatsapp_message_direction NOT NULL DEFAULT 'outbound';
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS retry_count INT NOT NULL DEFAULT 0;
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ;
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS content_variables JSONB;

-- students: opt-out tracking
ALTER TABLE students ADD COLUMN IF NOT EXISTS whatsapp_opted_out BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE students ADD COLUMN IF NOT EXISTS whatsapp_opted_out_at TIMESTAMPTZ;

-- whatsapp_broadcasts: the batch/job record
CREATE TABLE IF NOT EXISTS whatsapp_broadcasts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id     UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  template_id    UUID NOT NULL REFERENCES whatsapp_templates(id) ON DELETE RESTRICT,
  name           VARCHAR(150) NOT NULL,
  status         whatsapp_broadcast_status NOT NULL DEFAULT 'pending',
  total_count    INT NOT NULL DEFAULT 0,
  sent_count     INT NOT NULL DEFAULT 0,
  failed_count   INT NOT NULL DEFAULT 0,
  skipped_count  INT NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_wa_broadcasts_library_status ON whatsapp_broadcasts (library_id, status);

-- whatsapp_broadcast_recipients: per-recipient fan-out
CREATE TABLE IF NOT EXISTS whatsapp_broadcast_recipients (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id  UUID NOT NULL REFERENCES whatsapp_broadcasts(id) ON DELETE CASCADE,
  library_id    UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  student_id    UUID REFERENCES students(id) ON DELETE SET NULL,
  phone         VARCHAR(20) NOT NULL,
  status        whatsapp_broadcast_recipient_status NOT NULL DEFAULT 'pending',
  message_id    UUID REFERENCES whatsapp_messages(id) ON DELETE SET NULL,
  error_message TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_broadcast_recipients_pending
  ON whatsapp_broadcast_recipients (broadcast_id, status) WHERE status = 'pending';

-- RLS for the two new tenant tables — same tenant_isolation pattern as the rest of schema.sql
ALTER TABLE whatsapp_broadcasts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON whatsapp_broadcasts;
CREATE POLICY tenant_isolation ON whatsapp_broadcasts
  FOR ALL USING (library_id = current_setting('app.current_library_id', true)::uuid);

ALTER TABLE whatsapp_broadcast_recipients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON whatsapp_broadcast_recipients;
CREATE POLICY tenant_isolation ON whatsapp_broadcast_recipients
  FOR ALL USING (library_id = current_setting('app.current_library_id', true)::uuid);
