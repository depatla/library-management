"""
Initializes the study_library database with the Module 2 schema.

This script deliberately does NOT try to be idempotent/migratory — it is a
one-shot bootstrap for local development, matching the SQL committed in
database/schema.sql. Production schema changes go through Alembic (Module 5+),
not this script.

Usage:
    cd backend
    python scripts/init_db.py
"""

import pathlib
import sys

import psycopg
from psycopg import sql

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from app.core.config import get_settings

SCHEMA_SQL_PATH = pathlib.Path(__file__).resolve().parents[2] / "database" / "schema.sql"


def main() -> None:
    settings = get_settings()
    schema_sql = SCHEMA_SQL_PATH.read_text()

    conn = psycopg.connect(
        host=settings.POSTGRES_HOST,
        port=settings.POSTGRES_PORT,
        user=settings.POSTGRES_USER,
        password=settings.POSTGRES_PASSWORD,
        dbname=settings.POSTGRES_DB,
        autocommit=True,
    )

    with conn:
        with conn.cursor() as cur:
            print(f"Connected to {settings.POSTGRES_DB} at {settings.POSTGRES_HOST}:{settings.POSTGRES_PORT}")
            print("Dropping existing schema (public) to start clean...")
            cur.execute(sql.SQL("DROP SCHEMA IF EXISTS public CASCADE"))
            cur.execute(sql.SQL("CREATE SCHEMA public"))
            cur.execute(sql.SQL("GRANT ALL ON SCHEMA public TO {}").format(sql.Identifier(settings.POSTGRES_USER)))
            cur.execute(sql.SQL("GRANT ALL ON SCHEMA public TO public"))

            print("Applying database/schema.sql ...")
            cur.execute(schema_sql)

            print("Verifying table count...")
            cur.execute(
                "SELECT count(*) FROM information_schema.tables "
                "WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"
            )
            (count,) = cur.fetchone()
            print(f"Schema applied successfully — {count} tables created.")

    conn.close()


if __name__ == "__main__":
    main()
