"""
Initialize the database and create all tables.

Usage:
    python scripts/init_db.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.database import create_tables, engine
from tools.config import Config


def main():
    print(f"Database URL: {Config.DATABASE_URL}")
    print("Creating tables...")
    create_tables()
    print("Done! All tables created successfully.")
    print(f"\nDatabase location: {Config.DATA_DIR / 'marketing_engine.db'}")


if __name__ == "__main__":
    main()
