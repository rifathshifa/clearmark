"""
Database Migration and Verification Script for AuraMark AI
Usage:
    python migrate_db.py
"""

import sys
import os

from database import init_db, check_connection, Base, engine, get_db, User, File, ProcessedFile, ProcessingJob

def main():
    print("=" * 60)
    print(" AuraMark AI - PostgreSQL Migration & Table Verification")
    print("=" * 60)

    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("[!] No DATABASE_URL found in environment or .env file.")
        print("    Please set DATABASE_URL in backend/.env or root .env:")
        print("    Example: DATABASE_URL=postgresql://user:password@ep-xyz.us-east-2.aws.neon.tech/neondb?sslmode=require")
        sys.exit(1)

    print(f"[*] Detected DATABASE_URL (host: {db_url.split('@')[-1] if '@' in db_url else 'local'})")
    print("[*] Connecting to PostgreSQL...")

    success = init_db()
    if not success:
        status = check_connection()
        print(f"[ERROR] Failed to connect to PostgreSQL: {status.get('error')}")
        sys.exit(1)

    print("[SUCCESS] Connected to PostgreSQL engine successfully!")
    print("\n[*] Creating / Verifying database tables:")
    for table_name in Base.metadata.tables.keys():
        print(f"  - Table: {table_name}")

    Base.metadata.create_all(engine)
    print("\n[SUCCESS] All tables (users, files, processed_files, processing_jobs) verified!")

    # Verify session queries
    with get_db() as session:
        if session:
            file_count = session.query(File).count()
            job_count = session.query(ProcessingJob).count()
            processed_count = session.query(ProcessedFile).count()
            print(f"[*] Current records in DB:")
            print(f"    - Files: {file_count}")
            print(f"    - Processing Jobs: {job_count}")
            print(f"    - Processed Files: {processed_count}")

    print("\n[DONE] PostgreSQL database is ready for persistent storage!")

if __name__ == "__main__":
    main()
