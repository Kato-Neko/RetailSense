# Fix: Create TCP Tunnel for RTSP

## The Issue

You got an HTTP/HTTPS URL, but RTSP needs a **TCP tunnel**.

## Solution: Create TCP Tunnel

### Using SSH:

If you're still connected to SSH, disconnect first (`Ctrl+C`), then run:

```powershell
ssh -p 443 -R0:192.168.254.111:554 qr@free.pinggy.io
```

Make sure to forward the **camera's IP** (192.168.254.111), not localhost!

### What You Should See:

After connecting, you should see output like:

```
Forwarding TCP Port 554
Public URL: tcp://a0.pinggy.online:12345
```

**NOT** HTTP/HTTPS URLs!

## Alternative: Use Pinggy Web Interface

1. Visit: https://pinggy.io
2. Click **"TCP Tunnel"** (not HTTP!)
3. Enter:
   - **Local Host:** `192.168.254.111`
   - **Local Port:** `554`
4. Click "Create Tunnel"
5. You'll get a TCP URL like: `tcp://a0.pinggy.online:12345`

## Convert to RTSP URL

Once you have the TCP URL (e.g., `tcp://a0.pinggy.online:12345`):

**Your RTSP URL becomes:**
```
rtsp://admin:password@a0.pinggy.online:12345/stream1
```

Replace:
- `a0.pinggy.online` → Your Pinggy hostname
- `12345` → Your Pinggy port
- `admin:password` → Your Tapo camera credentials

## What You Got vs What You Need

**What you got (HTTP tunnel):**
```
http://rfmyy-180-190-180-228.a.free.pinggy.link
```

**What you need (TCP tunnel):**
```
tcp://a0.pinggy.online:12345
```

The HTTP tunnel won't work for RTSP streaming!

## Next Steps

1. **Disconnect current SSH** (if still connected): Press `Ctrl+C`
2. **Create TCP tunnel** using the SSH command above or web interface
3. **Get TCP URL** (should show `tcp://hostname:port`)
4. **Convert to RTSP URL** format
5. **Use in your app**

Try the SSH command again, making sure it shows a TCP URL, not HTTP!

