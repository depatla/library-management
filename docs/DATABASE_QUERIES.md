# Study Library Management System — Database Creation Queries

Copy the SQL blocks below and run them with `psql` (or any Postgres client) wherever you need
to stand up this schema. Run them **in order** — each section depends on objects created by the
one before it.

---

## 0. Create the database

Run this from the `postgres` maintenance database (or any existing DB), as a superuser /
admin role. You cannot run this inside a transaction with the rest of the script, so it's kept
separate — connect to the new database before running Section 1 onward.

```sql
CREATE DATABASE study_library
  WITH ENCODING = 'UTF8'
  LC_COLLATE = 'en_US.UTF-8'
  LC_CTYPE = 'en_US.UTF-8'
  TEMPLATE = template0;
```

Then connect to it:

```sql
\c study_library
```

---

## 1. Extensions

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;     -- case-insensitive email columns
```

---

## 2. Shared trigger function (`updated_at` maintenance)

```sql
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## 3. Enum types

```sql
CREATE TYPE library_status          AS ENUM ('trial', 'active', 'suspended', 'cancelled');
CREATE TYPE theme_mode              AS ENUM ('light', 'dark');
CREATE TYPE membership_status       AS ENUM ('invited', 'active', 'suspended');
CREATE TYPE subscription_status     AS ENUM ('trialing', 'active', 'past_due', 'cancelled');
CREATE TYPE cabin_status            AS ENUM ('available', 'occupied', 'reserved', 'maintenance');
CREATE TYPE student_status          AS ENUM ('active', 'inactive', 'expired', 'suspended');
CREATE TYPE payment_frequency       AS ENUM ('daily', 'weekly', 'monthly', 'quarterly', 'half_yearly', 'yearly');
CREATE TYPE payment_method          AS ENUM ('cash', 'upi', 'card', 'bank_transfer', 'other');
CREATE TYPE whatsapp_template_type  AS ENUM ('welcome', 'payment_reminder', 'renewal_reminder', 'expiry_reminder', 'thank_you', 'custom');
CREATE TYPE whatsapp_message_status AS ENUM ('queued', 'sent', 'delivered', 'failed', 'read');
CREATE TYPE complaint_type          AS ENUM ('complaint', 'suggestion');
CREATE TYPE complaint_priority      AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE complaint_status        AS ENUM ('open', 'in_progress', 'resolved', 'closed');
CREATE TYPE qr_code_type            AS ENUM ('seat_availability', 'complaint');
CREATE TYPE enquiry_status          AS ENUM ('new', 'contacted', 'converted', 'closed');
```

---

## 4. Identity & Access

### 4.1 `roles` (global, seeded)

```sql
CREATE TABLE roles (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           VARCHAR(50) NOT NULL UNIQUE,
  description    TEXT,
  is_assignable  BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 4.2 `users` (global)

```sql
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
```

### 4.3 `refresh_tokens`

```sql
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
```

---

## 5. Tenancy & Subscription

### 5.1 `libraries` (the tenant root)

```sql
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
```

### 5.2 `user_library_memberships` (M:N, role scoped per library)

```sql
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
```

### 5.3 `audit_logs` (append-only; nullable `library_id` for platform-level actions)

```sql
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
```

### 5.4 `subscription_plans` (global)

```sql
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
```

### 5.5 `library_subscriptions`

```sql
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
```

### 5.6 `library_twilio_configs`

```sql
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
```

---

## 6. Rooms & Seats

### 6.1 `room_categories`

```sql
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
```

### 6.2 `cabins` (seats)

```sql
CREATE TABLE cabins (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id         UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  room_category_id   UUID NOT NULL REFERENCES room_categories(id) ON DELETE RESTRICT,
  cabin_number       VARCHAR(20) NOT NULL,
  capacity           SMALLINT NOT NULL DEFAULT 1,
  status             cabin_status NOT NULL DEFAULT 'available',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_cabin_number UNIQUE (library_id, room_category_id, cabin_number),
  CONSTRAINT chk_cabin_capacity CHECK (capacity > 0)
);

CREATE INDEX idx_cabins_library_status ON cabins (library_id, status);
CREATE INDEX idx_cabins_room_category ON cabins (room_category_id);

CREATE TRIGGER trg_cabins_updated_at
  BEFORE UPDATE ON cabins
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

---

## 7. Students

`cabin_id` lives here — the single source of truth for seat occupancy (no duplicate FK on `cabins`).

```sql
CREATE TABLE students (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id                UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  cabin_id                  UUID REFERENCES cabins(id) ON DELETE SET NULL,
  full_name                 VARCHAR(150) NOT NULL,
  phone                     VARCHAR(20) NOT NULL,
  whatsapp_number           VARCHAR(20),
  email                     CITEXT,
  address                   TEXT,
  college                   VARCHAR(150),
  course                    VARCHAR(150),
  photo_url                 TEXT,
  id_proof_url              TEXT,
  emergency_contact_name    VARCHAR(150),
  emergency_contact_phone   VARCHAR(20),
  joined_date               DATE NOT NULL,
  expiry_date               DATE NOT NULL,
  status                    student_status NOT NULL DEFAULT 'active',
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at                TIMESTAMPTZ,
  CONSTRAINT chk_student_dates CHECK (expiry_date >= joined_date)
);

CREATE UNIQUE INDEX uq_students_library_phone ON students (library_id, phone) WHERE deleted_at IS NULL;
CREATE INDEX idx_students_library_status ON students (library_id, status);
CREATE INDEX idx_students_expiry ON students (library_id, expiry_date);
CREATE INDEX idx_students_cabin ON students (cabin_id);

CREATE TRIGGER trg_students_updated_at
  BEFORE UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

---

## 8. Payments & Revenue Recognition

### 8.1 `payments` (what the student actually paid, once)

```sql
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
```

### 8.2 `payment_allocations` (revenue recognition fan-out)

The `library_id`/`student_id` duplication here is a deliberate, documented denormalization — every
report query filters this table directly and it is never updated after creation.

```sql
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
```

### 8.3 `expense_categories` (nullable `library_id` = global default category)

```sql
CREATE TABLE expense_categories (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id   UUID REFERENCES libraries(id) ON DELETE CASCADE,
  name         VARCHAR(100) NOT NULL,
  is_default   BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_expense_category_tenant ON expense_categories (library_id, name) WHERE library_id IS NOT NULL;
CREATE UNIQUE INDEX uq_expense_category_global ON expense_categories (name) WHERE library_id IS NULL;
```

### 8.4 `expenses`

```sql
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
```

---

## 9. Communication (WhatsApp)

### 9.1 `whatsapp_templates`

```sql
CREATE TABLE whatsapp_templates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id   UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  type         whatsapp_template_type NOT NULL,
  name         VARCHAR(100) NOT NULL,
  content      TEXT NOT NULL,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_whatsapp_template_system_type ON whatsapp_templates (library_id, type) WHERE type != 'custom';
CREATE INDEX idx_whatsapp_templates_library ON whatsapp_templates (library_id);

CREATE TRIGGER trg_whatsapp_templates_updated_at
  BEFORE UPDATE ON whatsapp_templates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

### 9.2 `whatsapp_messages` (send log)

```sql
CREATE TABLE whatsapp_messages (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id             UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  student_id             UUID REFERENCES students(id) ON DELETE SET NULL,
  template_id            UUID REFERENCES whatsapp_templates(id) ON DELETE SET NULL,
  phone                  VARCHAR(20) NOT NULL,
  message_body           TEXT NOT NULL,
  status                 whatsapp_message_status NOT NULL DEFAULT 'queued',
  provider_message_sid   VARCHAR(100),
  error_message          TEXT,
  sent_at                TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wa_messages_library_status ON whatsapp_messages (library_id, status);
CREATE INDEX idx_wa_messages_sid ON whatsapp_messages (provider_message_sid);
CREATE INDEX idx_wa_messages_student ON whatsapp_messages (student_id);
```

---

## 10. QR, Enquiries & Complaints

### 10.1 `qr_codes`

```sql
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
```

### 10.2 `enquiries`

```sql
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
```

### 10.3 `complaints`

```sql
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
```

---

## 11. AI Assistant

```sql
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
```

---

## 12. Row Level Security

Applied to every tenant-scoped table. The `app_tenant` DB role (used by the FastAPI connection
pool) has RLS enforced; a separate `app_super_admin` role is granted `BYPASSRLS` for legitimate
cross-tenant platform operations.

Standard tenant tables — strict `library_id` match, applied via a loop so all 14 tables get an
identical policy in one step:

```sql
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'user_library_memberships', 'library_subscriptions', 'library_twilio_configs',
    'room_categories', 'cabins', 'students', 'payments', 'payment_allocations',
    'expenses', 'whatsapp_templates', 'whatsapp_messages', 'qr_codes',
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
```

`libraries` — the tenant root itself, matched on its own `id`:

```sql
ALTER TABLE libraries ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON libraries
  FOR ALL USING (id = current_setting('app.current_library_id', true)::uuid);
```

Nullable `library_id` tables — global rows stay visible to every tenant:

```sql
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
```

`roles`, `users`, `refresh_tokens`, `subscription_plans` are global — no RLS applied.

---

## 13. Seed data (global lookups only)

```sql
INSERT INTO roles (name, description, is_assignable) VALUES
  ('super_admin',    'Platform operator with cross-tenant access', false),
  ('library_owner',  'Owns and fully administers one or more libraries', true),
  ('manager',        'Manages day-to-day library operations', true),
  ('staff',          'Front-desk / operational staff', true),
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
```

> `room_categories` (Green, Red, Orange, Yellow, Blue, Entrance, Small) are seeded **per-library**
> at library-creation time by the application's `LibraryService`, not here — they require a
> `library_id` and are covered in Module 7 (Library Management).

---

## Quick reference — run order

1. Create database (§0) → connect to it
2. Extensions (§1)
3. Trigger function (§2)
4. Enum types (§3)
5. Identity & Access tables (§4): `roles` → `users` → `refresh_tokens`
6. Tenancy tables (§5): `libraries` → `user_library_memberships` → `audit_logs` → `subscription_plans` → `library_subscriptions` → `library_twilio_configs`
7. Rooms & Seats (§6): `room_categories` → `cabins`
8. Students (§7)
9. Payments (§8): `payments` → `payment_allocations` → `expense_categories` → `expenses`
10. Communication (§9): `whatsapp_templates` → `whatsapp_messages`
11. QR/Enquiries/Complaints (§10): `qr_codes` → `enquiries` → `complaints`
12. AI Assistant (§11): `ai_query_logs`
13. Row Level Security (§12)
14. Seed data (§13)

A single-file copy of everything above (in run order) also lives at
[database/schema.sql](../database/schema.sql) if you'd rather pipe the whole thing to `psql` in
one shot: `psql -U <admin_user> -d study_library -f database/schema.sql`.
