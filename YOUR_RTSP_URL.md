# Your RTSP URL Setup

## Your Pinggy TCP Tunnel

```
tcp://ilnsw-180-190-180-228.a.free.pinggy.link:34863
```

## Convert to RTSP URL

**Your RTSP URL:**
```
rtsp://admin:password@ilnsw-180-190-180-228.a.free.pinggy.link:34863/stream1
```

## Replace These Parts

1. **`admin:password`** → Replace with your actual Tapo camera username and password
   - Format: `username:password`
   - Example: `admin:MyPassword123`

2. **`/stream1`** → Stream path (usually `/stream1` for Tapo cameras)
   - If `/stream1` doesn't work, try `/stream2`

## Complete Examples

**If your Tapo username is `admin` and password is `mypassword`:**
```
rtsp://admin:mypassword@ilnsw-180-190-180-228.a.free.pinggy.link:34863/stream1
```

**If your Tapo username is `admin` and password is `Pass123!`:**
```
rtsp://admin:Pass123!@ilnsw-180-190-180-228.a.free.pinggy.link:34863/stream1
```

## Use in Your App

1. **Open your Live Streaming page** in your app
2. **Enter the RTSP URL** field
3. **Paste:** `rtsp://admin:password@ilnsw-180-190-180-228.a.free.pinggy.link:34863/stream1`
   (Replace `admin:password` with your actual credentials)
4. **Click "Connect"**

## Finding Your Tapo Credentials

**Check Tapo App:**
1. Open Tapo app
2. Go to camera settings
3. Look for "RTSP" or "Network" settings
4. Note username and password

**Common Defaults:**
- Username: `admin`
- Password: The password you set in Tapo app

## Testing

### Test Locally First (Optional):
Before using in Railway, test locally with VLC Player:
```
rtsp://admin:password@192.168.254.111:554/stream1
```

If this works, the Pinggy version should work too!

### If `/stream1` Doesn't Work:
Try `/stream2` instead:
```
rtsp://admin:password@ilnsw-180-190-180-228.a.free.pinggy.link:34863/stream2
```

## Important Notes

⚠️ **Keep Pinggy SSH connected!** The tunnel closes if you disconnect SSH.

⚠️ **Tunnel expires in 60 minutes** (free tier). You'll need to reconnect.

⚠️ **Replace credentials** - Make sure to use your actual Tapo camera username and password!

## Troubleshooting

### Connection fails:
- Verify credentials are correct
- Try `/stream2` instead of `/stream1`
- Check Railway logs for error messages
- Make sure Pinggy SSH is still connected

### Tunnel expired:
- Reconnect SSH: `ssh -p 443 -R0:192.168.254.111:554 qr@free.pinggy.io`
- Get new TCP URL
- Update RTSP URL with new hostname/port

## Ready to Test!

1. Replace `admin:password` with your Tapo credentials
2. Use the RTSP URL in your Live Streaming page
3. Click Connect
4. Check Railway logs if it doesn't work

Your Pinggy tunnel is active and ready! 🎉

