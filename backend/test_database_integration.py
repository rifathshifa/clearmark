"""
Test suite for PostgreSQL / SQLAlchemy database integration in AuraMark AI backend.
"""
import os
import sys
import unittest
import uuid
from datetime import datetime

# Import database module
from database import (
    Base,
    User,
    File as DBFile,
    ProcessedFile as DBProcessedFile,
    ProcessingJob as DBProcessingJob,
    init_db,
    check_connection,
    get_db,
    engine,
    get_db_url
)

class TestDatabaseIntegration(unittest.TestCase):

    def test_01_models_structure(self):
        """Verify model table names and attributes exist."""
        self.assertEqual(User.__tablename__, "users")
        self.assertEqual(DBFile.__tablename__, "files")
        self.assertEqual(DBProcessedFile.__tablename__, "processed_files")
        self.assertEqual(DBProcessingJob.__tablename__, "processing_jobs")

        # Test model instantiation
        file_id = str(uuid.uuid4())
        f = DBFile(
            id=file_id,
            original_filename="sample_watermark.png",
            file_type="image",
            mime_type="image/png",
            file_size=102400,
            storage_provider="local",
            file_status="uploaded",
            width=800,
            height=600
        )
        self.assertEqual(f.id, file_id)
        self.assertEqual(f.original_filename, "sample_watermark.png")
        data = f.to_dict()
        self.assertEqual(data["file_type"], "image")
        self.assertEqual(data["width"], 800)
        print("[OK] Models and dictionaries verified successfully.")

    def test_02_database_operations(self):
        """Test DB operations if DATABASE_URL is configured."""
        url = get_db_url()
        if not url:
            print("[INFO] DATABASE_URL not configured yet. Skipping live database query tests.")
            return

        print(f"[INFO] Testing live connection to: {url.split('@')[-1] if '@' in url else 'database'}")
        self.assertTrue(init_db())

        test_file_id = str(uuid.uuid4())
        test_job_id = str(uuid.uuid4())
        test_proc_id = str(uuid.uuid4())

        # Insert File and Job
        with get_db() as session:
            self.assertIsNotNone(session)
            new_file = DBFile(
                id=test_file_id,
                original_filename="test_input.jpg",
                file_type="image",
                mime_type="image/jpeg",
                file_size=204850,
                storage_provider="local",
                file_status="processing",
                width=1920,
                height=1080
            )
            session.add(new_file)

            new_job = DBProcessingJob(
                id=test_job_id,
                file_id=test_file_id,
                job_type="photo_inpaint",
                status="processing",
                progress=50,
                mode="auto"
            )
            session.add(new_job)

        # Query and verify
        with get_db() as session:
            f = session.query(DBFile).filter_by(id=test_file_id).first()
            self.assertIsNotNone(f)
            self.assertEqual(f.original_filename, "test_input.jpg")
            self.assertEqual(f.file_status, "processing")

            job = session.query(DBProcessingJob).filter_by(id=test_job_id).first()
            self.assertIsNotNone(job)
            self.assertEqual(job.progress, 50)

            # Insert ProcessedFile and update job
            proc = DBProcessedFile(
                id=test_proc_id,
                original_file_id=test_file_id,
                storage_provider="local",
                storage_key="/outputs/test_out.jpg",
                output_filename="test_out.jpg",
                mime_type="image/jpeg",
                file_size=195000,
                width=1920,
                height=1080,
                processing_time_sec=1.23,
                model_used="LaMa Deep Neural Net"
            )
            session.add(proc)
            job.status = "completed"
            job.progress = 100
            job.completed_at = datetime.utcnow()
            f.file_status = "completed"

        # Verify relationship & cascade
        with get_db() as session:
            f = session.query(DBFile).filter_by(id=test_file_id).first()
            self.assertEqual(len(f.processed_files), 1)
            self.assertEqual(f.processed_files[0].output_filename, "test_out.jpg")
            self.assertEqual(len(f.jobs), 1)
            self.assertEqual(f.jobs[0].status, "completed")

            # Clean up test records
            session.delete(f)

        # Confirm cleanup
        with get_db() as session:
            f = session.query(DBFile).filter_by(id=test_file_id).first()
            self.assertIsNone(f)
            # Cascade deletion checks
            proc_check = session.query(DBProcessedFile).filter_by(id=test_proc_id).first()
            self.assertIsNone(proc_check)
            job_check = session.query(DBProcessingJob).filter_by(id=test_job_id).first()
            self.assertIsNone(job_check)

        print("[OK] Full live CRUD, relationships, and cascade operations tested successfully!")

    def test_03_app_endpoints(self):
        """Test Flask application status and database endpoints."""
        from app import app
        client = app.test_client()

        # Test /api/status
        res = client.get("/api/status")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn("status", data)
        self.assertIn("database", data)
        print("[OK] /api/status responded with database info:", data.get("database"))

        # Test /api/db/status
        res_db = client.get("/api/db/status")
        self.assertEqual(res_db.status_code, 200)
        db_data = res_db.get_json()
        self.assertIn("database", db_data)
        self.assertIn("counts", db_data)
        print("[OK] /api/db/status responded with record counts:", db_data.get("counts"))

        # Test /api/history
        res_hist = client.get("/api/history")
        self.assertEqual(res_hist.status_code, 200)
        hist_data = res_hist.get_json()
        self.assertIn("count", hist_data)
        print("[OK] /api/history responded successfully. Count:", hist_data.get("count"))

if __name__ == "__main__":
    unittest.main()
