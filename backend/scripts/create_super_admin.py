"""One-shot bootstrap: creates the first super_admin user.

There is no public /register endpoint (requirement #15 — libraries and their
users are always admin-provisioned). Run this once against a fresh database
to create the account you'll use to log in and create libraries.

Usage:
    cd backend
    python scripts/create_super_admin.py "Your Name" your@email.com yourpassword
"""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from app.core.db import SessionLocal
from app.core.security import hash_password
from sqlalchemy import text


def main() -> None:
    if len(sys.argv) != 4:
        print("Usage: python scripts/create_super_admin.py <full_name> <email> <password>")
        sys.exit(1)

    full_name, email, password = sys.argv[1], sys.argv[2], sys.argv[3]
    db = SessionLocal()
    try:
        existing = db.execute(text("SELECT id FROM users WHERE email = :email"), {"email": email}).first()
        if existing:
            print(f"A user with email {email} already exists.")
            sys.exit(1)

        db.execute(
            text(
                """
                INSERT INTO users (full_name, email, password_hash, is_super_admin, is_active)
                VALUES (:full_name, :email, :password_hash, true, true)
                """
            ),
            {"full_name": full_name, "email": email, "password_hash": hash_password(password)},
        )
        db.commit()
        print(f"Super admin created: {email}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
