# Live Streaming Implementation Summary

## Overview
This document summarizes the live streaming feature implementation for RetailSense using Tapo cameras.

## What Was Implemented

### Backend Changes

1. **New Service: `backend/main/services/live_stream.py`**
   - `LiveStreamProcessor` class handles RTSP stream processing
   - Real-time person detection using YOLOv8
   - Object tracking using DeepSort
   - Automatic heatmap generation every 30 seconds
   - Batch detection storage to Supabase

2. **New API Endpoints: `backend/main/api/jobs.py`**
   - `POST /api/heatmap_jobs/live` - Create a live streaming job
   - `POST /api/heatmap_jobs/<job_id>/live/stop` - Stop a live stream
   - `GET /api/heatmap_jobs/<job_id>/live/status` - Get live stream status

3. **Updated API Endpoint: `backend/main/api/heatmap.py`**
   - `GET /api/heatmap_jobs/<job_id>/live/heatmap` - Get current live heatmap image

4. **Database Migration: `backend/migrations/add_live_streaming_support.sql`**
   - Adds columns: `job_type`, `rtsp_url`, `camera_name`, `is_live`
   - Creates indexes for better query performance

### Frontend Changes

1. **New Page: `frontend/src/pages/LiveStreaming.jsx`**
   - Camera configuration form (credentials or RTSP URL)
   - Connection status indicator
   - Live heatmap display
   - Real-time status polling
   - Setup instructions for Tapo cameras

2. **Updated Services: `frontend/src/services/api.js`**
   - Added `createLiveJob()`, `stopLiveJob()`, `getLiveJobStatus()`, `getLiveHeatmapImageUrl()`

3. **Updated Navigation**
   - Added "Live Streaming" menu item under Heatmap section
   - Added route `/live-streaming`
   - Updated breadcrumb navigation

## Setup Instructions

### 1. Database Migration
Run the SQL migration to add live streaming support:
```bash
psql -h <host> -U <user> -d <database> -f backend/migrations/add_live_streaming_support.sql
```

### 2. Tapo Camera Configuration
1. Open Tapo app on your device
2. Navigate to camera settings
3. Go to "Advanced Settings" → "Camera Account"
4. Create RTSP username and password
5. Note the camera's IP address

### 3. Usage
1. Navigate to Heatmap → Live Streaming
2. Enter camera credentials (name, IP, username, password) OR RTSP URL
3. Click "Connect Camera"
4. View live heatmap updates (updates every 30 seconds)

## Technical Details

### RTSP URL Format
- High quality: `rtsp://username:password@ip_address/stream1`
- Low quality: `rtsp://username:password@ip_address/stream2`

### Processing Flow
1. RTSP stream is opened using OpenCV
2. Frames are processed every 5th frame (performance optimization)
3. YOLOv8 detects persons in each frame
4. DeepSort tracks persons across frames
5. Detections are batched and saved to Supabase every 100 detections or 10 seconds
6. Heatmap is generated every 30 seconds from accumulated detections

### File Storage
- Detections: `{job_id}/live_detections.json` in Supabase
- Heatmap: `{job_id}/live_heatmap.jpg` in Supabase
- Floorplan: `{job_id}/floorplan_{job_id}.jpg` in Supabase

## API Endpoints

### Create Live Job
```javascript
POST /api/heatmap_jobs/live
Body: {
  rtsp_url: "rtsp://...",
  camera_name: "Camera Name",
  points_data: [] // Optional
}
Response: {
  job_id: "...",
  status: "connecting",
  camera_name: "..."
}
```

### Stop Live Job
```javascript
POST /api/heatmap_jobs/{job_id}/live/stop
Response: {
  success: true,
  message: "Live stream stopped"
}
```

### Get Live Status
```javascript
GET /api/heatmap_jobs/{job_id}/live/status
Response: {
  job_id: "...",
  status: "live",
  message: "...",
  camera_name: "...",
  is_running: true,
  frame_count: 1234
}
```

### Get Live Heatmap
```javascript
GET /api/heatmap_jobs/{job_id}/live/heatmap
Response: JPEG image
```

## Performance Considerations

- Frame skipping: Processes every 5th frame for better performance
- Batch saving: Detections saved in batches to reduce API calls
- Heatmap updates: Generated every 30 seconds, not per frame
- Model optimization: Uses smaller input size (320px) for faster inference

## Future Enhancements

- Real-time frame preview (not just heatmap)
- WebSocket support for instant updates
- Multiple camera support
- Recording and playback of live streams
- Custom coordinate mapping for live streams
- Alert system for high traffic areas

## Troubleshooting

### Camera Won't Connect
- Verify RTSP is enabled in camera settings
- Check IP address is correct
- Ensure username/password are correct
- Check network connectivity

### No Heatmap Appearing
- Wait at least 30 seconds for first heatmap
- Check browser console for errors
- Verify detections are being saved (check Supabase)

### Stream Disconnects
- Check camera power and network connection
- Verify RTSP stream is still accessible
- Check backend logs for errors

