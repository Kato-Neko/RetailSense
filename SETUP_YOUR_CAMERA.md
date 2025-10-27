# Setup for Your Camera (192.168.254.111)

## Step 1: Start Pinggy Tunnel

Run this command in PowerShell:

```powershell
ssh -p 443 -R0:192.168.254.111:554 qr@free.pinggy.io
```

**What this does:**
- Forwards your camera (192.168.254.111:554) through Pinggy
- Makes it accessible from Railway

## Step 2: Handle SSH Prompts

1. **"Are you sure you want to continue connecting?"**
   - Type: `yes` (full word, press Enter)

2. **"Password:"**
   - Just press **Enter** (leave blank - Pinggy free tier doesn't need password)

## Step 3: Get Your Public URL

After connecting, you'll see output like:

```
============================================================
Forwarding TCP Port 554
Public URL: tcp://a0.pinggy.online:12345
============================================================
```

**Copy the Public URL!** (e.g., `tcp://a0.pinggy.online:12345`)

## Step 4: Convert Your RTSP URL

### Your Local RTSP URL:
```
rtsp://admin:password@192.168.254.111:554/stream1
```

### Your New Pinggy RTSP URL:
```
rtsp://admin:password@a0.pinggy.online:12345/stream1
```

**Replace:**
- `a0.pinggy.online` → with the hostname from Step 3
- `12345` → with the port from Step 3
- Keep your username and password the same!

## Step 5: Use in Your App

1. Open your Live Streaming page
2. Enter the Pinggy RTSP URL:
   ```
   rtsp://admin:password@a0.pinggy.online:12345/stream1
   ```
3. Replace `admin:password` with your actual Tapo camera credentials
4. Click "Connect"

## Important Notes

⚠️ **Keep the SSH terminal window open!** The tunnel closes if you stop SSH.

⚠️ **Replace `admin:password`** with your actual Tapo camera username and password.

⚠️ **Stream path** - Tapo cameras usually use:
- `/stream1` - Main stream (high quality)
- `/stream2` - Sub stream (lower quality)

If `/stream1` doesn't work, try `/stream2`

## Troubleshooting

### If SSH doesn't work:
Use Pinggy Web Interface (easier!):
1. Visit: https://pinggy.io
2. TCP Tunnel
3. Local Host: `192.168.254.111`
4. Local Port: `554`
5. Get public URL

### Test locally first:
Try accessing your camera with VLC Player:
```
rtsp://admin:password@192.168.254.111:554/stream1
```

If this works locally, the Pinggy tunnel should work too!

## Quick Command Reference

**Start tunnel:**
```powershell
ssh -p 443 -R0:192.168.254.111:554 qr@free.pinggy.io
```

**Your RTSP URL format:**
```
rtsp://USERNAME:PASSWORD@PINGGY_HOST:PINGGY_PORT/stream1
```

**Example:**
```
rtsp://admin:mypassword@a0.pinggy.online:12345/stream1
```

