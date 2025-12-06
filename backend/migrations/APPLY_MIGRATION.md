# Database Migration Instructions

## Error: Column "camera_name" does not exist

This error occurs because the database migration hasn't been applied yet. You need to add the new columns to your PostgreSQL database.

## Quick Fix

### Option 1: Using Railway CLI (Recommended)

If you're using Railway, you can connect to your database and run the migration:

```bash
# Connect to your Railway database
railway connect

# Then run the SQL migration
psql -f migrations/add_live_streaming_support.sql
```

### Option 2: Using Railway Web Dashboard

1. Go to your Railway project dashboard
2. Click on your PostgreSQL database service
3. Go to the "Data" tab
4. Click "Query" 
5. Copy and paste the contents of `backend/migrations/add_live_streaming_support.sql`
6. Click "Run Query"

### Option 3: Direct SQL Execution

Connect to your database using any PostgreSQL client and run:

```sql
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
```

## Verify Migration

After running the migration, verify it worked by checking the columns:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'jobs' 
AND column_name IN ('job_type', 'rtsp_url', 'camera_name', 'is_live');
```

You should see all 4 columns listed.

## After Migration

Once the migration is complete, restart your backend service and the live streaming feature should work properly.


