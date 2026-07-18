# Study Library Management System — Backend

FastAPI backend for the Study Library Management System, a multi-tenant SaaS platform for
managing study library businesses (students, seats, payments, expenses, WhatsApp, AI assistant).

Architecture, database design, and module-by-module build order are documented in
[`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) and [`../docs/DATABASE_DESIGN.md`](../docs/DATABASE_DESIGN.md).

## Tech Stack

- Python 3.13
- FastAPI
- SQLAlchemy 2 (Core + ORM)
- Alembic (migrations, from Module 5 onward)
- PostgreSQL (Row-Level Security for tenant isolation)
- Redis + Celery + APScheduler (background jobs, from Module 11 onward)
- JWT authentication (Argon2 password hashing)
- Pydantic v2

## Architecture

```
app/
  main.py              FastAPI app entrypoint, CORS, exception handlers
  core/
    config.py          Settings, loaded from .env
    db.py              SQLAlchemy engine/session + RLS tenant-context helper
    security.py         Password hashing, JWT issue/verify
    exceptions.py        Domain exceptions (raised by services, never routers)
    error_handlers.py    Global exception → HTTP response mapping
    logging.py           Structured JSON logging setup
  api/v1/
    router.py            Aggregates all feature routers
    health.py             /health, /health/db
  modules/                One folder per feature (auth, users, libraries, ...),
                           each following Router → Service → Repository → Model
```

Every tenant-scoped request runs `SET LOCAL app.current_library_id = ...` on its DB session
(`app.core.db.tenant_session`) so PostgreSQL Row-Level Security enforces tenant isolation at the
database engine level — independent of application code correctness. See
[`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) §2 for the full rationale.

## Prerequisites

- Python 3.13
- A running PostgreSQL instance. This project assumes a **local, non-Docker** Postgres (e.g. via
  pgAdmin / Postgres.app) on **port 5444**, database `study-library`, user `postgres`.

## Setup

```bash
cd backend
python3.13 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Copy `.env` and adjust if your local Postgres credentials differ from the defaults:

```
POSTGRES_HOST=localhost
POSTGRES_PORT=5444
POSTGRES_USER=postgres
POSTGRES_PASSWORD=12345
POSTGRES_DB=study-library
```

## Initialize the database

This applies the full schema from [`../database/schema.sql`](../database/schema.sql) — 22 tables,
enums, triggers, indexes, Row-Level Security policies, and seed data (roles, default expense
categories). It **drops and recreates the `public` schema first**, so any existing tables in the
target database are destroyed.

```bash
python scripts/init_db.py
```

Expected output ends with:
```
Schema applied successfully — 22 tables created.
```

## Run the API

```bash
uvicorn app.main:app --reload --port 8000
```

The API is now available at **http://localhost:8000**. Interactive docs (Swagger UI) at
**http://localhost:8000/docs**.

Verify the database connection end-to-end:

```bash
curl http://localhost:8000/api/v1/health
curl http://localhost:8000/api/v1/health/db
```

`health/db` returns the live table count and PostgreSQL version, confirming
FastAPI → SQLAlchemy → PostgreSQL is wired correctly.

## Project conventions

- **Routers** handle HTTP concerns only (parsing, status codes, `Depends()` wiring) — no business
  logic, no try/except for domain errors.
- **Services** hold business logic and are the only layer allowed to call external APIs (Twilio,
  Cloudinary, Grok) or orchestrate multiple repositories. They raise `DomainError` subclasses
  from `app.core.exceptions`, never `HTTPException`.
- **Repositories** are the only layer allowed to write SQLAlchemy queries. Every tenant-scoped
  repository must use a session obtained via `tenant_session()`, never the plain `get_db()`.
- **Domain exceptions** are translated to HTTP responses in exactly one place:
  `app.core.error_handlers`.

## Running tests

Test suite is introduced in Module 20 (see [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md)
build order). Once added:

```bash
pytest
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| `psycopg.OperationalError: connection failed` | Confirm Postgres is listening on port 5444: `pg_isready -h localhost -p 5444` |
| `password authentication failed` | Check `POSTGRES_PASSWORD` in `.env` matches your local Postgres user |
| `relation "..." does not exist` | Run `python scripts/init_db.py` before starting the API |
| Port 8000 already in use | `uvicorn app.main:app --reload --port <other-port>` and update the frontend's Vite proxy target accordingly |
