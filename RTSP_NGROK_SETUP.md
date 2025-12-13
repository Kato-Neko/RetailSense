# Setting Up ngrok for RTSP Camera Access

**Alternative:** Consider using **Pinggy** instead - it's free, requires no signup, and easier to use! See `RTSP_PINGGY_SETUP.md` for details.

This guide will help you expose your local Tapo camera's RTSP stream to Railway cloud hosting using ngrok.

## Prerequisites

1. A Tapo camera with RTSP enabled
2. A computer on the same network as your camera (to run ngrok)
3. An ngrok account (free at https://ngrok.com)

## Step 1: Create ngrok Account

1. Go to https://ngrok.com/signup
2. Sign up for a free account
3. Verify your email
4. Copy your authtoken from the dashboard

## Step 2: Install ngrok

### Windows:
1. Download from https://ngrok.com/download
2. Extract to a folder (e.g., `C:\ngrok`)
3. Open PowerShell/Command Prompt as Administrator
4. Navigate to the ngrok folder

### Mac/Linux:
```bash
# Using Homebrew (Mac)
brew install ngrok

# Or download from https://ngrok.com/download
```

## Step 3: Authenticate ngrok

```bash
ngrok config add-authtoken YOUR_AUTH_TOKEN
```

Replace `YOUR_AUTH_TOKEN` with the token from your ngrok dashboard.

## Step 4: Find Your Camera's RTSP Port

Your Tapo camera's RTSP typically runs on port **554** (default RTSP port).

Common Tapo RTSP URL formats:
- `rtsp://admin:password@192.168.1.100:554/stream1`
- `rtsp://192.168.1.100:554/stream1`

Note down:
- Your camera's local IP (e.g., `192.168.1.100`)
- The RTSP port (usually `554`)

## Step 5: Create ngrok TCP Tunnel

Run this command in your terminal/PowerShell:

```bash
ngrok tcp 554
```

**Important**: This assumes your camera uses port 554. If different, replace `554` with your camera's port.

You'll see output like:
```
Forwarding    tcp://0.tcp.ngrok.io:12345 -> localhost:554
```

**Keep this terminal window open!** The tunnel closes if you close ngrok.

## Step 6: Get Your ngrok Public URL

From the ngrok output, copy the forwarding URL:
- Example: `0.tcp.ngrok.io:12345`
- Format: `HOSTNAME:PORT`

## Step 7: Convert to RTSP URL

Convert the ngrok URL to RTSP format:

**Original local URL:**
```
rtsp://admin:password@192.168.1.100:554/stream1
```

**New ngrok URL:**
```
rtsp://admin:password@0.tcp.ngrok.io:12345/stream1
```

**Keep the same:**
- Username and password (if any)
- Stream path (e.g., `/stream1`, `/stream2`)
- RTSP protocol (`rtsp://`)

**Change:**
- Host: `192.168.1.100` → `0.tcp.ngrok.io`
- Port: `554` → `12345` (or whatever ngrok shows)

## Step 8: Use in Your Application

1. **In your frontend Live Streaming page**, enter the ngrok RTSP URL:
   ```
   rtsp://admin:password@0.tcp.ngrok.io:12345/stream1
   ```

2. **Important Notes:**
   - The ngrok URL changes each time you restart ngrok (unless you have a paid plan)
   - The tunnel must be running whenever Railway needs to access the camera
   - Keep the computer running ngrok powered on and connected to the internet

## Step 9: Testing

1. Make sure ngrok is running (`ngrok tcp 554`)
2. Copy the forwarding URL from ngrok
3. Connect your stream in the application
4. Check Railway logs to verify connection

## Troubleshooting

### Tunnel dies when ngrok stops
- Keep ngrok running in a terminal window
- Consider using a service to keep it running (see below)

### ngrok URL changes on restart
- Free tier: URL changes every restart
- Paid tier: Can get static domains
- Alternative: Use ZeroTier for a permanent VPN solution

### Camera still not accessible
- Verify your local machine can access the camera: `ping 192.168.1.100`
- Check if the camera's RTSP port is correct
- Verify username/password in RTSP URL
- Check Railway logs for specific error messages

### Connection timeout
- Make sure ngrok is still running
- Verify the ngrok URL hasn't changed
- Check if your computer's firewall is blocking ngrok

## Keeping ngrok Running (Optional)

### Windows (PowerShell):
```powershell
# Run in background
Start-Process ngrok -ArgumentList "tcp 554" -WindowStyle Hidden
```

### Mac/Linux:
```bash
# Using nohup
nohup ngrok tcp 554 > ngrok.log 2>&1 &

# Or using screen
screen -S ngrok
ngrok tcp 554
# Press Ctrl+A then D to detach
```

## Alternative: Static ngrok URLs (Paid)

If you upgrade to ngrok's paid plan, you can get:
- Static TCP domain
- No need to update URLs each time
- More reliable for production

## Security Note

⚠️ **Important**: Exposing your camera via ngrok makes it publicly accessible:
- Use strong passwords
- Consider IP whitelisting if your ngrok plan supports it
- Monitor access logs in ngrok dashboard
- Only expose when needed, close tunnel when not in use

