# Study Library Management System — Software Architecture

**Module 1 of 20 — Complete Software Architecture**
Status: Draft for review. Nothing downstream (DB, code) is generated until this is approved.

---

## 1. System Overview

A multi-tenant SaaS platform for managing physical study libraries (paid reading rooms /
co-working-style study spaces popular in India). A single platform instance serves many
independent library businesses ("tenants"). Each tenant's data — students, seats, payments,
complaints — is fully isolated from every other tenant, while a Super Admin layer can see
across all tenants for platform operations and billing.

```
                         ┌─────────────────────────────┐
                         │        Super Admin          │
                         │  (platform operator, global) │
                         └──────────────┬───────────────┘
                                        │ manages
                         ┌──────────────▼───────────────┐
                         │           Users              │
                         │ (Library Owner / Manager /    │
                         │  Staff / Student-future)      │
                         └──────────────┬───────────────┘
                     owns / works at (M:N via membership)
                         ┌──────────────▼───────────────┐
                         │          Libraries            │  ← Tenant boundary
                         │  (isolated data per library)  │
                         └──────────────┬───────────────┘
                    ┌───────────────────┼───────────────────┐
              ┌─────▼─────┐      ┌──────▼──────┐      ┌─────▼─────┐
              │   Rooms    │      │   Students   │      │  Expenses  │
              │ (categories)│      │              │      │            │
              └─────┬─────┘      └──────┬──────┘      └───────────┘
              ┌─────▼─────┐      ┌──────▼──────┐
              │   Cabins   │      │  Payments    │
              │  (seats)   │      │ + Allocations│
              └───────────┘      └─────────────┘
```

---

## 2. Multi-Tenancy Strategy

**Decision: Shared database, shared schema, `library_id` discriminator column + PostgreSQL
Row-Level Security (RLS) as defense-in-depth.**

| Option | Verdict |
|---|---|
| Database-per-tenant | Rejected — N databases means N migration runs per deploy, N connection pools, painful at hundreds/thousands of small-business tenants. Massive ops overhead for a system this shape. |
| Schema-per-tenant | Rejected — same migration multiplication problem at lower isolation benefit than DB-per-tenant, still not worth it below the "enterprise tenant" scale. |
| **Shared schema + `library_id` + RLS** | **Selected** — one schema, one migration path, horizontally cheap. Isolation risk (an app-layer bug forgetting `WHERE library_id = ...`) is mitigated by RLS enforcing isolation at the database engine level, independent of application code correctness. |

### How it works
1. Every tenant-scoped table has a non-nullable `library_id UUID` column, indexed, FK to `libraries.id`.
2. On every authenticated request, middleware resolves the caller's active `library_id` (from
   the JWT claim + the `X-Library-Id` header when a user belongs to multiple libraries) and runs
   `SET LOCAL app.current_library_id = '<uuid>'` on the request-scoped DB session/transaction.
3. Every tenant-scoped table has an RLS policy:
   ```sql
   CREATE POLICY tenant_isolation ON students
     USING (library_id = current_setting('app.current_library_id')::uuid);
   ```
4. The application DB role used by the API has RLS enforced on it. A separate, more privileged
   role (`BYPASSRLS`) is used only by the Super Admin service layer for legitimate cross-tenant
   queries (billing rollups, platform analytics).
5. **Belt-and-braces at the app layer too**: every tenant repository extends
   `BaseTenantRepository`, which injects `library_id` into every query it builds. RLS is the
   safety net; the repository layer is the primary mechanism. Redundancy here is intentional —
   this is the one class of bug ("tenant A sees tenant B's students") that is unacceptable in a
   paid multi-tenant product.

---

## 3. User ↔ Library Relationship

A user is not permanently bound to one library. A Library Owner may own several libraries; a
Staff member typically belongs to one. Role is **scoped per library**, not global.

```
users ──< user_library_memberships >── libraries
              (role_id FK → roles)
```

- `roles`: Super Admin, Library Owner, Manager, Staff, Student (future) — seeded, not user-editable at MVP.
- `user_library_memberships(user_id, library_id, role_id, status, invited_at, joined_at)` —
  composite unique on `(user_id, library_id)`.
- **Super Admin is the one global role** — it is a flag/role not tied to any `library_id` row,
  checked via a separate `is_super_admin` claim, since it must see across tenants by design.
- JWT carries: `user_id`, `is_super_admin`, and the list of `{library_id, role}` the user has
  active membership in. The frontend lets a multi-library user switch "active library" from the
  AppBar; the selected library travels as `X-Library-Id` header and is re-validated
  server-side against the membership list on every request (never trust the header alone).

---

## 4. Backend Architecture — Clean Architecture / Layered

```
┌─────────────────────────────────────────────────────────────┐
│  API Layer (FastAPI routers)                                 │
│  - HTTP concerns only: parsing, status codes, OpenAPI docs    │
│  - Depends() for auth/authz, request-scoped DB session        │
├─────────────────────────────────────────────────────────────┤
│  Service Layer (business logic)                               │
│  - Payment proration, renewal calc, subscription rules         │
│  - Orchestrates repositories + external clients (Twilio,       │
│    Cloudinary, Grok) — the ONLY layer allowed to call them     │
│  - Raises domain exceptions (never HTTPException)               │
├─────────────────────────────────────────────────────────────┤
│  Repository Layer (data access)                                │
│  - One repository per aggregate root                            │
│  - Only layer allowed to write SQLAlchemy queries                │
│  - BaseTenantRepository enforces library_id scoping              │
├─────────────────────────────────────────────────────────────┤
│  Model Layer (SQLAlchemy 2 ORM models, Alembic migrations)       │
├─────────────────────────────────────────────────────────────┤
│  PostgreSQL (with RLS policies)                                  │
└─────────────────────────────────────────────────────────────┘
```

**Dependency injection**: FastAPI's `Depends()` graph wires repositories into services and
services into routers. Services and repositories are defined against abstract interfaces
(`Protocol` classes) so they're swappable in tests (e.g., fake repository, no real DB needed for
pure service unit tests).

**Error handling**: Domain-specific exceptions (`StudentNotFoundError`,
`SeatAlreadyOccupiedError`, `DuplicatePaymentError`, ...) are raised in the service layer and
translated to HTTP responses by a single global exception-handler middleware — routers never
contain `try/except` for business errors, keeping that mapping in one auditable place.

**Cross-cutting concerns** (all as middleware/dependencies, not scattered per-route):
- Structured logging (JSON logs, request ID correlation, tenant ID tagging)
- Authentication (JWT decode + validation)
- Authorization (role/permission check per route, declarative via dependency)
- Rate limiting (Redis-backed, per-IP and per-account, stricter on `/auth/*`)
- Audit logging (mutating requests write to `audit_logs` — who, what, when, before/after diff)
- Request validation (Pydantic v2 schemas — request/response models are never the ORM models directly)

---

## 5. Background Processing — Celery vs APScheduler (deliberate split, not redundant)

| Concern | Tool | Why |
|---|---|---|
| **Per-tenant, runtime-configurable triggers** (e.g. "send renewal reminders daily at 9am *in the library's own timezone*", changeable by the library owner in Settings without a deploy) | **APScheduler** (in-process, DB-backed job store) | Jobs are added/removed dynamically at runtime per tenant. Celery Beat's schedule is comparatively static and awkward to mutate per-tenant at runtime. |
| **Actual task execution** — sending a WhatsApp message, generating a PDF report, processing a Cloudinary upload, calling Grok — anything that should retry, back off, and scale across workers | **Celery + Redis broker** | Distributed, retryable, horizontally scalable. APScheduler alone has no worker pool or retry semantics. |
| **Global, platform-wide recurring jobs** (nightly audit-log archival, subscription-expiry sweep across all tenants, daily backups trigger) | **Celery Beat** | These aren't per-tenant configurable — a static schedule is correct and simpler than APScheduler for this. |

Flow: `APScheduler fires (per-tenant trigger) → enqueues Celery task → Celery worker executes → result/failure logged`.
APScheduler decides **when** (per tenant); Celery does **the work** (reliably, at scale).

---

## 6. Payment Proration Engine (critical business rule)

A student pays ₹9000 upfront for a 6-month period. The system must report ₹1500 of *actual
recognized revenue* in each of those 6 calendar months — never ₹9000 in the month it was
collected.

```
payments (1)  ──generates on create──>  (N) payment_allocations
  id                                       id
  student_id                               payment_id (FK)
  library_id                               library_id
  amount = 9000                            period_month (date, first-of-month)
  period_start, period_end                 allocated_amount
  frequency = 'half_yearly'                is_prorated (bool)
  paid_at
```

**Allocation algorithm** (in `PaymentAllocationService`, unit-tested in isolation):
1. Determine `period_start` → `period_end` from the chosen frequency (daily/weekly/monthly/
   quarterly/half-yearly/yearly) relative to the student's plan start date.
2. Split the period into calendar-month buckets.
3. For full calendar months inside the period: `allocated_amount = amount / total_days_in_period * days_in_this_month`
   (day-weighted proration — handles a period that starts on the 15th correctly, not naive
   equal-split, which would misstate partial months).
4. Persist one `payment_allocations` row per bucket, summing exactly to `amount` (last bucket
   absorbs any rounding remainder so allocations always reconcile to the paid amount).
5. **All revenue/income reports query `SUM(payment_allocations.allocated_amount) WHERE
   period_month = :month`, never `payments.amount`.** This is the single source of truth for
   "monthly income" and is enforced by only exposing an aggregated read-model
   (`MonthlyRevenueView`, a SQL view) to the reporting layer — reports cannot accidentally query
   raw `payments` for a monthly figure because the reporting service's repository only exposes
   the view.

Monthly Profit = `SUM(payment_allocations for month) - SUM(expenses for month)`, computed the
same way — both sides already month-bucketed.

---

## 7. AI Assistant Flow (Grok) — no direct SQL execution

```
User question (NL)
     │
     ▼
FastAPI /ai/ask endpoint
     │
     ▼
AIAssistantService
     │  1. Classify intent against a fixed set of supported query templates
     │     (revenue, unpaid students, expiring seats, expense breakdown, etc.)
     │  2. Map intent → a pre-defined, parameterized repository method
     │     (NEVER free-text-to-SQL — the LLM never sees or writes SQL)
     ▼
Repository layer (SQLAlchemy, parameterized, tenant-scoped)
     │
     ▼
PostgreSQL → structured result set (JSON)
     │
     ▼
AIAssistantService formats result + original question into a prompt
     │
     ▼
Grok API → natural-language answer / WhatsApp reminder draft / suggestion
     │
     ▼
Response to user
```

This guarantees: (a) the AI can never run arbitrary or destructive SQL, (b) all data access is
still tenant-scoped and RLS-protected because it goes through the normal repository layer, (c)
Grok's role is strictly "reason over already-fetched, already-authorized JSON data and produce
prose," never "generate a query."

---

## 8. Frontend Architecture — Feature-Based

```
src/
  app/                  # store, router, providers, theme bootstrap
  features/
    auth/               # login, refresh, RTK Query authApi slice
    libraries/
    rooms/
    cabins/
    students/
    payments/
    expenses/
    dashboard/
    reports/
    complaints/
    qr/
    whatsapp/
    ai-assistant/
    settings/
  shared/
    components/         # reusable MUI-based building blocks (DataGridX, FormDialog, StatCard...)
    hooks/
    utils/
    theme/
  types/                # cross-feature shared types only
```

Each feature is self-contained: its own RTK Query API slice, Zod schemas, RHF forms, and
components — colocated rather than split across global `api/`/`components/`/`types/` folders.
This mirrors the backend's module boundaries 1:1 (one feature folder ↔ one backend router/service
module), which keeps the mental model consistent across the stack and scales cleanly as more
modules are added.

State split:
- **Redux Toolkit + RTK Query**: server state (all API data), auth session, active-library selection.
- **React local state / RHF**: form state (never mirrored into Redux).
- **Theme**: per-library theme (logo, primary/secondary color, dark/light) loaded on library
  switch and applied via a dynamic MUI `ThemeProvider`.

---

## 9. Security Architecture

| Concern | Approach |
|---|---|
| Password storage | Argon2id (stronger than bcrypt against GPU/ASIC attacks) |
| Access tokens | JWT, short-lived (~15 min), signed RS256 |
| Refresh tokens | Opaque random token, stored **hashed** in `refresh_tokens` table, rotating on use, revocable (supports logout-everywhere / stolen-token mitigation) |
| Authorization | Declarative per-route dependency: `require_role(Role.MANAGER, Role.OWNER)`, checked against the caller's membership row for the active `library_id` |
| Tenant isolation | RLS (§2) + repository-layer enforcement, defense-in-depth |
| Rate limiting | Redis token-bucket, per-IP + per-account, tighter limits on `/auth/login`, `/auth/refresh` |
| Input validation | Pydantic v2 schemas on every request; ORM models never exposed directly as request/response bodies |
| Audit logging | Every mutating action logged to `audit_logs` (actor, library, action, entity, before/after JSON diff, IP, timestamp) |
| Secrets | Twilio SID/token, Grok key, Cloudinary keys — encrypted at rest (per-library Twilio creds especially, since they're tenant-supplied secrets), never logged |
| Transport | HTTPS terminated at NGINX, HSTS enabled |

---

## 10. Deployment Topology

```
                        ┌─────────────┐
Internet ─────────────▶ │    NGINX     │  (TLS termination, reverse proxy, static frontend)
                        └──────┬──────┘
                 ┌─────────────┼─────────────┐
           ┌─────▼─────┐ ┌─────▼─────┐ ┌─────▼──────┐
           │  Frontend  │ │  FastAPI   │ │  FastAPI   │  (horizontally scaled API containers)
           │ (static)   │ │  container │ │  container │
           └───────────┘ └─────┬─────┘ └─────┬──────┘
                                │             │
                    ┌───────────┴─────────────┴───────────┐
              ┌─────▼─────┐                          ┌─────▼─────┐
              │ PostgreSQL │                          │   Redis    │
              │  (primary) │                          │ (cache,    │
              └───────────┘                          │  broker,   │
                                                       │  rate-limit)│
                                                       └─────┬─────┘
                                                       ┌─────▼─────┐
                                                       │  Celery    │
                                                       │  Workers   │
                                                       └───────────┘
```
All orchestrated via Docker Compose for single-VM deployment at MVP scale; each service
(`api`, `worker`, `beat`, `frontend`, `nginx`, `postgres`, `redis`) is an independently scalable
container, keeping a clean path to Kubernetes later without an architecture rewrite.

---

## 11. Module Build Order (confirmed)

1. ✅ Complete Software Architecture *(this document)*
2. Database Design
3. ER Diagram
4. Folder Structure
5. Authentication Module
6. User Management
7. Library Management
8. Room Management
9. Cabin Management
10. Student Management
11. Payment Module
12. Expense Module
13. Dashboard
14. Reports
15. QR Module
16. Twilio Integration
17. AI Assistant
18. Settings
19. Docker Deployment
20. Testing

Each module waits for explicit confirmation before proceeding to the next.
