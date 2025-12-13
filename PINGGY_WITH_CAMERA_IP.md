# Solution: Forward Camera IP Through Pinggy

## The Problem

Pinggy web interface only forwards `localhost`, but your camera is at `192.168.254.111`.

## Solution: Forward Camera IP to Localhost First

We need to forward `localhost:554` → `192.168.254.111:554`, then Pinggy can access it.

### Method 1: Use SSH with Camera IP (Easiest)

Instead of Pinggy web interface, use SSH directly:

```powershell
ssh -p 443 -R0:192.168.254.111:554 qr@free.pinggy.io
```

This forwards the camera's IP directly through Pinggy. You already got:
```
tcp://ilnsw-180-190-180-228.a.free.pinggy.link:34863
```

This should work! Just use the RTSP URL with your credentials.

### Method 2: Set Up Local Port Forwarding (If SSH doesn't work)

If you prefer using Pinggy web interface, set up local forwarding first:

#### Step 1: Forward Localhost to Camera

**Windows PowerShell (Run as Administrator):**

```powershell
netsh interface portproxy add v4tov4 listenport=554 listenaddress=127.0.0.1 connectport=554 connectaddress=192.168.254.111
```

This forwards `localhost:554` → `192.168.254.111:554`

#### Step 2: Use Pinggy Web Interface

Now when Pinggy web interface forwards `localhost:554`, it will actually forward to your camera!

1. Visit: https://pinggy.io
2. TCP Tunnel
3. Local Port: `554`
4. Create tunnel
5. Get TCP URL

#### Step 3: Clean Up Later (Optional)

When done, remove the port forwarding:
```powershell
netsh interface portproxy delete v4tov4 listenport=554 listenaddress=127.0.0.1
```

## Method 3: Use the SSH URL You Already Have

You already have a working SSH tunnel:
```
tcp://ilnsw-180-190-180-228.a.free.pinggy.link:34863
```

**If you used SSH with camera IP**, this should work! Use:
```
rtsp://admin:password@ilnsw-180-190-180-228.a.free.pinggy.link:34863/stream1
```

## Which Method Did You Use?

**If you used SSH command with camera IP:**
- Your tunnel should work! Use the RTSP URL with credentials.

**If you used Pinggy web interface:**
- Set up port forwarding first (Method 2 above)
- Or switch to SSH method (Method 1)

## Verify Your Setup

Test if localhost forwarding works:
```powershell
# Test if you can access camera via localhost (after setting up port forwarding)
ping 192.168.254.111
```

## Recommended: Use SSH Method

The SSH method is simpler - just run:
```powershell
ssh -p 443 -R0:192.168.254.111:554 qr@free.pinggy.io
```

Then use the TCP URL you get in your RTSP URL format!

