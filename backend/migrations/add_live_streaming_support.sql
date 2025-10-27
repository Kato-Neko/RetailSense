-- Migration to add live streaming support to jobs table
-- Run this SQL script on your database to add the necessary columns

-- Add job_type column to distinguish between 'upload' and 'live' jobs
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS job_type VARCHAR(20) DEFAULT 'upload';

-- Add RTSP URL for live streaming jobs
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS rtsp_url VARCHAR(500);

-- Add camera name for live streaming jobs
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS camera_name VARCHAR(255);

-- Add is_live flag to quickly identify live streaming jobs
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_live BOOLEAN DEFAULT FALSE;

-- Update existing jobs to have job_type = 'upload'
UPDATE jobs SET job_type = 'upload' WHERE job_type IS NULL;

-- Create index on is_live for faster queries
CREATE INDEX IF NOT EXISTS idx_jobs_is_live ON jobs(is_live);

-- Create index on job_type for faster queries
CREATE INDEX IF NOT EXISTS idx_jobs_job_type ON jobs(job_type);

