# Database Migrations

## Live Streaming Support Migration

To add live streaming support to your database, run the following SQL migration:

```bash
# Connect to your PostgreSQL database and run:
psql -h <host> -U <user> -d <database> -f add_live_streaming_support.sql
```

Or manually execute the SQL in `add_live_streaming_support.sql` using your database management tool.

### What This Migration Does

1. Adds `job_type` column to distinguish between 'upload' and 'live' jobs
2. Adds `rtsp_url` column to store camera RTSP stream URLs
3. Adds `camera_name` column to store friendly camera names
4. Adds `is_live` boolean flag for quick filtering of live streaming jobs
5. Creates indexes for better query performance

### Database Schema Changes

The `jobs` table will have these new columns:
- `job_type VARCHAR(20)` - Default: 'upload'
- `rtsp_url VARCHAR(500)` - For live streaming RTSP URLs
- `camera_name VARCHAR(255)` - User-friendly camera name
- `is_live BOOLEAN` - Default: FALSE

Existing jobs will be automatically set to `job_type = 'upload'`.

