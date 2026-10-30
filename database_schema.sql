-- ========================================================
-- ClearMark PostgreSQL Database Schema Export
-- Remove marks. Keep memories.
-- (c) 2026 Rifath Shifa M. All Rights Reserved.
-- Developed by Rifath Shifa M
-- Generated on: 2026-10-30 21:59:57
-- Target: localhost:5432/:memory:
-- ========================================================

CREATE TABLE IF NOT EXISTS files (
    user_id VARCHAR(36),
    original_filename VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    mime_type VARCHAR(100),
    file_size BIGINT,
    storage_provider VARCHAR(50),
    storage_key TEXT,
    file_status VARCHAR(50),
    width INTEGER,
    height INTEGER,
    created_at DATETIME,
    updated_at DATETIME,
    id VARCHAR(36) NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS processed_files (
    original_file_id VARCHAR(36) NOT NULL,
    storage_provider VARCHAR(50),
    storage_key TEXT,
    output_filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100),
    file_size BIGINT,
    width INTEGER,
    height INTEGER,
    processing_time_sec FLOAT,
    model_used VARCHAR(100),
    created_at DATETIME,
    id VARCHAR(36) NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (original_file_id) REFERENCES files (id)
);

CREATE TABLE IF NOT EXISTS processing_jobs (
    file_id VARCHAR(36),
    job_type VARCHAR(50) NOT NULL,
    status VARCHAR(50),
    progress INTEGER,
    mode VARCHAR(50),
    error_message TEXT,
    started_at DATETIME,
    completed_at DATETIME,
    id VARCHAR(64) NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (file_id) REFERENCES files (id)
);

CREATE TABLE IF NOT EXISTS users (
    username VARCHAR(100),
    email VARCHAR(255),
    created_at DATETIME,
    id VARCHAR(36) NOT NULL,
    PRIMARY KEY (id)
);

-- ========================================================
-- End of ClearMark Schema Export
-- (c) 2026 Rifath Shifa M. All Rights Reserved.
-- Developed by Rifath Shifa M
-- ========================================================