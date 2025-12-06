# Setting Up Pinggy for RTSP Camera Access

Pinggy is a free tunneling service that's easier to use than ngrok - no signup required! Perfect for exposing your Tapo camera's RTSP stream to Railway.

## Why Pinggy?

✅ **Free** - No signup required for basic use  
✅ **No authentication needed** - Works out of the box  
✅ **TCP support** - Perfect for RTSP streams  
✅ **Persistent URLs** - URLs don't change between sessions (free tier)  
✅ **Simple setup** - One command to get started  

## Step 1: Install Pinggy

### Windows:
**Option 1: Download Binary (Easiest)**
1. Visit: https://pinggy.io/download
2. Download the Windows binary (.exe file)
3. Extract/place the `pinggy.exe` file in a folder (e.g., `C:\pinggy`)
4. Add to PATH or run directly:
   ```powershell
   # Navigate to where you saved pinggy.exe
   cd C:\pinggy
   .\pinggy.exe tcp 554
   ```

**Option 2: Using Scoop (if you have Scoop installed)**
```powershell
scoop install pinggy
```

**Option 3: Use Pinggy Online (No Installation)**
- Visit: https://pinggy.io
- Use the web interface to create tunnels
- No installation needed!

### Mac:
```bash
brew install pinggy
```

### Linux:
```bash
# Download the binary
wget https://pinggy.io/download/linux/pinggy -O pinggy
chmod +x pinggy
sudo mv pinggy /usr/local/bin/
```

### Or use online version (no install):
Pinggy also offers an online dashboard - just visit https://pinggy.io

## Step 2: Create TCP Tunnel for RTSP

Run this command to create a TCP tunnel:

```bash
pinggy tcp 554
```

**Replace `554` with your camera's RTSP port if different.**

You'll see output like:
```
============================================================
Forwarding TCP Port 554
Public URL: tcp://a0.pinggy.online:12345
============================================================
```

**Important:** Keep this terminal window open! The tunnel closes if you stop Pinggy.

## Step 3: Convert RTSP URL

### Your original local URL:
```
rtsp://admin:password@192.168.1.100:554/stream1
```

### Your new Pinggy URL:
```
rtsp://admin:password@a0.pinggy.online:12345/stream1
```

**What changed:**
- Host: `192.168.1.100` → `a0.pinggy.online`
- Port: `554` → `12345` (the port Pinggy provides)

**What stays the same:**
- Username and password
- Stream path (`/stream1`)
- RTSP protocol

## Step 4: Use in Your Application

1. **In your frontend Live Streaming page**, enter the Pinggy RTSP URL:
   ```
   rtsp://admin:password@a0.pinggy.online:12345/stream1
   ```

2. **Make sure Pinggy is running** whenever Railway needs to access the camera

## Step 5: Advanced Options

### Get a Custom Subdomain (Optional)

If you want a custom URL instead of random one:

```bash
pinggy tcp 554 --subdomain my-camera
```

Then use:
```
rtsp://admin:password@my-camera.pinggy.online:12345/stream1
```

### Background Mode (Keep Running)

**Windows (PowerShell):**
```powershell
Start-Process pinggy -ArgumentList "tcp 554" -WindowStyle Hidden
```

**Mac/Linux:**
```bash
# Using nohup
nohup pinggy tcp 554 > pinggy.log 2>&1 &

# Or using screen
screen -S pinggy
pinggy tcp 554
# Press Ctrl+A then D to detach
```

### Check Status

In another terminal:
```bash
pinggy status
```

## Step 6: Testing

1. **Test locally first:**
   ```bash
   # Test your camera locally (replace with your actual URL)
   ffplay rtsp://admin:password@192.168.1.100:554/stream1
   ```

2. **Test through Pinggy:**
   ```bash
   # Test through Pinggy tunnel
   ffplay rtsp://admin:password@a0.pinggy.online:12345/stream1
   ```

3. **Test in your app:**
   - Start Pinggy tunnel
   - Connect stream in your Live Streaming page
   - Check Railway logs for connection status

## Comparison: Pinggy vs ngrok

| Feature | Pinggy | ngrok |
|---------|--------|-------|
| Signup Required | ❌ No | ✅ Yes |
| Free Tier | ✅ Yes | ✅ Yes |
| TCP Support | ✅ Yes | ✅ Yes |
| Persistent URLs | ✅ Yes (custom subdomain) | ❌ No (free) |
| Background Mode | ✅ Yes | ✅ Yes |
| Custom Domain | ✅ Free | 💰 Paid |
| Bandwidth Limit | High | Medium |

## Troubleshooting

### Connection Timeout
- Verify Pinggy is still running
- Check if the Pinggy URL has changed
- Verify camera's RTSP port is correct
- Check local machine can access camera: `ping 192.168.1.100`

### Tunnel Dies
- Keep Pinggy terminal window open
- Use background mode (see above)
- Check if computer went to sleep

### RTSP Connection Fails
- Verify RTSP URL format is correct
- Check username/password
- Ensure stream path is correct (`/stream1` or `/stream2`)
- Test local RTSP first: `rtsp://admin:password@192.168.1.100:554/stream1`

### Railway Can't Connect
- Ensure Pinggy is running
- Copy the exact Pinggy URL (hostname and port)
- Check Railway logs for specific error
- Verify Pinggy URL format: `rtsp://username:password@PINGGY_HOST:PINGGY_PORT/stream1`

## Security Notes

⚠️ **Important Security Considerations:**

1. **Strong Password:** Use complex passwords for RTSP authentication
2. **Exposure:** Your camera becomes publicly accessible via Pinggy URL
3. **Monitoring:** Monitor Pinggy logs for unauthorized access
4. **Turn Off When Not Needed:** Stop Pinggy when not streaming

## Quick Reference

### Start Tunnel:
```bash
pinggy tcp 554
```

### Get Custom Subdomain:
```bash
pinggy tcp 554 --subdomain my-camera
```

### Check Status:
```bash
pinggy status
```

### Stop Tunnel:
Press `Ctrl+C` in the Pinggy terminal

## Example Complete Setup

```bash
# Terminal 1: Start Pinggy tunnel
pinggy tcp 554 --subdomain tapo-camera

# Output shows:
# tcp://tapo-camera.pinggy.online:12345

# Use in your app:
# rtsp://admin:password@tapo-camera.pinggy.online:12345/stream1
```

## Integration with Your Railway Backend

After setting up Pinggy, your RTSP URL in the frontend will be:

```
rtsp://admin:password@tapo-camera.pinggy.online:12345/stream1
```

Railway will be able to access this URL because Pinggy makes it publicly available on the internet.

## Keeping Pinggy Running 24/7

For production use, you may want Pinggy to always run:

### Windows Task Scheduler:
1. Create a batch file `start_pinggy.bat`:
   ```batch
   pinggy tcp 554 --subdomain tapo-camera
   ```
2. Schedule it to run at startup

### Linux systemd Service:
Create `/etc/systemd/system/pinggy-tunnel.service`:
```ini
[Unit]
Description=Pinggy RTSP Tunnel
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/pinggy tcp 554 --subdomain tapo-camera
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl enable pinggy-tunnel
sudo systemctl start pinggy-tunnel
```

## Next Steps

1. Install Pinggy on a computer that can access your camera
2. Start the tunnel: `pinggy tcp 554`
3. Copy the Pinggy URL (e.g., `tcp://a0.pinggy.online:12345`)
4. Convert your RTSP URL to use Pinggy hostname and port
5. Use the new URL in your Live Streaming page
6. Keep Pinggy running while using the stream

## Additional Resources

- Pinggy Website: https://pinggy.io
- Pinggy Docs: https://pinggy.io/docs
- Pinggy Download: https://pinggy.io/download

