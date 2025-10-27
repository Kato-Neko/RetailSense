# Your RTSP URL

## Your Pinggy TCP URL:
```
tcp://nbmyv-180-190-180-228.a.free.pinggy.link:44047
```

## Converted to RTSP URL:
```
rtsp://admin:password@nbmyv-180-190-180-228.a.free.pinggy.link:44047/stream1
```

## What You Need to Replace:

**Replace `admin:password` with your actual Tapo camera credentials:**

1. **Username** - Usually `admin` (check Tapo app settings)
2. **Password** - Your Tapo camera password

## Example:

If your Tapo username is `admin` and password is `MyPassword123`:
```
rtsp://admin:MyPassword123@nbmyv-180-190-180-228.a.free.pinggy.link:44047/stream1
```

## Use in Your App:

1. Open your **Live Streaming** page
2. In the RTSP URL field, enter:
   ```
   rtsp://admin:YOUR_PASSWORD@nbmyv-180-190-180-228.a.free.pinggy.link:44047/stream1
   ```
3. Replace `YOUR_PASSWORD` with your actual password
4. Click **"Connect"**

## If `/stream1` Doesn't Work:

Try `/stream2` instead:
```
rtsp://admin:password@nbmyv-180-190-180-228.a.free.pinggy.link:44047/stream2
```

## Finding Your Tapo Credentials:

1. Open **Tapo app**
2. Go to your camera → **Settings**
3. Look for **"RTSP"** or **"Network"** settings
4. Note your username and password

## Important Notes:

⚠️ **Keep Pinggy SSH connected!** The tunnel closes if you disconnect.

⚠️ **Tunnel expires in 60 minutes** (free tier) - reconnect if needed.

⚠️ **Make sure you used SSH with camera IP**, not localhost:
   ```powershell
   ssh -p 443 -R0:192.168.254.111:554 qr@free.pinggy.io
   ```

## Your Final RTSP URL Template:

```
rtsp://USERNAME:PASSWORD@nbmyv-180-190-180-228.a.free.pinggy.link:44047/stream1
```

Just replace `USERNAME:PASSWORD` with your actual Tapo credentials!

