# Option C: Local Relay Server for RTSP Streaming

A relay server runs on a local machine (computer/Raspberry Pi) that can access your camera and converts/relays the RTSP stream to Railway in a web-compatible format.

## How It Works

```
Camera (RTSP) → Local Relay Server → Railway Backend → Frontend
```

The relay server:
1. Connects to your local camera via RTSP
2. Converts the stream to a web-compatible format (HLS, WebRTC, or HTTP)
3. Makes it accessible to Railway

## Option C1: RTSP to HLS Relay (Recommended)

HLS (HTTP Live Streaming) is widely supported and works well for cloud deployments.

### Setup Steps:

#### 1. Install FFmpeg on Local Machine

**Windows:**
- Download from https://ffmpeg.org/download.html
- Extract and add to PATH

**Mac:**
```bash
brew install ffmpeg
```

**Linux:**
```bash
sudo apt-get install ffmpeg
```

#### 2. Create HLS Relay Script

Create a file `rtsp_relay.py`:

```python
import subprocess
import os
import time
from http.server import HTTPServer, BaseHTTPRequestHandler
import threading

class HLSRelay:
    def __init__(self, rtsp_url, output_dir, port=8080):
        self.rtsp_url = rtsp_url
        self.output_dir = output_dir
        self.port = port
        self.process = None
        
        # Create output directory
        os.makedirs(output_dir, exist_ok=True)
    
    def start_ffmpeg(self):
        """Start FFmpeg to convert RTSP to HLS"""
        cmd = [
            'ffmpeg',
            '-rtsp_transport', 'tcp',  # Use TCP for reliability
            '-i', self.rtsp_url,
            '-c:v', 'libx264',  # Video codec
            '-c:a', 'aac',      # Audio codec
            '-f', 'hls',
            '-hls_time', '2',   # 2 second segments
            '-hls_list_size', '5',  # Keep 5 segments
            '-hls_flags', 'delete_segments',  # Delete old segments
            '-hls_segment_filename', f'{self.output_dir}/segment_%03d.ts',
            f'{self.output_dir}/playlist.m3u8'
        ]
        
        self.process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        print(f"FFmpeg started with PID: {self.process.pid}")
    
    def stop(self):
        """Stop FFmpeg"""
        if self.process:
            self.process.terminate()
            self.process.wait()
            print("FFmpeg stopped")

class RelayHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/playlist.m3u8':
            # Serve HLS playlist
            try:
                with open('hls_output/playlist.m3u8', 'rb') as f:
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/vnd.apple.mpegurl')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(f.read())
            except FileNotFoundError:
                self.send_error(404)
        elif self.path.endswith('.ts'):
            # Serve video segments
            try:
                filename = 'hls_output' + self.path
                with open(filename, 'rb') as f:
                    self.send_response(200)
                    self.send_header('Content-Type', 'video/mp2t')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(f.read())
            except FileNotFoundError:
                self.send_error(404)
        else:
            self.send_error(404)

if __name__ == '__main__':
    # Configuration
    RTSP_URL = "rtsp://admin:password@192.168.1.100:554/stream1"
    OUTPUT_DIR = "hls_output"
    HTTP_PORT = 8080
    
    relay = HLSRelay(RTSP_URL, OUTPUT_DIR)
    
    try:
        # Start FFmpeg conversion
        relay.start_ffmpeg()
        
        # Start HTTP server to serve HLS files
        httpd = HTTPServer(('0.0.0.0', HTTP_PORT), RelayHandler)
        print(f"HLS Relay Server running on http://localhost:{HTTP_PORT}")
        print(f"Access playlist at: http://localhost:{HTTP_PORT}/playlist.m3u8")
        
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping relay server...")
        relay.stop()
        httpd.shutdown()
```

#### 3. Expose Relay Server with ngrok

```bash
# Start the relay server
python rtsp_relay.py

# In another terminal, expose it with ngrok
ngrok http 8080
```

#### 4. Update Railway Backend

Modify your backend to use the HLS URL instead of RTSP:

```python
# Instead of RTSP URL, use ngrok HLS URL
hls_url = "https://your-ngrok-url.ngrok.io/playlist.m3u8"
```

## Option C2: Simple RTSP to HTTP Proxy

A lighter solution that just proxies RTSP frames as JPEG/MJPEG:

```python
import cv2
from http.server import HTTPServer, BaseHTTPRequestHandler
import threading

class MJPEGStreamHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/stream':
            self.send_response(200)
            self.send_header('Content-Type', 'multipart/x-mixed-replace; boundary=frame')
            self.end_headers()
            
            cap = cv2.VideoCapture("rtsp://admin:password@192.168.1.100:554/stream1")
            
            try:
                while True:
                    ret, frame = cap.read()
                    if not ret:
                        break
                    
                    # Encode frame as JPEG
                    _, buffer = cv2.imencode('.jpg', frame)
                    frame_bytes = buffer.tobytes()
                    
                    # Send frame
                    self.wfile.write(b'--frame\r\n')
                    self.wfile.write(b'Content-Type: image/jpeg\r\n\r\n')
                    self.wfile.write(frame_bytes)
                    self.wfile.write(b'\r\n')
            finally:
                cap.release()

def run_server():
    server = HTTPServer(('0.0.0.0', 8080), MJPEGStreamHandler)
    print("MJPEG Relay Server running on http://localhost:8080/stream")
    server.serve_forever()

if __name__ == '__main__':
    run_server()
```

Then expose with ngrok:
```bash
ngrok http 8080
```

## Option C3: Use MediaMTX (formerly rtsp-simple-server)

MediaMTX is a professional media server that can relay RTSP streams.

### Installation:
```bash
# Download from https://github.com/bluenviron/mediamtx/releases
# Or use Docker:
docker run -p 8554:8554 -p 1935:1935 bluenviron/mediamtx
```

### Configuration:
```yaml
# mediamtx.yml
paths:
  camera:
    source: rtsp://admin:password@192.168.1.100:554/stream1
    sourceOnDemand: yes
```

### Access:
- RTSP: `rtsp://localhost:8554/camera`
- HLS: `http://localhost:8080/camera/hls.m3u8`
- WebRTC: `http://localhost:8080/camera/webrtc`

Then expose MediaMTX with ngrok.

## Option C4: Use Node-RED (Visual Programming)

Good for non-programmers:

1. Install Node-RED: `npm install -g node-red`
2. Use RTSP nodes to convert stream
3. Expose via HTTP endpoint
4. Use ngrok to make accessible

## Pros and Cons

**Pros:**
- More reliable than direct RTSP tunneling
- Can convert to web-compatible formats
- Can add authentication/security
- Can process/compress video before sending

**Cons:**
- Requires a computer running 24/7
- Still needs ngrok or similar tunnel
- Uses local machine resources
- Additional complexity

## Recommended Setup

For your use case, I recommend:
1. **MediaMTX** (if you want professional solution)
2. **Simple MJPEG proxy** (if you want simplicity)
3. **HLS relay** (if you want best compatibility)

All solutions require:
- A local machine always running
- ngrok to expose to internet
- Same network access as camera

