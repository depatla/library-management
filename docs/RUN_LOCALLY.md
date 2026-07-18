# Running the app locally

The Claude Code shell in this environment is blocked from binding local ports or making raw
TCP connections (including to your own local Postgres) — this is a system-level network sandbox
restriction, not a configuration issue in the app itself. Everything below is code/config only;
run these commands yourself in a normal terminal.

## Prerequisites

- Python 3.13 (`python3.13 --version`)
- Node.js 22+ (`node --version`)
- Your local PostgreSQL running on **port 5444** (confirmed via pgAdmin) with:
  - user: `postgres`
  - password: `12345`
  - database: `study-library` (already exists — Module 2 schema will replace its current tables)

## 1. Initialize the database

This drops whatever is currently in the `study-library` database's `public` schema and applies
the full Module 2 schema (22 tables, RLS policies, seed data) from `database/schema.sql`.

```bash
cd backend
python3.13 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python scripts/init_db.py
```

Expected output ends with something like:
```
Schema applied successfully — 22 tables created.
```

## 2. Start the backend (FastAPI on port 8000)

```bash
cd backend
source .venv/bin/activate   # if not already active
uvicorn app.main:app --reload --port 8000
```

Verify it's up:
```bash
curl http://localhost:8000/api/v1/health
curl http://localhost:8000/api/v1/health/db
```

`health/db` should return the live table count and Postgres version — this confirms
FastAPI → SQLAlchemy → PostgreSQL end to end.

## 3. Start the frontend (Vite dev server on port 9999)

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:9999** — the dashboard page calls `/api/v1/health/db` through Vite's dev
proxy (configured in `vite.config.ts` to forward `/api/*` to `http://localhost:8000`) and displays
"Connected" with the live table count once the backend is reachable.

## Ports summary

| Service | Port | Notes |
|---|---|---|
| Frontend (Vite) | 9999 | proxies `/api/*` to the backend |
| Backend (FastAPI) | 8000 | connects to Postgres on 5444 |
| PostgreSQL | 5444 | your existing local instance, not managed by this repo |

## Troubleshooting

- **`psycopg.OperationalError` on `init_db.py`**: confirm Postgres is actually listening on 5444
  (`pg_isready -h localhost -p 5444`) and the password in `backend/.env` matches pgAdmin's.
- **Frontend shows "Could not reach the backend"**: confirm `uvicorn` is running and
  `curl http://localhost:8000/api/v1/health` succeeds before checking the frontend.
- **Port 9999 already in use**: change `server.port` in `frontend/vite.config.ts`.
