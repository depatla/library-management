# Study Library Management System — Database Design

**Module 2 of 20 — Database Design**
Depends on: [ARCHITECTURE.md](./ARCHITECTURE.md) (multi-tenancy model, proration engine, AI flow)
Produces input for: Module 3 (ER Diagram), and is implemented incrementally as SQLAlchemy
models + Alembic migrations in Modules 5–18 (each feature module owns the tables it needs).

---

## 1. Design Principles

1. **3NF minimum** on every table. The one intentional exception (`payment_allocations`
   duplicating `library_id` and `student_id`) is called out explicitly in §9 with its
   justification — it is a documented decision, not an oversight.
2. **UUID primary keys** (`gen_random_uuid()`, `pgcrypto` extension) — avoids ID enumeration in a
   product where IDs travel through public QR codes and URLs, and avoids leaking tenant business
   volume through sequential gaps.
3. **Every tenant-scoped table has a `library_id UUID NOT NULL` column**, indexed, FK to
   `libraries.id`, and an RLS policy (§10) — the database-level half of the isolation strategy
   from the architecture doc. Platform-global tables (`roles`, `subscription_plans`, default
   `expense_categories`) have no `library_id`.
4. **Native PostgreSQL ENUM types** for closed value sets — a status typo becomes a rejected
   `INSERT`, not a silent bad row.
5. **Soft delete** (`deleted_at TIMESTAMPTZ NULL`) on `libraries`, `users`, `students` — these are
   referenced by financial/audit history that must survive after the "delete". All FKs from
   history tables point at these rows regardless of `deleted_at`; app/repository layer filters
   `deleted_at IS NULL` for normal reads.
6. **`created_at` / `updated_at` on every table**, `updated_at` maintained by a shared trigger
   (`set_updated_at()`), not by application code — guarantees correctness even for direct DB
   writes (migrations, admin scripts).
7. **Money as `NUMERIC(12,2)`**, never float — financial correctness is non-negotiable.
8. **Naming**: tables plural snake_case, PK always `id`, FK always `<singular>_id`.

---

## 2. Extensions & Shared Objects

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- Attached via: CREATE TRIGGER trg_<table>_updated_at BEFORE UPDATE ON <table>
--               FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

---

## 3. ENUM Types

```sql
CREATE TYPE library_status        AS ENUM ('trial', 'active', 'suspended', 'cancelled');
CREATE TYPE theme_mode            AS ENUM ('light', 'dark');
CREATE TYPE membership_status     AS ENUM ('invited', 'active', 'suspended');
CREATE TYPE subscription_status   AS ENUM ('trialing', 'active', 'past_due', 'cancelled');
CREATE TYPE room_color            AS ENUM ('green', 'red', 'orange', 'yellow', 'blue');
                                    -- 'entrance' and 'small' are name-only categories, not colors;
                                    -- room_categories.name is free-text, seeded with these defaults
CREATE TYPE cabin_status          AS ENUM ('available', 'occupied', 'reserved', 'maintenance');
CREATE TYPE student_status        AS ENUM ('active', 'inactive', 'expired', 'suspended');
CREATE TYPE payment_frequency     AS ENUM ('daily', 'weekly', 'monthly', 'quarterly', 'half_yearly', 'yearly');
CREATE TYPE payment_method        AS ENUM ('cash', 'upi', 'card', 'bank_transfer', 'other');
CREATE TYPE whatsapp_template_type AS ENUM ('welcome', 'payment_reminder', 'renewal_reminder', 'expiry_reminder', 'thank_you', 'custom');
CREATE TYPE whatsapp_message_status AS ENUM ('queued', 'sent', 'delivered', 'failed', 'read');
CREATE TYPE complaint_type        AS ENUM ('complaint', 'suggestion');
CREATE TYPE complaint_priority    AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE complaint_status      AS ENUM ('open', 'in_progress', 'resolved', 'closed');
CREATE TYPE qr_code_type          AS ENUM ('seat_availability', 'complaint');
CREATE TYPE enquiry_status        AS ENUM ('new', 'contacted', 'converted', 'closed');
```

---

## 4. Domain: Identity & Access

### `roles` (global, seeded — not tenant-scoped)
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK, default `gen_random_uuid()` |
| name | VARCHAR(50) | NOT NULL, UNIQUE — `super_admin`, `library_owner`, `manager`, `staff`, `student` |
| description | TEXT | NULL |
| is_assignable | BOOLEAN | NOT NULL DEFAULT true — `super_admin` is seeded with `false`; never assignable via membership UI |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

### `users` (global — a user account, not tenant-scoped)
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| full_name | VARCHAR(150) | NOT NULL |
| email | CITEXT | NOT NULL, UNIQUE — case-insensitive |
| phone | VARCHAR(20) | UNIQUE, NULL |
| password_hash | VARCHAR(255) | NOT NULL — Argon2id |
| avatar_url | TEXT | NULL |
| is_super_admin | BOOLEAN | NOT NULL DEFAULT false |
| is_active | BOOLEAN | NOT NULL DEFAULT true |
| email_verified_at | TIMESTAMPTZ | NULL |
| phone_verified_at | TIMESTAMPTZ | NULL |
| last_login_at | TIMESTAMPTZ | NULL |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| deleted_at | TIMESTAMPTZ | NULL |

Indexes: `UNIQUE(email)`, `UNIQUE(phone) WHERE phone IS NOT NULL`, `idx_users_active ON users(id) WHERE deleted_at IS NULL`.

### `refresh_tokens`
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | NOT NULL, FK → `users(id)` ON DELETE CASCADE |
| token_hash | VARCHAR(255) | NOT NULL, UNIQUE — SHA-256 of the opaque token, never the raw token |
| device_info | VARCHAR(255) | NULL |
| ip_address | INET | NULL |
| expires_at | TIMESTAMPTZ | NOT NULL |
| revoked_at | TIMESTAMPTZ | NULL |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

Indexes: `idx_refresh_tokens_user ON refresh_tokens(user_id)`, `idx_refresh_tokens_active ON refresh_tokens(token_hash) WHERE revoked_at IS NULL`.

### `user_library_memberships` (the M:N join — one user, many libraries, role scoped per library)
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | NOT NULL, FK → `users(id)` ON DELETE CASCADE |
| library_id | UUID | NOT NULL, FK → `libraries(id)` ON DELETE CASCADE |
| role_id | UUID | NOT NULL, FK → `roles(id)` ON DELETE RESTRICT |
| status | membership_status | NOT NULL DEFAULT 'invited' |
| invited_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| joined_at | TIMESTAMPTZ | NULL |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

Constraints: `UNIQUE(user_id, library_id)` — a user has exactly one role per library.
Indexes: `idx_memberships_library ON user_library_memberships(library_id)`, `idx_memberships_user ON user_library_memberships(user_id)`.

### `audit_logs` (append-only, platform + tenant actions)
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| library_id | UUID | NULL, FK → `libraries(id)` ON DELETE SET NULL — NULL for platform-level actions |
| actor_user_id | UUID | NULL, FK → `users(id)` ON DELETE SET NULL |
| action | VARCHAR(100) | NOT NULL — e.g. `student.create`, `payment.record`, `member.role_change` |
| entity_type | VARCHAR(100) | NOT NULL |
| entity_id | UUID | NULL |
| before_data | JSONB | NULL |
| after_data | JSONB | NULL |
| ip_address | INET | NULL |
| user_agent | TEXT | NULL |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

Indexes: `idx_audit_library_created ON audit_logs(library_id, created_at DESC)`, `idx_audit_entity ON audit_logs(entity_type, entity_id)`. No `updated_at` — append-only by design, never mutated.

---

## 5. Domain: Tenancy & Subscription

### `libraries` (the tenant)
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| owner_id | UUID | NOT NULL, FK → `users(id)` ON DELETE RESTRICT |
| name | VARCHAR(150) | NOT NULL |
| slug | VARCHAR(160) | NOT NULL, UNIQUE — used in public QR/enquiry URLs |
| address_line1 | VARCHAR(255) | NULL |
| address_line2 | VARCHAR(255) | NULL |
| city | VARCHAR(100) | NULL |
| state | VARCHAR(100) | NULL |
| postal_code | VARCHAR(20) | NULL |
| country | VARCHAR(2) | NOT NULL DEFAULT 'IN' — ISO 3166-1 alpha-2 |
| phone | VARCHAR(20) | NULL |
| email | CITEXT | NULL |
| logo_url | TEXT | NULL |
| banner_url | TEXT | NULL |
| primary_color | VARCHAR(7) | NOT NULL DEFAULT '#1976d2' |
| secondary_color | VARCHAR(7) | NOT NULL DEFAULT '#9c27b0' |
| theme_mode | theme_mode | NOT NULL DEFAULT 'light' |
| currency | VARCHAR(3) | NOT NULL DEFAULT 'INR' — ISO 4217 |
| timezone | VARCHAR(50) | NOT NULL DEFAULT 'Asia/Kolkata' — IANA tz name, drives APScheduler triggers |
| status | library_status | NOT NULL DEFAULT 'trial' |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| deleted_at | TIMESTAMPTZ | NULL |

Indexes: `UNIQUE(slug)`, `idx_libraries_owner ON libraries(owner_id)`, `idx_libraries_active ON libraries(id) WHERE deleted_at IS NULL`.

### `subscription_plans` (global — platform's own pricing tiers, not tenant-scoped)
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| name | VARCHAR(50) | NOT NULL, UNIQUE |
| price | NUMERIC(10,2) | NOT NULL |
| billing_cycle | VARCHAR(20) | NOT NULL — `monthly` \| `yearly` |
| max_students | INTEGER | NULL — NULL = unlimited |
| max_rooms | INTEGER | NULL |
| features | JSONB | NOT NULL DEFAULT '{}' |
| is_active | BOOLEAN | NOT NULL DEFAULT true |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

### `library_subscriptions`
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| library_id | UUID | NOT NULL, FK → `libraries(id)` ON DELETE CASCADE |
| plan_id | UUID | NOT NULL, FK → `subscription_plans(id)` ON DELETE RESTRICT |
| status | subscription_status | NOT NULL DEFAULT 'trialing' |
| current_period_start | DATE | NOT NULL |
| current_period_end | DATE | NOT NULL |
| trial_ends_at | TIMESTAMPTZ | NULL |
| cancelled_at | TIMESTAMPTZ | NULL |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

Constraints: `UNIQUE(library_id)` — one active subscription record per library (history kept via a
separate `library_subscription_events` table if/when billing history is needed; out of scope for MVP).
Indexes: `idx_lib_sub_status ON library_subscriptions(status)`.

### `library_twilio_configs` (per-library WhatsApp credentials)
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| library_id | UUID | NOT NULL, FK → `libraries(id)` ON DELETE CASCADE |
| account_sid | VARCHAR(255) | NOT NULL — encrypted at rest (app-layer envelope encryption, not plaintext) |
| auth_token | VARCHAR(255) | NOT NULL — encrypted at rest |
| whatsapp_number | VARCHAR(20) | NOT NULL |
| is_active | BOOLEAN | NOT NULL DEFAULT true |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

Constraints: `UNIQUE(library_id)` — one Twilio config per library.

---

## 6. Domain: Rooms & Seats

### `room_categories`
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| library_id | UUID | NOT NULL, FK → `libraries(id)` ON DELETE CASCADE |
| name | VARCHAR(50) | NOT NULL — seeded defaults: Green, Red, Orange, Yellow, Blue, Entrance, Small |
| color_code | VARCHAR(7) | NULL — hex, for UI chip color |
| is_ac | BOOLEAN | NOT NULL DEFAULT true |
| is_ac_locked | BOOLEAN | NOT NULL DEFAULT false — `true` for Entrance/Small, permanently non-AC, toggle disabled in UI |
| is_default | BOOLEAN | NOT NULL DEFAULT false — marks the 7 seeded categories vs. custom ones |
| display_order | SMALLINT | NOT NULL DEFAULT 0 |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

Constraints: `UNIQUE(library_id, name)`.
Business rule (enforced in service layer, not DB): if `is_ac_locked = true`, `is_ac` must stay
`false`; a CHECK constraint `CHECK (NOT is_ac_locked OR is_ac = false)` backstops this at the DB level.

### `cabins` (seats)
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| library_id | UUID | NOT NULL, FK → `libraries(id)` ON DELETE CASCADE |
| room_category_id | UUID | NOT NULL, FK → `room_categories(id)` ON DELETE RESTRICT |
| cabin_number | VARCHAR(20) | NOT NULL |
| capacity | SMALLINT | NOT NULL DEFAULT 1, CHECK (capacity > 0) |
| status | cabin_status | NOT NULL DEFAULT 'available' |
| current_student_id | UUID | NULL, FK → `students(id)` ON DELETE SET NULL — nullable, set when occupied |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

Constraints: `UNIQUE(library_id, room_category_id, cabin_number)`.
Indexes: `idx_cabins_library_status ON cabins(library_id, status)` — powers the "available seats" dashboard stat and seat-availability QR without a full scan.

> Note: `cabins.current_student_id` and `students.cabin_id` (below) are intentionally the *same
> relationship stored once* — see §9. The FK lives on `students` (a student has one cabin); `cabins`
> does **not** duplicate it as a column in the actual schema (shown here only to illustrate the
> relationship before §9 resolves it) — final column list excludes `current_student_id` from `cabins`.

---

## 7. Domain: Students

### `students`
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| library_id | UUID | NOT NULL, FK → `libraries(id)` ON DELETE CASCADE |
| cabin_id | UUID | NULL, FK → `cabins(id)` ON DELETE SET NULL |
| full_name | VARCHAR(150) | NOT NULL |
| phone | VARCHAR(20) | NOT NULL |
| whatsapp_number | VARCHAR(20) | NULL |
| email | CITEXT | NULL |
| address | TEXT | NULL |
| college | VARCHAR(150) | NULL |
| course | VARCHAR(150) | NULL |
| photo_url | TEXT | NULL |
| id_proof_url | TEXT | NULL |
| emergency_contact_name | VARCHAR(150) | NULL |
| emergency_contact_phone | VARCHAR(20) | NULL |
| joined_date | DATE | NOT NULL |
| expiry_date | DATE | NOT NULL |
| status | student_status | NOT NULL DEFAULT 'active' |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| deleted_at | TIMESTAMPTZ | NULL |

Constraints: `UNIQUE(library_id, phone) WHERE deleted_at IS NULL` — no duplicate active student per phone within a library.
Indexes: `idx_students_library_status ON students(library_id, status)`, `idx_students_expiry ON students(library_id, expiry_date)` — powers "upcoming renewals"/"expiring next week", `idx_students_cabin ON students(cabin_id)`.

This resolves the note in §6: **the seat↔student relationship is stored once**, as
`students.cabin_id`. `cabins.status = 'occupied'` is derived/maintained by the service layer
whenever `students.cabin_id` changes (transactionally, in the same service method) rather than
duplicated as a second FK — avoiding the two-source-of-truth problem a
`cabins.current_student_id` column would create.

---

## 8. Domain: Payments & Revenue Recognition

### `payments` (what the student actually paid, once)
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| library_id | UUID | NOT NULL, FK → `libraries(id)` ON DELETE CASCADE |
| student_id | UUID | NOT NULL, FK → `students(id)` ON DELETE RESTRICT |
| amount | NUMERIC(12,2) | NOT NULL, CHECK (amount > 0) |
| frequency | payment_frequency | NOT NULL |
| period_start | DATE | NOT NULL |
| period_end | DATE | NOT NULL, CHECK (period_end > period_start) |
| payment_method | payment_method | NOT NULL |
| transaction_reference | VARCHAR(255) | NULL |
| collected_by | UUID | NOT NULL, FK → `users(id)` ON DELETE RESTRICT |
| notes | TEXT | NULL |
| paid_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

Indexes: `idx_payments_library_paid_at ON payments(library_id, paid_at)`, `idx_payments_student ON payments(student_id)`.

### `payment_allocations` (revenue recognition — the fan-out that makes monthly reports correct)
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| payment_id | UUID | NOT NULL, FK → `payments(id)` ON DELETE CASCADE |
| library_id | UUID | NOT NULL, FK → `libraries(id)` ON DELETE CASCADE — **denormalized, see §9** |
| student_id | UUID | NOT NULL, FK → `students(id)` ON DELETE RESTRICT — **denormalized, see §9** |
| period_month | DATE | NOT NULL — always first-of-month, e.g. `2026-07-01` |
| allocated_amount | NUMERIC(12,2) | NOT NULL, CHECK (allocated_amount > 0) |
| is_prorated | BOOLEAN | NOT NULL DEFAULT false — true when the bucket is a partial month |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

Constraints: `UNIQUE(payment_id, period_month)` — one allocation row per payment per month.
Indexes: `idx_alloc_library_month ON payment_allocations(library_id, period_month)` — the single
most important index in the schema; every revenue report (daily/weekly/monthly/quarterly/yearly,
dashboard collection stats, profit calc) filters on exactly this.

### `expense_categories`
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| library_id | UUID | NULL, FK → `libraries(id)` ON DELETE CASCADE — NULL = global default category |
| name | VARCHAR(100) | NOT NULL — Rent, Electricity, Water, Internet, Maintenance, Furniture, Marketing, Salary, Cleaning, Miscellaneous (seeded as global defaults) |
| is_default | BOOLEAN | NOT NULL DEFAULT false |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

Constraints: `UNIQUE(library_id, name)` (with `library_id IS NULL` treated as its own namespace via a partial unique index `UNIQUE(name) WHERE library_id IS NULL`).

### `expenses`
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| library_id | UUID | NOT NULL, FK → `libraries(id)` ON DELETE CASCADE |
| category_id | UUID | NOT NULL, FK → `expense_categories(id)` ON DELETE RESTRICT |
| amount | NUMERIC(12,2) | NOT NULL, CHECK (amount > 0) |
| expense_date | DATE | NOT NULL |
| description | TEXT | NULL |
| receipt_url | TEXT | NULL |
| paid_to | VARCHAR(150) | NULL |
| recorded_by | UUID | NOT NULL, FK → `users(id)` ON DELETE RESTRICT |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

Indexes: `idx_expenses_library_date ON expenses(library_id, expense_date)` — mirrors the allocation
index so Monthly Profit (`SUM(allocations) - SUM(expenses)` for the same month) is two equally
cheap aggregate scans.

---

## 9. Justified Denormalization

`payment_allocations.library_id` and `payment_allocations.student_id` are technically derivable
via `payment_allocations.payment_id → payments.library_id / payments.student_id`, which is a
transitive dependency a strict 3NF reading would remove. They are kept as direct columns because:

1. **Every report query** (daily/weekly/monthly/quarterly/yearly revenue, dashboard "today's
   collection", AI Assistant revenue questions) filters this table by `library_id` and often
   groups by `student_id` — without the direct column, *every single one* of those queries needs
   a join to `payments`, on what is the highest-write-volume, highest-read-volume table in the
   system.
2. **RLS enforcement** needs `library_id` directly on the table being queried for the policy to be
   a cheap index-backed filter rather than a subquery into `payments` on every row.
3. **Immutability makes the risk manageable**: `payment_allocations` rows are never updated after
   creation (a correction is a new offsetting allocation, never an `UPDATE`), and they always
   derive from exactly one `payments` row at creation time via the `PaymentAllocationService` — so
   there is no update-anomaly window where the denormalized copy could drift from its source.
4. Enforced via FK (not just copied ad hoc) — both columns are real foreign keys, so referential
   integrity is guaranteed even though the value is also reachable transitively.

This is the **only** denormalization in the schema; everything else is 3NF.

---

## 10. Domain: Communication (WhatsApp)

### `whatsapp_templates`
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| library_id | UUID | NOT NULL, FK → `libraries(id)` ON DELETE CASCADE |
| type | whatsapp_template_type | NOT NULL |
| name | VARCHAR(100) | NOT NULL |
| content | TEXT | NOT NULL — supports `{{student_name}}`, `{{amount}}`, `{{expiry_date}}` etc. placeholders |
| is_active | BOOLEAN | NOT NULL DEFAULT true |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

Constraints: `UNIQUE(library_id, type) WHERE type != 'custom'` — one template per system-triggered
type; unlimited `custom` templates per library.

### `whatsapp_messages` (send log)
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| library_id | UUID | NOT NULL, FK → `libraries(id)` ON DELETE CASCADE |
| student_id | UUID | NULL, FK → `students(id)` ON DELETE SET NULL |
| template_id | UUID | NULL, FK → `whatsapp_templates(id)` ON DELETE SET NULL |
| phone | VARCHAR(20) | NOT NULL |
| message_body | TEXT | NOT NULL |
| status | whatsapp_message_status | NOT NULL DEFAULT 'queued' |
| provider_message_sid | VARCHAR(100) | NULL — Twilio's message SID, for webhook status correlation |
| error_message | TEXT | NULL |
| sent_at | TIMESTAMPTZ | NULL |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

Indexes: `idx_wa_messages_library_status ON whatsapp_messages(library_id, status)`, `idx_wa_messages_sid ON whatsapp_messages(provider_message_sid)`.

---

## 11. Domain: QR, Enquiries & Complaints

### `qr_codes`
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| library_id | UUID | NOT NULL, FK → `libraries(id)` ON DELETE CASCADE |
| type | qr_code_type | NOT NULL |
| target_path | VARCHAR(255) | NOT NULL — e.g. `/public/l/{slug}/seats`, resolved by frontend public route |
| image_url | TEXT | NULL — Cloudinary-hosted rendered QR image |
| is_active | BOOLEAN | NOT NULL DEFAULT true |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

Constraints: `UNIQUE(library_id, type)`.

### `enquiries` (from the seat-availability QR's enquiry form)
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| library_id | UUID | NOT NULL, FK → `libraries(id)` ON DELETE CASCADE |
| name | VARCHAR(150) | NOT NULL |
| phone | VARCHAR(20) | NOT NULL |
| message | TEXT | NULL |
| status | enquiry_status | NOT NULL DEFAULT 'new' |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

Indexes: `idx_enquiries_library_status ON enquiries(library_id, status)`.

### `complaints` (from the complaint QR, or raised internally)
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| library_id | UUID | NOT NULL, FK → `libraries(id)` ON DELETE CASCADE |
| student_id | UUID | NULL, FK → `students(id)` ON DELETE SET NULL — nullable, QR complaints may be anonymous |
| complaint_type | complaint_type | NOT NULL |
| description | TEXT | NOT NULL |
| photo_url | TEXT | NULL |
| priority | complaint_priority | NOT NULL DEFAULT 'medium' |
| status | complaint_status | NOT NULL DEFAULT 'open' |
| resolved_by | UUID | NULL, FK → `users(id)` ON DELETE SET NULL |
| resolved_at | TIMESTAMPTZ | NULL |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

Indexes: `idx_complaints_library_status ON complaints(library_id, status)`.

---

## 12. Domain: AI Assistant

### `ai_query_logs` (audit trail of AI Q&A — never stores raw SQL, since none is ever generated)
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| library_id | UUID | NOT NULL, FK → `libraries(id)` ON DELETE CASCADE |
| user_id | UUID | NOT NULL, FK → `users(id)` ON DELETE CASCADE |
| question | TEXT | NOT NULL |
| matched_intent | VARCHAR(100) | NOT NULL — the fixed template the question was classified into |
| context_data | JSONB | NOT NULL — the structured result set fetched via the repository layer, before it went to Grok |
| answer | TEXT | NOT NULL |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

Indexes: `idx_ai_logs_library_created ON ai_query_logs(library_id, created_at DESC)`.

---

## 13. Complete Table Inventory

| # | Table | Tenant-scoped? | RLS |
|---|---|---|---|
| 1 | roles | No (global) | No |
| 2 | users | No (global) | No |
| 3 | refresh_tokens | No (scoped via user_id) | No |
| 4 | user_library_memberships | Yes | Yes |
| 5 | audit_logs | Partial (nullable library_id) | Yes (permissive for NULL) |
| 6 | libraries | Self (tenant root) | Yes (`id = current_library_id`) |
| 7 | subscription_plans | No (global) | No |
| 8 | library_subscriptions | Yes | Yes |
| 9 | library_twilio_configs | Yes | Yes |
| 10 | room_categories | Yes | Yes |
| 11 | cabins | Yes | Yes |
| 12 | students | Yes | Yes |
| 13 | payments | Yes | Yes |
| 14 | payment_allocations | Yes | Yes |
| 15 | expense_categories | Partial (nullable library_id) | Yes (permissive for NULL) |
| 16 | expenses | Yes | Yes |
| 17 | whatsapp_templates | Yes | Yes |
| 18 | whatsapp_messages | Yes | Yes |
| 19 | qr_codes | Yes | Yes |
| 20 | enquiries | Yes | Yes |
| 21 | complaints | Yes | Yes |
| 22 | ai_query_logs | Yes | Yes |

---

## 14. RLS Policy Pattern (applied to every "Yes" row above)

```sql
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_select ON students
  FOR ALL
  USING (library_id = current_setting('app.current_library_id', true)::uuid);

-- Super Admin service role bypasses RLS entirely:
-- ALTER ROLE app_super_admin_role BYPASSRLS;
```

For tables with nullable `library_id` (`audit_logs`, `expense_categories`), the policy is:
```sql
USING (
  library_id IS NULL
  OR library_id = current_setting('app.current_library_id', true)::uuid
)
```
so global rows (default expense categories, platform-level audit entries) remain visible to every tenant.

---

## 15. Indexing Strategy Summary

- **Every FK column is indexed** (Postgres does not do this automatically) — prevents seq scans on cascade deletes and join queries.
- **Every `library_id` column is indexed**, usually as the leading column of a composite index matched to the table's dominant query pattern (`(library_id, status)`, `(library_id, paid_at)`, `(library_id, period_month)`).
- **Partial indexes** for soft-deleted tables (`WHERE deleted_at IS NULL`) keep the common "active rows only" query path small regardless of historical row accumulation.
- **`UNIQUE` constraints double as indexes** — no redundant index created alongside a unique constraint on the same columns.

---

## 16. Next Step

Module 3 will render this schema as a visual ER diagram (Mermaid `erDiagram`, viewable directly
in most Markdown renderers/IDEs) so the relationships in §4–§12 can be reviewed at a glance before
we move to Folder Structure and start writing actual SQLAlchemy models.

Please review this schema — table list, columns, constraints, the one denormalization in §9, and
the RLS approach — and confirm before Module 3.
