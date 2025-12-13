# Correct Pinggy Setup for Camera on Local Network

## The Problem

Your camera is on your local network (e.g., `192.168.1.100`), NOT on localhost (`127.0.0.1`).

## Solution: Forward Camera's IP Address

### Step 1: Find Your Camera's IP Address

**Option A: Check Tapo App**
1. Open Tapo app
2. Go to camera settings
3. Look for "Network" or "IP Address"
4. Note the IP (e.g., `192.168.1.100`)

**Option B: Ping All Devices**
```powershell
# Scan your network (replace 192.168.1 with your network)
for ($i=1; $i -le 254; $i++) {
    ping -n 1 -w 100 "192.168.1.$i" | findstr "TTL"
}
```

**Option C: Check Router**
- Log into your router admin panel
- Look at connected devices
- Find your Tapo camera

### Step 2: Forward Camera's IP Through Pinggy

Once you know your camera's IP (let's say it's `192.168.1.100`):

```powershell
ssh -p 443 -R0:192.168.1.100:554 qr@free.pinggy.io
```

**Important:** Replace `192.168.1.100` with YOUR camera's actual IP address!

### Step 3: Get Public URL

After connecting, Pinggy will show:
```
Public URL: tcp://a0.pinggy.online:12345
```

### Step 4: Use in RTSP URL

**Your local RTSP URL:**
```
rtsp://admin:password@192.168.1.100:554/stream1
```

**Your new Pinggy RTSP URL:**
```
rtsp://admin:password@a0.pinggy.online:12345/stream1
```

## Alternative: Set Up Local Port Forwarding First

If forwarding the camera IP directly doesn't work, set up local forwarding first:

### Method 1: Using netsh (Windows)

```powershell
# Forward localhost:554 to camera IP:554
netsh interface portproxy add v4tov4 listenport=554 listenaddress=127.0.0.1 connectport=554 connectaddress=192.168.1.100
```

Then use the original SSH command:
```powershell
ssh -p 443 -R0:127.0.0.1:554 qr@free.pinggy.io
```

### Method 2: Use Pinggy Web Interface

Easier option - no SSH needed:

1. Visit: https://pinggy.io
2. Select "TCP Tunnel"
3. Enter:
   - **Local Host:** `192.168.1.100` (your camera IP)
   - **Local Port:** `554` (your camera RTSP port)
4. Click "Create Tunnel"
5. Copy the public URL

## Complete Example

Let's say your camera is at `192.168.1.100`:

```powershell
# SSH command
ssh -p 443 -R0:192.168.1.100:554 qr@free.pinggy.io

# Output shows:
# Public URL: tcp://a0.pinggy.online:12345

# Your RTSP URL becomes:
# rtsp://admin:password@a0.pinggy.online:12345/stream1
```

## Finding Your Camera's IP Address

### Quick Method - Check Tapo App:
1. Open Tapo app
2. Select your camera
3. Go to Settings → Network
4. Look for "IP Address"

Common formats:
- `192.168.1.XXX`
- `192.168.0.XXX`
- `10.0.0.XXX`

### Verify RTSP Port:
Usually `554` (default RTSP port), but check:
- Tapo App → Camera Settings → RTSP
- Look for "RTSP Port"

## Troubleshooting

### "Connection refused" or "Can't connect"
- Verify camera IP is correct: `ping 192.168.1.100`
- Check camera's RTSP port (usually 554)
- Ensure camera RTSP is enabled in Tapo app
- Test locally first: Try accessing `rtsp://admin:password@192.168.1.100:554/stream1` from VLC player

### SSH Connection Issues
- Use Pinggy web interface instead: https://pinggy.io
- Check firewall isn't blocking port 443
- Try without password (just press Enter)

### Still Not Working?
Use the **Pinggy Web Interface** - it's easier:
1. Go to https://pinggy.io
2. Enter camera IP and port
3. Get public URL instantly

