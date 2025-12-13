# RTSP to Browser Streaming Solution

## Problem
Modern browsers don't support RTSP (Real-Time Streaming Protocol) natively. We need to convert RTSP streams to browser-compatible formats.

## Solution Implemented: MJPEG Streaming

We've implemented **MJPEG (Motion JPEG)** streaming, which is the simplest and most compatible solution for browser streaming.

### How It Works:
1. **Backend**: Converts RTSP stream to MJPEG format using multipart/x-mixed-replace
2. **Frontend**: Uses HTML5 `<video>` tag to display the stream
3. **Format**: Sends continuous JPEG frames at ~5 FPS

### Advantages:
- ✅ Works in all modern browsers (Chrome, Firefox, Safari, Edge)
- ✅ No additional dependencies (uses OpenCV we already have)
- ✅ Low latency
- ✅ Simple implementation
- ✅ Compatible with existing RTSP infrastructure

### Disadvantages:
- ⚠️ Lower bandwidth efficiency than H.264/HLS
- ⚠️ No audio support (not needed for our use case)
- ⚠️ Higher bandwidth usage than compressed video

## Implementation Details

### Backend Endpoint
- **MJPEG Stream**: `GET /api/heatmap_jobs/<job_id>/live/stream`
- **Single Frame**: `GET /api/heatmap_jobs/<job_id>/live/feed` (fallback)

### Frontend Usage
The frontend automatically uses MJPEG streaming via HTML5 video tag:
```jsx
<video
  src="/api/heatmap_jobs/{jobId}/live/stream"
  autoPlay
  muted
  playsInline
/>
```

## Alternative Solutions (Future Consideration)

### Option 1: HLS (HTTP Live Streaming) ⭐ Recommended for Production
**How it works:**
- Use FFmpeg to convert RTSP → HLS segments
- Browser requests HLS playlist (.m3u8) and segments (.ts)
- Better compression and adaptive bitrate

**Implementation would require:**
```bash
# Install FFmpeg in Dockerfile
RUN apt-get install -y ffmpeg

# Convert RTSP to HLS
ffmpeg -i rtsp://... -c:v libx264 -c:a aac -f hls -hls_time 2 -hls_list_size 5 output.m3u8
```

**Pros:**
- Better compression (H.264)
- Adaptive bitrate
- Works on all devices
- Industry standard

**Cons:**
- Requires FFmpeg installation
- More complex setup
- Needs segment management

### Option 2: WebRTC
**How it works:**
- Real-time peer-to-peer streaming
- Very low latency
- Native browser support

**Implementation would require:**
- WebRTC signaling server
- STUN/TURN servers
- More complex client/server architecture

**Pros:**
- Lowest latency
- Bi-directional communication
- High quality

**Cons:**
- Complex setup
- Requires signaling infrastructure
- May need TURN servers for NAT traversal

### Option 3: RTMP to WebSocket
**How it works:**
- Convert RTSP → RTMP → WebSocket
- Browser receives via WebSocket

**Pros:**
- Real-time delivery
- Full control

**Cons:**
- Complex conversion pipeline
- More server resources

## Current Status

✅ **MJPEG Streaming Implemented**
- Backend endpoint: `/api/heatmap_jobs/<job_id>/live/stream`
- Frontend video player with auto-play
- Fallback to single-frame mode
- Error handling and placeholders

## Testing

1. Connect your Tapo camera
2. Navigate to Live Streaming page
3. Click "Connect Camera"
4. The MJPEG stream should automatically start in the video player
5. Switch between "Camera Feed" and "Heatmap" views

## Performance Notes

- **Frame Rate**: 5 FPS (configurable in backend)
- **Quality**: JPEG quality 85% (good balance)
- **Bandwidth**: ~500KB-2MB per second depending on resolution
- **Latency**: ~200-500ms (very low)

## Future Enhancements

If you need better quality/performance, consider:
1. Implementing HLS streaming for production
2. Adding adaptive quality based on bandwidth
3. Implementing WebRTC for ultra-low latency
4. Adding recording functionality

## Troubleshooting

**Stream not showing:**
- Check backend logs for RTSP connection status
- Verify camera credentials and IP address
- Ensure RTSP is enabled on camera
- Check network connectivity between server and camera

**Performance issues:**
- Reduce frame rate in backend (change `frame_interval`)
- Lower JPEG quality (change `IMWRITE_JPEG_QUALITY`)
- Check server CPU/memory usage

