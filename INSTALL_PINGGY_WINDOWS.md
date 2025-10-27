# Installing Pinggy on Windows - Step by Step

## Method 1: Download Binary (Recommended)

### Step 1: Download Pinggy
1. Go to: https://pinggy.io/download
2. Find the Windows section
3. Download the `.exe` file (or `.zip` if available)

### Step 2: Extract/Place the File
1. Create a folder: `C:\pinggy` (or any location you prefer)
2. Place `pinggy.exe` in that folder

### Step 3: Run Pinggy
**Option A: Run from the folder**
```powershell
# Navigate to the folder
cd C:\pinggy

# Run pinggy
.\pinggy.exe tcp 554
```

**Option B: Add to PATH (run from anywhere)**
1. Copy the folder path (e.g., `C:\pinggy`)
2. Search for "Environment Variables" in Windows
3. Click "Environment Variables"
4. Under "User variables", find "Path" and click "Edit"
5. Click "New" and add: `C:\pinggy`
6. Click OK on all windows
7. Close and reopen PowerShell
8. Now you can run: `pinggy tcp 554` from anywhere

## Method 2: Use Pinggy Online (No Installation!)

**Easiest option - no installation needed:**

1. Visit: https://pinggy.io
2. Use the web interface
3. Select "TCP Tunnel"
4. Enter port: `554`
5. Click "Create Tunnel"
6. Copy the public URL provided
7. Use that URL in your RTSP connection

## Method 3: Install via Scoop (If you have Scoop)

If you already have Scoop package manager installed:

```powershell
scoop install pinggy
```

If you don't have Scoop, you can install it first:
```powershell
# Install Scoop first
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
irm get.scoop.sh | iex

# Then install Pinggy
scoop install pinggy
```

## Quick Test After Installation

Once installed, test it:

```powershell
pinggy tcp 554
```

You should see output like:
```
============================================================
Forwarding TCP Port 554
Public URL: tcp://a0.pinggy.online:12345
============================================================
```

## Troubleshooting

### "pinggy is not recognized"
- Make sure you're running from the correct directory where `pinggy.exe` is located
- Or add it to your PATH (see Method 1, Option B above)
- Or use the online version (Method 2) - no installation needed!

### Download Link Not Working
- Try: https://github.com/infocrev/pinggy/releases
- Look for Windows binaries in the latest release

### Alternative: Use Online Version
If installation is problematic, just use the web interface:
- Go to https://pinggy.io
- Create tunnel via web UI
- No installation required!

## Recommended: Use Online Version First

For quick testing, I recommend:
1. Visit https://pinggy.io
2. Create TCP tunnel for port 554
3. Copy the public URL
4. Use it in your app

This way you can test immediately without any installation!

