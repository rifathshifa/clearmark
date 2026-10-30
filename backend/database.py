import os
import uuid
from datetime import datetime
from contextlib import contextmanager

from dotenv import load_dotenv
from sqlalchemy import (
    create_engine,
    Column,
    String,
    Integer,
    BigInteger,
    Float,
    DateTime,
    ForeignKey,
    Text,
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship, scoped_session

# Load environment variables from .env file in backend or root
backend_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.dirname(backend_dir)
load_dotenv(os.path.join(backend_dir, ".env"))
load_dotenv(os.path.join(root_dir, ".env"))

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()

# Handle standard Postgres URL prefix (e.g., postgres:// -> postgresql:// for SQLAlchemy compatibility)
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

Base = declarative_base()


# ==========================================
# Database Models
# ==========================================

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String(100), nullable=True)
    email = Column(String(255), unique=True, nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    files = relationship("File", back_populates="user", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class File(Base):
    __tablename__ = "files"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    original_filename = Column(String(255), nullable=False)
    file_type = Column(String(50), nullable=False)  # 'image' or 'video'
    mime_type = Column(String(100), nullable=True)
    file_size = Column(BigInteger, nullable=True)
    storage_provider = Column(String(50), default="local")  # 'local', 'cloudinary', 'r2'
    storage_key = Column(Text, nullable=True)
    file_status = Column(String(50), default="uploaded", index=True)  # 'uploaded', 'processing', 'completed', 'failed'
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="files")
    processed_files = relationship("ProcessedFile", back_populates="original_file", cascade="all, delete-orphan")
    jobs = relationship("ProcessingJob", back_populates="file", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "original_filename": self.original_filename,
            "file_type": self.file_type,
            "mime_type": self.mime_type,
            "file_size": self.file_size,
            "storage_provider": self.storage_provider,
            "storage_key": self.storage_key,
            "file_status": self.file_status,
            "width": self.width,
            "height": self.height,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "processed_count": len(self.processed_files) if self.processed_files else 0,
        }


class ProcessedFile(Base):
    __tablename__ = "processed_files"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    original_file_id = Column(String(36), ForeignKey("files.id", ondelete="CASCADE"), nullable=False, index=True)
    storage_provider = Column(String(50), default="local")
    storage_key = Column(Text, nullable=True)
    output_filename = Column(String(255), nullable=False)
    mime_type = Column(String(100), nullable=True)
    file_size = Column(BigInteger, nullable=True)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    processing_time_sec = Column(Float, nullable=True)
    model_used = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    # Relationships
    original_file = relationship("File", back_populates="processed_files")

    def to_dict(self):
        return {
            "id": self.id,
            "original_file_id": self.original_file_id,
            "storage_provider": self.storage_provider,
            "storage_key": self.storage_key,
            "output_filename": self.output_filename,
            "mime_type": self.mime_type,
            "file_size": self.file_size,
            "width": self.width,
            "height": self.height,
            "processing_time_sec": self.processing_time_sec,
            "model_used": self.model_used,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class ProcessingJob(Base):
    __tablename__ = "processing_jobs"

    id = Column(String(64), primary_key=True)  # unique task_id / UUID
    file_id = Column(String(36), ForeignKey("files.id", ondelete="CASCADE"), nullable=True, index=True)
    job_type = Column(String(50), nullable=False)  # 'photo_inpaint', 'video_inpaint'
    status = Column(String(50), default="pending", index=True)  # 'pending', 'processing', 'completed', 'failed'
    progress = Column(Integer, default=0)
    mode = Column(String(50), default="auto")
    error_message = Column(Text, nullable=True)
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    # Relationships
    file = relationship("File", back_populates="jobs")

    def to_dict(self):
        return {
            "id": self.id,
            "file_id": self.file_id,
            "job_type": self.job_type,
            "status": self.status,
            "progress": self.progress,
            "mode": self.mode,
            "error_message": self.error_message,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }


# ==========================================
# Engine & Session Management
# ==========================================

engine = None
SessionFactory = None
is_database_ready = False
db_init_error = None


def get_db_url():
    """Returns the current DATABASE_URL or None."""
    global DATABASE_URL
    url = os.getenv("DATABASE_URL", "").strip()
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    return url or None


def init_db(custom_url=None):
    """
    Initializes database engine and creates tables if connected.
    Returns True if connection succeeded, False otherwise.
    """
    global engine, SessionFactory, is_database_ready, db_init_error

    target_url = custom_url or get_db_url()

    if not target_url:
        is_database_ready = False
        db_init_error = "DATABASE_URL is not set in environment or .env file."
        print(f"[Database] Warning: {db_init_error}")
        return False

    try:
        # Create SQLAlchemy engine with connection pool recycling
        engine = create_engine(
            target_url,
            pool_recycle=300,
            pool_pre_ping=True,
            echo=False
        )

        # Test connection immediately
        with engine.connect() as conn:
            pass

        # Create all declared tables if they do not exist
        Base.metadata.create_all(engine)

        # Configure session factory
        SessionFactory = scoped_session(sessionmaker(autocommit=False, autoflush=False, bind=engine))
        is_database_ready = True
        db_init_error = None
        print(f"[Database] PostgreSQL database successfully connected and tables verified.")
        return True

    except Exception as e:
        is_database_ready = False
        db_init_error = str(e)
        print(f"[Database] Connection error: {e}")
        return False


@contextmanager
def get_db():
    """
    Context manager providing a transactional database session.
    Automatically commits on success or rolls back on exception.
    """
    global SessionFactory, is_database_ready

    if not is_database_ready or SessionFactory is None:
        # Attempt reconnect if URL is now available
        if get_db_url():
            init_db()

    if not is_database_ready or SessionFactory is None:
        yield None
        return

    session = SessionFactory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def check_connection():
    """Returns database status dictionary for health check endpoints."""
    global is_database_ready, db_init_error

    url = get_db_url()
    if not url:
        return {
            "status": "not_configured",
            "connected": False,
            "error": "DATABASE_URL is not set",
            "provider": "PostgreSQL",
        }

    if not is_database_ready:
        # Try re-initializing once
        init_db()

    if is_database_ready and engine:
        try:
            with engine.connect() as conn:
                return {
                    "status": "connected",
                    "connected": True,
                    "provider": "PostgreSQL (SQLAlchemy)",
                    "dialect": engine.dialect.name,
                    "pool_size": getattr(engine.pool, "size", lambda: None)(),
                }
        except Exception as e:
            return {
                "status": "error",
                "connected": False,
                "error": str(e),
                "provider": "PostgreSQL",
            }

    return {
        "status": "error",
        "connected": False,
        "error": db_init_error or "Database connection failed",
        "provider": "PostgreSQL",
    }


# Automatically initialize on module import
init_db()
