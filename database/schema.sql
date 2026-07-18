-- ============================================================================
-- Study Library Management System — Database Schema
-- Generated from docs/DATABASE_DESIGN.md (Module 2)
--
-- Run as: psql -U <admin_user> -d study_library -f database/schema.sql
-- Assumes the target database already exists (see §0 below to create it).
-- ============================================================================


-- ============================================================================
-- 0. CREATE DATABASE
-- Run this section from the `postgres` maintenance database, as a superuser,
-- BEFORE connecting to study_library and running the rest of this file.
-- ============================================================================
-- CREATE DATABASE study_library
--   WITH ENCODING = 'UTF8'
--   LC_COLLATE = 'en_US.UTF-8'
--   LC_CTYPE = 'en_US.UTF-8'
--   TEMPLATE = template0;
--
-- \c study_library


-- ============================================================================
-- 1. EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;     -- case-insensitive email columns


-- ============================================================================
-- 2. SHARED TRIGGER FUNCTION (updated_at maintenance)
-- ============================================================================
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- 3. ENUM TYPES
-- ============================================================================
CREATE TYPE library_status          AS ENUM ('trial', 'active', 'suspended', 'cancelled');
CREATE TYPE theme_mode              AS ENUM ('light', 'dark');
CREATE TYPE membership_status       AS ENUM ('invited', 'active', 'suspended');
CREATE TYPE subscription_status     AS ENUM ('trialing', 'active', 'past_due', 'cancelled');
CREATE TYPE cabin_status            AS ENUM ('available', 'occupied', 'reserved', 'maintenance');
CREATE TYPE student_status          AS ENUM ('active', 'inactive', 'expired', 'suspended');
CREATE TYPE student_gender          AS ENUM ('male', 'female', 'other');
CREATE TYPE payment_frequency       AS ENUM ('daily', 'monthly');
CREATE TYPE payment_method          AS ENUM ('cash', 'upi', 'card', 'bank_transfer', 'other');
CREATE TYPE whatsapp_template_type  AS ENUM ('welcome', 'payment_reminder', 'renewal_reminder', 'expiry_reminder', 'thank_you', 'custom');
CREATE TYPE whatsapp_message_status AS ENUM ('queued', 'sent', 'delivered', 'failed', 'read', 'opted_out');
CREATE TYPE whatsapp_message_direction AS ENUM ('outbound', 'inbound');
CREATE TYPE whatsapp_broadcast_status AS ENUM ('pending', 'in_progress', 'completed', 'completed_with_errors');
CREATE TYPE whatsapp_broadcast_recipient_status AS ENUM ('pending', 'sent', 'failed', 'skipped');
CREATE TYPE complaint_type          AS ENUM ('complaint', 'suggestion');
CREATE TYPE complaint_priority      AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE complaint_status        AS ENUM ('open', 'in_progress', 'resolved', 'closed');
CREATE TYPE qr_code_type            AS ENUM ('seat_availability', 'complaint');
CREATE TYPE enquiry_status          AS ENUM ('new', 'contacted', 'converted', 'closed');


-- ============================================================================
-- 4. IDENTITY & ACCESS
-- ============================================================================

-- 4.1 roles (global, seeded)
CREATE TABLE roles (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           VARCHAR(50) NOT NULL UNIQUE,
  description    TEXT,
  is_assignable  BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4.2 users (global)
CREATE TABLE users (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name          VARCHAR(150) NOT NULL,
  email              CITEXT NOT NULL,
  phone              VARCHAR(20),
  password_hash      VARCHAR(255) NOT NULL,
  avatar_url         TEXT,
  is_super_admin     BOOLEAN NOT NULL DEFAULT false,
  is_active          BOOLEAN NOT NULL DEFAULT true,
  email_verified_at  TIMESTAMPTZ,
  phone_verified_at  TIMESTAMPTZ,
  last_login_at      TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at         TIMESTAMPTZ,
  CONSTRAINT uq_users_email UNIQUE (email)
);

CREATE UNIQUE INDEX uq_users_phone ON users (phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_users_active ON users (id) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 4.3 refresh_tokens
CREATE TABLE refresh_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   VARCHAR(255) NOT NULL UNIQUE,
  device_info  VARCHAR(255),
  ip_address   INET,
  expires_at   TIMESTAMPTZ NOT NULL,
  revoked_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens (user_id);
CREATE INDEX idx_refresh_tokens_active ON refresh_tokens (token_hash) WHERE revoked_at IS NULL;


-- ============================================================================
-- 5. TENANCY & SUBSCRIPTION
-- ============================================================================

-- 5.1 libraries (the tenant root)
CREATE TABLE libraries (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  name             VARCHAR(150) NOT NULL,
  slug             VARCHAR(160) NOT NULL UNIQUE,
  address_line1    VARCHAR(255),
  address_line2    VARCHAR(255),
  city             VARCHAR(100),
  state            VARCHAR(100),
  postal_code      VARCHAR(20),
  country          VARCHAR(2) NOT NULL DEFAULT 'IN',
  phone            VARCHAR(20),
  email            CITEXT,
  logo_url         TEXT,
  banner_url       TEXT,
  primary_color    VARCHAR(7) NOT NULL DEFAULT '#1976d2',
  secondary_color  VARCHAR(7) NOT NULL DEFAULT '#9c27b0',
  theme_mode       theme_mode NOT NULL DEFAULT 'light',
  currency         VARCHAR(3) NOT NULL DEFAULT 'INR',
  timezone         VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
  status           library_status NOT NULL DEFAULT 'trial',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMPTZ
);

CREATE INDEX idx_libraries_owner ON libraries (owner_id);
CREATE INDEX idx_libraries_active ON libraries (id) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_libraries_updated_at
  BEFORE UPDATE ON libraries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 5.2 user_library_memberships (M:N, role scoped per library)
CREATE TABLE user_library_memberships (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  library_id  UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  role_id     UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  status      membership_status NOT NULL DEFAULT 'invited',
  invited_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  joined_at   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_membership_user_library UNIQUE (user_id, library_id)
);

CREATE INDEX idx_memberships_library ON user_library_memberships (library_id);
CREATE INDEX idx_memberships_user ON user_library_memberships (user_id);

CREATE TRIGGER trg_memberships_updated_at
  BEFORE UPDATE ON user_library_memberships
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 5.3 audit_logs (append-only; nullable library_id for platform-level actions)
CREATE TABLE audit_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id     UUID REFERENCES libraries(id) ON DELETE SET NULL,
  actor_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  action         VARCHAR(100) NOT NULL,
  entity_type    VARCHAR(100) NOT NULL,
  entity_id      UUID,
  before_data    JSONB,
  after_data     JSONB,
  ip_address     INET,
  user_agent     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_library_created ON audit_logs (library_id, created_at DESC);
CREATE INDEX idx_audit_entity ON audit_logs (entity_type, entity_id);

-- 5.4 subscription_plans (global)
CREATE TABLE subscription_plans (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           VARCHAR(50) NOT NULL UNIQUE,
  price          NUMERIC(10,2) NOT NULL,
  billing_cycle  VARCHAR(20) NOT NULL,
  max_students   INTEGER,
  max_rooms      INTEGER,
  features       JSONB NOT NULL DEFAULT '{}',
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5.5 library_subscriptions
CREATE TABLE library_subscriptions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id             UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  plan_id                UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
  status                 subscription_status NOT NULL DEFAULT 'trialing',
  current_period_start   DATE NOT NULL,
  current_period_end     DATE NOT NULL,
  trial_ends_at          TIMESTAMPTZ,
  cancelled_at           TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_library_subscription UNIQUE (library_id)
);

CREATE INDEX idx_lib_sub_status ON library_subscriptions (status);

CREATE TRIGGER trg_library_subscriptions_updated_at
  BEFORE UPDATE ON library_subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 5.6 library_twilio_configs
CREATE TABLE library_twilio_configs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id        UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  account_sid       VARCHAR(255) NOT NULL,
  auth_token        VARCHAR(255) NOT NULL,
  whatsapp_number   VARCHAR(20) NOT NULL,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_library_twilio_config UNIQUE (library_id)
);

CREATE TRIGGER trg_library_twilio_configs_updated_at
  BEFORE UPDATE ON library_twilio_configs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================================
-- 6. ROOMS & SEATS
-- ============================================================================

-- 6.1 room_categories
CREATE TABLE room_categories (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id     UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  name           VARCHAR(50) NOT NULL,
  color_code     VARCHAR(7),
  is_ac          BOOLEAN NOT NULL DEFAULT true,
  is_ac_locked   BOOLEAN NOT NULL DEFAULT false,
  is_default     BOOLEAN NOT NULL DEFAULT false,
  display_order  SMALLINT NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_room_category_name UNIQUE (library_id, name),
  CONSTRAINT chk_room_category_ac_lock CHECK (NOT is_ac_locked OR is_ac = false)
);

CREATE INDEX idx_room_categories_library ON room_categories (library_id);

CREATE TRIGGER trg_room_categories_updated_at
  BEFORE UPDATE ON room_categories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 6.2 cabins (seats)
CREATE TABLE cabins (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id         UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  room_category_id   UUID NOT NULL REFERENCES room_categories(id) ON DELETE RESTRICT,
  cabin_number       VARCHAR(20) NOT NULL,
  capacity           SMALLINT NOT NULL DEFAULT 1,
  status             cabin_status NOT NULL DEFAULT 'available',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_cabin_number UNIQUE (library_id, cabin_number),
  CONSTRAINT chk_cabin_capacity CHECK (capacity > 0)
);

CREATE INDEX idx_cabins_library_status ON cabins (library_id, status);
CREATE INDEX idx_cabins_room_category ON cabins (room_category_id);

CREATE TRIGGER trg_cabins_updated_at
  BEFORE UPDATE ON cabins
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 6.3 lockers (independent rentable inventory — a student may rent a locker
-- with or without also holding a cabin; own numbering series, own rent)
CREATE TABLE lockers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id     UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  locker_number  VARCHAR(20) NOT NULL,
  monthly_rent   NUMERIC(10,2) NOT NULL DEFAULT 0,
  status         cabin_status NOT NULL DEFAULT 'available',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_locker_number UNIQUE (library_id, locker_number)
);

CREATE INDEX idx_lockers_library_status ON lockers (library_id, status);

CREATE TRIGGER trg_lockers_updated_at
  BEFORE UPDATE ON lockers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================================
-- 7. STUDENTS
-- (cabin_id lives here — the single source of truth for seat occupancy)
-- ============================================================================
CREATE TABLE students (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id                UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  cabin_id                  UUID REFERENCES cabins(id) ON DELETE SET NULL,
  locker_id                 UUID REFERENCES lockers(id) ON DELETE SET NULL,
  full_name                 VARCHAR(150) NOT NULL,
  phone                     VARCHAR(20) NOT NULL,
  whatsapp_number           VARCHAR(20),
  email                     CITEXT,
  gender                    student_gender,
  address                   TEXT,
  photo_url                 TEXT,
  id_proof_url              TEXT,
  emergency_contact_name    VARCHAR(150),
  emergency_contact_phone   VARCHAR(20),
  status                    student_status NOT NULL DEFAULT 'active',
  whatsapp_opted_out        BOOLEAN NOT NULL DEFAULT false,
  whatsapp_opted_out_at     TIMESTAMPTZ,
  created_by                UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at                TIMESTAMPTZ
);

CREATE UNIQUE INDEX uq_students_library_phone ON students (library_id, phone) WHERE deleted_at IS NULL;
CREATE INDEX idx_students_library_status ON students (library_id, status);
CREATE INDEX idx_students_cabin ON students (cabin_id);
CREATE INDEX idx_students_locker ON students (locker_id);

CREATE TRIGGER trg_students_updated_at
  BEFORE UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================================
-- 8. PAYMENTS & REVENUE RECOGNITION
-- ============================================================================

-- 8.1 payments (what the student actually paid, once)
CREATE TABLE payments (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id              UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  student_id              UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  amount                  NUMERIC(12,2) NOT NULL,
  frequency               payment_frequency NOT NULL,
  period_start            DATE NOT NULL,
  period_end              DATE NOT NULL,
  payment_method          payment_method NOT NULL,
  transaction_reference   VARCHAR(255),
  collected_by            UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  notes                   TEXT,
  paid_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_payment_amount CHECK (amount > 0),
  CONSTRAINT chk_payment_period CHECK (period_end > period_start)
);

CREATE INDEX idx_payments_library_paid_at ON payments (library_id, paid_at);
CREATE INDEX idx_payments_student ON payments (student_id);

CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 8.2 payment_allocations (revenue recognition fan-out; see docs §9 for the
-- justified denormalization of library_id / student_id)
CREATE TABLE payment_allocations (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id         UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  library_id         UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  student_id         UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  period_month       DATE NOT NULL,
  allocated_amount   NUMERIC(12,2) NOT NULL,
  is_prorated        BOOLEAN NOT NULL DEFAULT false,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_allocation_payment_month UNIQUE (payment_id, period_month),
  CONSTRAINT chk_allocation_amount CHECK (allocated_amount > 0),
  CONSTRAINT chk_allocation_period_month CHECK (period_month = date_trunc('month', period_month)::date)
);

CREATE INDEX idx_alloc_library_month ON payment_allocations (library_id, period_month);
CREATE INDEX idx_alloc_student ON payment_allocations (student_id);

-- 8.3 expense_categories (nullable library_id = global default category)
CREATE TABLE expense_categories (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id   UUID REFERENCES libraries(id) ON DELETE CASCADE,
  name         VARCHAR(100) NOT NULL,
  is_default   BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_expense_category_tenant ON expense_categories (library_id, name) WHERE library_id IS NOT NULL;
CREATE UNIQUE INDEX uq_expense_category_global ON expense_categories (name) WHERE library_id IS NULL;

-- 8.4 expenses
CREATE TABLE expenses (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id     UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  category_id    UUID NOT NULL REFERENCES expense_categories(id) ON DELETE RESTRICT,
  amount         NUMERIC(12,2) NOT NULL,
  expense_date   DATE NOT NULL,
  description    TEXT,
  receipt_url    TEXT,
  paid_to        VARCHAR(150),
  recorded_by    UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_expense_amount CHECK (amount > 0)
);

CREATE INDEX idx_expenses_library_date ON expenses (library_id, expense_date);
CREATE INDEX idx_expenses_category ON expenses (category_id);

CREATE TRIGGER trg_expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 8.5 library_partners (co-owners/investors splitting a library's monthly
-- profit; user_id links to a real login when the partner is also an operator
-- of the app via user_library_memberships — nullable because a purely
-- financial/investor-only partner with no login access remains supported)
CREATE TABLE library_partners (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id        UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  user_id           UUID REFERENCES users(id) ON DELETE SET NULL,
  name              VARCHAR(150) NOT NULL,
  phone             VARCHAR(20),
  share_percentage  NUMERIC(5,2) NOT NULL,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_partner_share_percentage CHECK (share_percentage > 0 AND share_percentage <= 100)
);

CREATE INDEX idx_library_partners_library ON library_partners (library_id);

CREATE TRIGGER trg_library_partners_updated_at
  BEFORE UPDATE ON library_partners
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 8.6 partner_settlements (one row per payout to a partner against a given
-- month's profit share; running balance = share_amount - sum(received))
CREATE TABLE partner_settlements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id      UUID NOT NULL REFERENCES library_partners(id) ON DELETE CASCADE,
  library_id      UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  period_month    DATE NOT NULL,
  share_amount    NUMERIC(12,2) NOT NULL,
  received_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  settled_at      TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_settlement_partner_month UNIQUE (partner_id, period_month),
  CONSTRAINT chk_settlement_period_month CHECK (period_month = date_trunc('month', period_month)::date)
);

CREATE INDEX idx_settlements_library_month ON partner_settlements (library_id, period_month);
CREATE INDEX idx_settlements_partner ON partner_settlements (partner_id);

CREATE TRIGGER trg_partner_settlements_updated_at
  BEFORE UPDATE ON partner_settlements
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================================
-- 9. COMMUNICATION (WhatsApp)
-- ============================================================================

-- 9.1 whatsapp_templates
CREATE TABLE whatsapp_templates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id   UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  type         whatsapp_template_type NOT NULL,
  name         VARCHAR(100) NOT NULL,
  content      TEXT NOT NULL,
  content_sid  VARCHAR(100),
  variable_mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_whatsapp_template_system_type ON whatsapp_templates (library_id, type) WHERE type != 'custom';
CREATE INDEX idx_whatsapp_templates_library ON whatsapp_templates (library_id);

CREATE TRIGGER trg_whatsapp_templates_updated_at
  BEFORE UPDATE ON whatsapp_templates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 9.2 whatsapp_messages (send log)
CREATE TABLE whatsapp_messages (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id             UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  student_id             UUID REFERENCES students(id) ON DELETE SET NULL,
  template_id            UUID REFERENCES whatsapp_templates(id) ON DELETE SET NULL,
  direction              whatsapp_message_direction NOT NULL DEFAULT 'outbound',
  phone                  VARCHAR(20) NOT NULL,
  message_body           TEXT NOT NULL,
  content_variables      JSONB,
  status                 whatsapp_message_status NOT NULL DEFAULT 'queued',
  provider_message_sid   VARCHAR(100),
  error_message          TEXT,
  retry_count            INT NOT NULL DEFAULT 0,
  last_attempt_at        TIMESTAMPTZ,
  sent_at                TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wa_messages_library_status ON whatsapp_messages (library_id, status);
CREATE INDEX idx_wa_messages_sid ON whatsapp_messages (provider_message_sid);
CREATE INDEX idx_wa_messages_student ON whatsapp_messages (student_id);

-- 9.3 whatsapp_broadcasts (batch send job record)
CREATE TABLE whatsapp_broadcasts (
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

CREATE INDEX idx_wa_broadcasts_library_status ON whatsapp_broadcasts (library_id, status);

-- 9.4 whatsapp_broadcast_recipients (per-recipient fan-out)
CREATE TABLE whatsapp_broadcast_recipients (
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

CREATE INDEX idx_wa_broadcast_recipients_pending ON whatsapp_broadcast_recipients (broadcast_id, status) WHERE status = 'pending';


-- ============================================================================
-- 10. QR, ENQUIRIES & COMPLAINTS
-- ============================================================================

-- 10.1 qr_codes
CREATE TABLE qr_codes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id    UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  type          qr_code_type NOT NULL,
  target_path   VARCHAR(255) NOT NULL,
  image_url     TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_qr_code_type UNIQUE (library_id, type)
);

CREATE TRIGGER trg_qr_codes_updated_at
  BEFORE UPDATE ON qr_codes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 10.2 enquiries
CREATE TABLE enquiries (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id   UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  name         VARCHAR(150) NOT NULL,
  phone        VARCHAR(20) NOT NULL,
  message      TEXT,
  status       enquiry_status NOT NULL DEFAULT 'new',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_enquiries_library_status ON enquiries (library_id, status);

CREATE TRIGGER trg_enquiries_updated_at
  BEFORE UPDATE ON enquiries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 10.3 complaints
CREATE TABLE complaints (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id       UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  student_id       UUID REFERENCES students(id) ON DELETE SET NULL,
  complaint_type   complaint_type NOT NULL,
  description      TEXT NOT NULL,
  photo_url        TEXT,
  priority         complaint_priority NOT NULL DEFAULT 'medium',
  status           complaint_status NOT NULL DEFAULT 'open',
  resolved_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_complaints_library_status ON complaints (library_id, status);
CREATE INDEX idx_complaints_student ON complaints (student_id);

CREATE TRIGGER trg_complaints_updated_at
  BEFORE UPDATE ON complaints
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================================
-- 11. AI ASSISTANT
-- ============================================================================
CREATE TABLE ai_query_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id       UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question         TEXT NOT NULL,
  matched_intent   VARCHAR(100) NOT NULL,
  context_data     JSONB NOT NULL,
  answer           TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_logs_library_created ON ai_query_logs (library_id, created_at DESC);


-- ============================================================================
-- 12. ROW LEVEL SECURITY
-- Applied to every tenant-scoped table. The `app_tenant` role (used by the
-- FastAPI connection pool) has RLS enforced; a separate `app_super_admin`
-- role is granted BYPASSRLS for legitimate cross-tenant platform operations.
-- ============================================================================

-- Standard tenant tables: strict library_id match
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'user_library_memberships', 'library_subscriptions', 'library_twilio_configs',
    'room_categories', 'cabins', 'lockers', 'students', 'payments', 'payment_allocations',
    'expenses', 'library_partners', 'partner_settlements',
    'whatsapp_templates', 'whatsapp_messages', 'whatsapp_broadcasts', 'whatsapp_broadcast_recipients', 'qr_codes',
    'enquiries', 'complaints', 'ai_query_logs'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I FOR ALL USING (library_id = current_setting(''app.current_library_id'', true)::uuid)',
      t
    );
  END LOOP;
END $$;

-- libraries: the tenant root itself, matched on its own id
ALTER TABLE libraries ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON libraries
  FOR ALL USING (id = current_setting('app.current_library_id', true)::uuid);

-- Nullable library_id tables: global rows remain visible to every tenant
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON audit_logs
  FOR ALL USING (
    library_id IS NULL
    OR library_id = current_setting('app.current_library_id', true)::uuid
  );

ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON expense_categories
  FOR ALL USING (
    library_id IS NULL
    OR library_id = current_setting('app.current_library_id', true)::uuid
  );

-- roles, users, refresh_tokens, subscription_plans: global, no RLS.


-- ============================================================================
-- 13. SEED DATA — global lookups only
-- ============================================================================

INSERT INTO roles (name, description, is_assignable) VALUES
  ('super_admin',    'Platform operator with cross-tenant access', false),
  ('library_owner',  'Owns and fully administers one or more libraries', true),
  ('manager',        'Manages day-to-day library operations', true),
  ('staff',          'Front-desk / operational staff', true),
  ('partner',        'Revenue-share partner with full operational access', true),
  ('student',        'Reserved for future student self-service portal', true);

INSERT INTO expense_categories (library_id, name, is_default) VALUES
  (NULL, 'Rent',          true),
  (NULL, 'Electricity',   true),
  (NULL, 'Water',         true),
  (NULL, 'Internet',      true),
  (NULL, 'Maintenance',   true),
  (NULL, 'Furniture',     true),
  (NULL, 'Marketing',     true),
  (NULL, 'Salary',        true),
  (NULL, 'Cleaning',      true),
  (NULL, 'Miscellaneous', true);

-- Note: room_categories are seeded per-library (Green, Red, Orange, Yellow,
-- Blue, Entrance, Small) at library-creation time by the application's
-- LibraryService, not here — they require a library_id and are covered in
-- Module 7 (Library Management).

-- ============================================================================
-- End of schema
-- ============================================================================
