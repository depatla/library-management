# Study Library Management System — ER Diagram

**Module 3 of 20 — ER Diagram**
Depends on: [DATABASE_DESIGN.md](./DATABASE_DESIGN.md) (Module 2 — full column/constraint spec)
This document is the visual companion to that schema — open it in a Markdown preview that
renders Mermaid (VS Code with the Markdown Preview Mermaid extension, GitHub, GitLab, etc.) to
see the diagrams rendered.

The full schema (22 tables) is split into two diagrams for readability:
1. **Core Tenancy & Identity** — users, roles, libraries, memberships, subscriptions, audit
2. **Operational Domain** — rooms, cabins, students, payments, expenses, WhatsApp, QR, complaints, AI

`libraries` appears in both diagrams as the shared anchor point.

---

## Diagram 1 — Identity, Tenancy & Subscription

```mermaid
erDiagram
    ROLES ||--o{ USER_LIBRARY_MEMBERSHIPS : "scopes"
    USERS ||--o{ USER_LIBRARY_MEMBERSHIPS : "holds"
    USERS ||--o{ REFRESH_TOKENS : "owns"
    USERS ||--o{ LIBRARIES : "owns (owner_id)"
    LIBRARIES ||--o{ USER_LIBRARY_MEMBERSHIPS : "grants access to"
    LIBRARIES ||--o| LIBRARY_SUBSCRIPTIONS : "has one"
    LIBRARIES ||--o| LIBRARY_TWILIO_CONFIGS : "has one"
    SUBSCRIPTION_PLANS ||--o{ LIBRARY_SUBSCRIPTIONS : "defines"
    LIBRARIES ||--o{ AUDIT_LOGS : "scopes (nullable)"
    USERS ||--o{ AUDIT_LOGS : "acts as (nullable)"

    ROLES {
        uuid id PK
        varchar name UK
        text description
        boolean is_assignable
    }

    USERS {
        uuid id PK
        varchar full_name
        citext email UK
        varchar phone UK
        varchar password_hash
        boolean is_super_admin
        boolean is_active
        timestamptz deleted_at
    }

    REFRESH_TOKENS {
        uuid id PK
        uuid user_id FK
        varchar token_hash UK
        timestamptz expires_at
        timestamptz revoked_at
    }

    USER_LIBRARY_MEMBERSHIPS {
        uuid id PK
        uuid user_id FK
        uuid library_id FK
        uuid role_id FK
        membership_status status
    }

    LIBRARIES {
        uuid id PK
        uuid owner_id FK
        varchar name
        varchar slug UK
        varchar currency
        varchar timezone
        library_status status
        timestamptz deleted_at
    }

    SUBSCRIPTION_PLANS {
        uuid id PK
        varchar name UK
        numeric price
        varchar billing_cycle
        integer max_students
    }

    LIBRARY_SUBSCRIPTIONS {
        uuid id PK
        uuid library_id FK "UK"
        uuid plan_id FK
        subscription_status status
        date current_period_start
        date current_period_end
    }

    LIBRARY_TWILIO_CONFIGS {
        uuid id PK
        uuid library_id FK "UK"
        varchar account_sid
        varchar auth_token
        varchar whatsapp_number
    }

    AUDIT_LOGS {
        uuid id PK
        uuid library_id FK "nullable"
        uuid actor_user_id FK "nullable"
        varchar action
        varchar entity_type
        uuid entity_id
        jsonb before_data
        jsonb after_data
    }
```

---

## Diagram 2 — Operational Domain

```mermaid
erDiagram
    LIBRARIES ||--o{ ROOM_CATEGORIES : "configures"
    LIBRARIES ||--o{ CABINS : "contains"
    LIBRARIES ||--o{ STUDENTS : "enrolls"
    LIBRARIES ||--o{ PAYMENTS : "collects"
    LIBRARIES ||--o{ PAYMENT_ALLOCATIONS : "recognizes (denormalized)"
    LIBRARIES ||--o{ EXPENSES : "incurs"
    LIBRARIES ||--o{ EXPENSE_CATEGORIES : "defines (or global)"
    LIBRARIES ||--o{ WHATSAPP_TEMPLATES : "configures"
    LIBRARIES ||--o{ WHATSAPP_MESSAGES : "sends"
    LIBRARIES ||--o{ QR_CODES : "generates"
    LIBRARIES ||--o{ ENQUIRIES : "receives"
    LIBRARIES ||--o{ COMPLAINTS : "receives"
    LIBRARIES ||--o{ AI_QUERY_LOGS : "logs"

    ROOM_CATEGORIES ||--o{ CABINS : "groups"
    CABINS ||--o{ STUDENTS : "seats (cabin_id, nullable)"

    STUDENTS ||--o{ PAYMENTS : "makes"
    STUDENTS ||--o{ COMPLAINTS : "files (nullable)"
    STUDENTS ||--o{ WHATSAPP_MESSAGES : "receives (nullable)"
    STUDENTS ||--o{ PAYMENT_ALLOCATIONS : "attributed to (denormalized)"

    PAYMENTS ||--o{ PAYMENT_ALLOCATIONS : "fans out into"

    EXPENSE_CATEGORIES ||--o{ EXPENSES : "categorizes"

    WHATSAPP_TEMPLATES ||--o{ WHATSAPP_MESSAGES : "used by (nullable)"

    ROOM_CATEGORIES {
        uuid id PK
        uuid library_id FK
        varchar name
        boolean is_ac
        boolean is_ac_locked
        boolean is_default
    }

    CABINS {
        uuid id PK
        uuid library_id FK
        uuid room_category_id FK
        varchar cabin_number
        smallint capacity
        cabin_status status
    }

    STUDENTS {
        uuid id PK
        uuid library_id FK
        uuid cabin_id FK "nullable"
        varchar full_name
        varchar phone
        date joined_date
        date expiry_date
        student_status status
        timestamptz deleted_at
    }

    PAYMENTS {
        uuid id PK
        uuid library_id FK
        uuid student_id FK
        numeric amount
        payment_frequency frequency
        date period_start
        date period_end
        payment_method payment_method
        uuid collected_by FK
    }

    PAYMENT_ALLOCATIONS {
        uuid id PK
        uuid payment_id FK
        uuid library_id FK "denormalized"
        uuid student_id FK "denormalized"
        date period_month
        numeric allocated_amount
        boolean is_prorated
    }

    EXPENSE_CATEGORIES {
        uuid id PK
        uuid library_id FK "nullable = global"
        varchar name
        boolean is_default
    }

    EXPENSES {
        uuid id PK
        uuid library_id FK
        uuid category_id FK
        numeric amount
        date expense_date
        uuid recorded_by FK
    }

    WHATSAPP_TEMPLATES {
        uuid id PK
        uuid library_id FK
        whatsapp_template_type type
        varchar name
        text content
    }

    WHATSAPP_MESSAGES {
        uuid id PK
        uuid library_id FK
        uuid student_id FK "nullable"
        uuid template_id FK "nullable"
        varchar phone
        whatsapp_message_status status
        varchar provider_message_sid
    }

    QR_CODES {
        uuid id PK
        uuid library_id FK
        qr_code_type type
        varchar target_path
        text image_url
    }

    ENQUIRIES {
        uuid id PK
        uuid library_id FK
        varchar name
        varchar phone
        enquiry_status status
    }

    COMPLAINTS {
        uuid id PK
        uuid library_id FK
        uuid student_id FK "nullable"
        complaint_type complaint_type
        complaint_priority priority
        complaint_status status
        uuid resolved_by FK "nullable"
    }

    AI_QUERY_LOGS {
        uuid id PK
        uuid library_id FK
        uuid user_id FK
        text question
        varchar matched_intent
        jsonb context_data
        text answer
    }
```

---

## How to read the cardinalities

| Notation | Meaning | Example in this schema |
|---|---|---|
| `\|\|--o{` | one-to-many, "many" side optional | one `LIBRARY` has many `STUDENTS` |
| `\|\|--o\|` | one-to-zero-or-one | one `LIBRARY` has at most one `LIBRARY_SUBSCRIPTIONS` row |
| `cabin_id FK "nullable"` | optional FK | a `STUDENT` may have no assigned `CABIN` yet |
| `library_id FK "denormalized"` | FK that is also reachable transitively (via `payment_id`) but stored directly for query performance — see Module 2 §9 | `PAYMENT_ALLOCATIONS.library_id` |

## Key relationship notes (cross-referencing Module 2)

- **`USERS` ↔ `LIBRARIES` is many-to-many**, mediated by `USER_LIBRARY_MEMBERSHIPS` — not a direct
  FK — because one user can own/work at multiple libraries, each with a different role.
- **`CABINS` ↔ `STUDENTS`** is a one-to-many stored as a single FK on `STUDENTS.cabin_id`
  (nullable). There is deliberately no reciprocal `CABINS.current_student_id` column — occupancy
  status on `cabins.status` is maintained by the service layer whenever `students.cabin_id`
  changes, avoiding a two-source-of-truth problem.
- **`PAYMENTS` → `PAYMENT_ALLOCATIONS`** is the revenue-recognition fan-out: one payment (e.g.
  ₹9000 for 6 months) produces multiple allocation rows (₹1500 × 6, one per calendar month). All
  revenue reporting joins/aggregates on `PAYMENT_ALLOCATIONS`, never raw `PAYMENTS.amount`.
- **`EXPENSE_CATEGORIES` and `AUDIT_LOGS`** have a nullable `library_id`: `NULL` means a
  platform-global row (default expense categories, platform-level audit entries), visible to
  every tenant under the RLS policy defined in Module 2 §14.
- **`ROLES` and `SUBSCRIPTION_PLANS`** are global lookup tables with no `library_id` at all — not
  shown with a `library_id`-based relationship since they're platform-wide, referenced by FK from
  tenant tables (`USER_LIBRARY_MEMBERSHIPS.role_id`, `LIBRARY_SUBSCRIPTIONS.plan_id`).

---

## Next Step

Module 4 will define the **Folder Structure** for both the FastAPI backend and the React
frontend, mapping each domain shown above to a concrete feature module/directory — so the
Clean Architecture layering from Module 1 and the schema from Module 2 have a physical home
before any code is written.

Please review the two diagrams above (open this file's Markdown preview to see them rendered)
and confirm before Module 4.
