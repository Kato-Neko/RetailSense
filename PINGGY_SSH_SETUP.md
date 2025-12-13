# Using Pinggy via SSH (No Installation Required)

Pinggy works via SSH - you don't need to install anything!

## Step 1: Create TCP Tunnel for RTSP

Run this command in PowerShell or Command Prompt:

```powershell
ssh -p 443 -R0:127.0.0.1:554 qr@free.pinggy.io
```

**Important:** 
- Change `554` to your camera's RTSP port (usually 554)
- This forwards port 554 (your camera's RTSP port) through Pinggy

## Step 2: Handle the SSH Prompt

When prompted:
1. Type `yes` (not just `y`) to accept the fingerprint
2. For password: **Leave blank and press Enter** (Pinggy doesn't require a password on free tier)

## Step 3: Get Your Public URL

After connecting, you'll see output like:

```
============================================================
Forwarding TCP Port 554
Public URL: tcp://a0.pinggy.online:12345
============================================================
```

Copy the **Public URL** shown.

## Step 4: Convert Your RTSP URL

**Your local RTSP URL:**
```
rtsp://admin:password@192.168.1.100:554/stream1
```

**Your new Pinggy RTSP URL:**
```
rtsp://admin:password@a0.pinggy.online:12345/stream1
```

Replace:
- `a0.pinggy.online` with the hostname from Step 3
- `12345` with the port from Step 3

## Step 5: Keep SSH Connection Open

**Important:** Keep the SSH terminal window open! The tunnel closes if you close the SSH connection.

To keep it running in background (PowerShell):
```powershell
Start-Process ssh -ArgumentList "-p 443 -R0:127.0.0.1:554 qr@free.pinggy.io"
```

## Troubleshooting

### "Connection reset by peer"
- Make sure port 554 is correct for your camera
- Try the command again
- Check if your firewall is blocking SSH (port 443)

### Password Prompt
- Just press **Enter** (leave password blank)
- Pinggy free tier doesn't require authentication

### Port Already in Use
If you see "address already in use":
- Wait a few seconds and try again
- Or use a different port temporarily for testing

### Can't Connect
Try these alternatives:
1. **Use Pinggy Web Interface** (easiest): https://pinggy.io
2. **Check your SSH client** - Windows 10+ has SSH built-in
3. **Test connection**: `ssh -p 443 qr@free.pinggy.io` (without tunnel, just to test)

## Alternative: Use Pinggy Web Interface

If SSH is giving you trouble:

1. Visit: https://pinggy.io
2. Click "TCP Tunnel"
3. Enter local port: `554`
4. Click "Create Tunnel"
5. Copy the public URL
6. Use it in your RTSP URL

No SSH needed!

## Quick Reference

**Start tunnel:**
```powershell
ssh -p 443 -R0:127.0.0.1:554 qr@free.pinggy.io
```

**Your RTSP URL format:**
```
rtsp://username:password@PINGGY_HOST:PINGGY_PORT/stream1
```

**Example:**
```
rtsp://admin:mypassword@a0.pinggy.online:12345/stream1
```

