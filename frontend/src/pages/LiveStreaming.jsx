"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { Video, Camera, Wifi, Settings, Play, Square, Loader2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { heatmapService } from "../services/api"
import { useNavigate } from "react-router-dom"

const LiveStreaming = () => {
  const navigate = useNavigate()
  const [cameraConfig, setCameraConfig] = useState({
    cameraName: "",
    ipAddress: "",
    username: "",
    password: "",
    rtspUrl: "",
  })
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [streamStatus, setStreamStatus] = useState("disconnected") // disconnected, connecting, connected, error
  const [jobId, setJobId] = useState(null)
  const [liveStatus, setLiveStatus] = useState(null)
  const [heatmapInfo, setHeatmapInfo] = useState({ lastUpdated: null, intervalSec: 30 })
  const [heatmapUrl, setHeatmapUrl] = useState(null)
  const [cameraFeedUrl, setCameraFeedUrl] = useState(null)
  const [showFeed, setShowFeed] = useState(true) // Toggle between feed and heatmap
  const [feedError, setFeedError] = useState(false)
  const [useStream, setUseStream] = useState(true) // Use MJPEG stream vs single frames

  const handleInputChange = (field, value) => {
    setCameraConfig((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const buildRtspUrl = () => {
    const { ipAddress, username, password } = cameraConfig
    if (ipAddress && username && password) {
      return `rtsp://${username}:${password}@${ipAddress}/stream1`
    }
    return cameraConfig.rtspUrl || ""
  }

  const handleConnect = async () => {
    if (!cameraConfig.cameraName && !cameraConfig.ipAddress) {
      toast.error("Please provide camera name or IP address")
      return
    }

    setIsConnecting(true)
    setStreamStatus("connecting")

    try {
      const rtspUrl = buildRtspUrl()
      if (!rtspUrl) {
        toast.error("Please provide RTSP URL or camera credentials")
        setIsConnecting(false)
        setStreamStatus("disconnected")
        return
      }

      const response = await heatmapService.createLiveJob({
        rtsp_url: rtspUrl,
        camera_name: cameraConfig.cameraName || cameraConfig.ipAddress || "Unnamed Camera",
        points_data: [] // Will be configured later
      })

      setJobId(response.job_id)
      setIsConnected(true)
      setIsConnecting(false)
      setStreamStatus("connected")
      toast.success("Camera connected successfully!")
    } catch (error) {
      console.error("Connection error:", error)
      setIsConnecting(false)
      setStreamStatus("error")
      const errorMessage = error?.error || "Failed to connect to camera. Please check your settings."
      toast.error(errorMessage)
    }
  }

  const handleDisconnect = async () => {
    if (jobId) {
      try {
        await heatmapService.stopLiveJob(jobId)
        toast.success("Camera disconnected successfully")
      } catch (error) {
        console.error("Disconnect error:", error)
        toast.error("Failed to disconnect camera properly")
      }
    }
    setIsConnected(false)
    setStreamStatus("disconnected")
    setJobId(null)
  }

  // Poll for live stream status
  useEffect(() => {
    if (!jobId || !isConnected) return

    let isMounted = true;
    let retryCount = 0;
    let pollDelay = 5000; // 5 seconds initially
    let pollTimeout = null;
    let didShowError = false;

    const pollStatus = async () => {
      if (!isMounted) return;
      try {
        const status = await heatmapService.getLiveJobStatus(jobId);
        if (!isMounted) return;
        setLiveStatus(status)
        if (status?.heatmap_last_updated) {
          setHeatmapInfo({
            lastUpdated: status.heatmap_last_updated,
            intervalSec: status.heatmap_interval_seconds || 30
          })
        }
        retryCount = 0; // Reset on success
        pollDelay = 5000;
        didShowError = false;
        // Update connection status based on backend status
        if (status.status === 'live' && status.is_running) {
          setStreamStatus("connected")
          // Update heatmap URL with timestamp to force refresh
          const heatmapUrl = heatmapService.getLiveHeatmapImageUrl(jobId)
          setHeatmapUrl(`${heatmapUrl}?t=${Date.now()}`)

          // If live heatmap is available (HTTP 200), redirect to View Heatmap for consistent UX
          try {
            const checkUrl = heatmapService.getLiveHeatmapImageUrl(jobId) + `?check=${Date.now()}`
            const res = await fetch(checkUrl, { method: 'GET' })
            if (res.ok) {
              navigate(`/view-heatmap?jobId=${encodeURIComponent(jobId)}&live=1`, { replace: false })
            }
          } catch {}
        } else if (status.status === 'error') {
          setStreamStatus("error")
        } else if (status.status === 'stopped') {
          setIsConnected(false)
          setStreamStatus("disconnected")
        }
        // Schedule next poll
        pollTimeout = setTimeout(pollStatus, pollDelay);
      } catch (error) {
        if (!isMounted) return;
        // Only exponential backoff for timeout/network error
        if ((error?.error?.includes?.('timeout') || error?.error === 'Network error') && retryCount < 3) {
          retryCount++;
          pollDelay = pollDelay * 2;
          pollTimeout = setTimeout(pollStatus, pollDelay);
          if (!didShowError && retryCount === 3) {
            setStreamStatus("error");
            didShowError = true;
          }
        } else {
          setStreamStatus("error");
        }
      }
    }

    pollStatus(); // Start poll immediately

    return () => {
      isMounted = false;
      if (pollTimeout) clearTimeout(pollTimeout);
    }
  }, [jobId, isConnected])

  // Refresh camera feed (only for single-frame mode, not MJPEG stream)
  useEffect(() => {
    if (!jobId || !isConnected || !showFeed || useStream) return

    let abortController = new AbortController()
    let isMounted = true
    let failedAttempts = 0
    const MAX_FAILED_ATTEMPTS = 10 // Stop after 10 consecutive failures
    let feedInterval = null

    const refreshFeed = async () => {
      if (!isMounted || !showFeed || useStream) return
      
      try {
        const feedUrl = heatmapService.getLiveCameraFeedUrl(jobId)
        // Use a timestamp to bypass cache
        const url = `${feedUrl}?t=${Date.now()}`
        
        // Create an Image object to load the frame
        const img = new Image()
        img.onload = () => {
          if (isMounted && !useStream) {
            setCameraFeedUrl(url)
            setFeedError(false)
            failedAttempts = 0 // Reset counter on success
          }
        }
        img.onerror = () => {
          failedAttempts++
          if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
            console.error(`Camera feed failed to load ${MAX_FAILED_ATTEMPTS} times. Stopping refresh.`)
            setFeedError(true)
            if (feedInterval) {
              clearInterval(feedInterval)
              feedInterval = null
            }
          } else {
            console.warn(`Failed to load camera frame (${failedAttempts}/${MAX_FAILED_ATTEMPTS})`)
          }
        }
        img.src = url
      } catch (error) {
        failedAttempts++
        console.warn('Camera feed refresh error:', error)
        if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
          console.error(`Camera feed failed ${MAX_FAILED_ATTEMPTS} times. Stopping refresh.`)
          setFeedError(true)
          if (feedInterval) {
            clearInterval(feedInterval)
            feedInterval = null
          }
        }
      }
    }

    // Refresh immediately and then every 500ms (2 fps) for better performance
    refreshFeed()
    feedInterval = setInterval(refreshFeed, 500)

    return () => {
      isMounted = false
      abortController.abort()
      if (feedInterval) {
        clearInterval(feedInterval)
      }
    }
  }, [jobId, isConnected, showFeed, useStream])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Live Streaming</h1>
          <p className="text-muted-foreground mt-2">
            Connect your Tapo camera for real-time heatmap analysis
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Camera Configuration Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Camera Configuration
            </CardTitle>
            <CardDescription>
              Configure your Tapo camera connection settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs defaultValue="credentials" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="credentials">Credentials</TabsTrigger>
                <TabsTrigger value="advanced">Advanced</TabsTrigger>
              </TabsList>

              <TabsContent value="credentials" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="cameraName">Camera Name</Label>
                  <Input
                    id="cameraName"
                    placeholder="e.g., Store Entrance Camera"
                    value={cameraConfig.cameraName}
                    onChange={(e) => handleInputChange("cameraName", e.target.value)}
                    disabled={isConnected || isConnecting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ipAddress">IP Address</Label>
                  <Input
                    id="ipAddress"
                    placeholder="192.168.1.100"
                    value={cameraConfig.ipAddress}
                    onChange={(e) => handleInputChange("ipAddress", e.target.value)}
                    disabled={isConnected || isConnecting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    placeholder="Camera username"
                    value={cameraConfig.username}
                    onChange={(e) => handleInputChange("username", e.target.value)}
                    disabled={isConnected || isConnecting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Camera password"
                    value={cameraConfig.password}
                    onChange={(e) => handleInputChange("password", e.target.value)}
                    disabled={isConnected || isConnecting}
                  />
                </div>
              </TabsContent>

              <TabsContent value="advanced" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="rtspUrl">RTSP URL</Label>
                  <Input
                    id="rtspUrl"
                    placeholder="rtsp://username:password@ip/stream1"
                    value={cameraConfig.rtspUrl}
                    onChange={(e) => handleInputChange("rtspUrl", e.target.value)}
                    disabled={isConnected || isConnecting}
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave empty to auto-generate from credentials above
                  </p>
                </div>

                <Alert>
                  <Wifi className="h-4 w-4" />
                  <AlertDescription>
                    For Tapo cameras, enable RTSP in Advanced Settings → Camera Account.
                    Use the account credentials created there.
                  </AlertDescription>
                </Alert>
              </TabsContent>
            </Tabs>

            <div className="flex gap-2 pt-4">
              {!isConnected ? (
                <Button
                  onClick={handleConnect}
                  disabled={isConnecting}
                  className="flex-1"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Connect Camera
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={handleDisconnect}
                  variant="destructive"
                  className="flex-1"
                >
                  <Square className="mr-2 h-4 w-4" />
                  Disconnect
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stream Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5" />
              Stream Status
            </CardTitle>
            <CardDescription>
              Monitor your live stream connection
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Connection Status</Label>
                <div className="flex items-center gap-2">
                  <div
                    className={`h-3 w-3 rounded-full ${
                      streamStatus === "connected"
                        ? "bg-green-500 animate-pulse"
                        : streamStatus === "connecting"
                        ? "bg-yellow-500 animate-pulse"
                        : streamStatus === "error"
                        ? "bg-red-500"
                        : "bg-gray-400"
                    }`}
                  />
                  <span className="text-sm font-medium capitalize">{streamStatus}</span>
                </div>
              </div>

              {isConnected && (
                <>
                  <div className="flex items-center justify-between border-t pt-2">
                    <Label>Camera Name</Label>
                    <span className="text-sm">{cameraConfig.cameraName || cameraConfig.ipAddress || "Unnamed"}</span>
                  </div>
                  <div className="flex items-center justify-between border-t pt-2">
                    <Label>RTSP URL</Label>
                    <span className="text-xs text-muted-foreground font-mono truncate max-w-[200px]">
                      {buildRtspUrl()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t pt-2 text-xs">
                    <Label>Live Heatmap</Label>
                    <span className="text-muted-foreground">
                      {heatmapInfo.lastUpdated
                        ? `Updated ${new Date(heatmapInfo.lastUpdated * 1000).toLocaleTimeString()} • every ${heatmapInfo.intervalSec || 30}s`
                        : 'Generating… updates every 30s'}
                    </span>
                  </div>
                </>
              )}
            </div>

            {isConnected && (
              <div className="pt-4 border-t space-y-4">
                {liveStatus && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Frames Processed:</span>
                    <span className="font-medium">{liveStatus.frame_count || 0}</span>
                  </div>
                )}
                
                {/* Toggle between feed and heatmap */}
                <div className="flex gap-2">
                  <Button
                    variant={showFeed ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowFeed(true)}
                    className="flex-1"
                  >
                    <Camera className="mr-2 h-4 w-4" />
                    Camera Feed
                  </Button>
                  <Button
                    variant={!showFeed ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowFeed(false)}
                    className="flex-1"
                  >
                    <Video className="mr-2 h-4 w-4" />
                    Heatmap
                  </Button>
                </div>
                
                {/* Stream mode toggle */}
                {showFeed && jobId && (
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Stream Mode: {useStream ? 'MJPEG (Recommended)' : 'Single Frames'}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setUseStream(!useStream)
                        setFeedError(false)
                      }}
                      className="h-6 text-xs"
                    >
                      {useStream ? 'Switch to Frames' : 'Switch to Stream'}
                    </Button>
                  </div>
                )}

                <div className="aspect-video bg-muted rounded-lg overflow-hidden relative">
                  {showFeed ? (
                    // Camera Feed View
                    feedError && !useStream ? (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="text-center space-y-2">
                          <Camera className="h-12 w-12 mx-auto text-destructive" />
                          <p className="text-sm font-medium text-destructive">
                            Camera feed unavailable
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Failed to load frames. Try switching to stream mode.
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setUseStream(true)
                              setFeedError(false)
                            }}
                            className="mt-2"
                          >
                            Switch to Stream Mode
                          </Button>
                        </div>
                      </div>
                    ) : useStream && jobId ? (
                      // MJPEG Stream using img tag (more compatible than video tag)
                      <img
                        key={`stream-${jobId}-${Date.now()}`}
                        src={heatmapService.getLiveCameraStreamUrl(jobId)}
                        alt="Live Camera Stream"
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          console.error("Stream error:", e)
                          const target = e.target || e.currentTarget
                          console.error("Stream error details:", {
                            src: target?.src,
                            complete: target?.complete,
                            naturalWidth: target?.naturalWidth,
                            naturalHeight: target?.naturalHeight
                          })
                          setFeedError(true)
                        }}
                        onLoad={(e) => {
                          console.log("Stream loaded successfully")
                          setFeedError(false)
                        }}
                      />
                    ) : cameraFeedUrl ? (
                      // Single frame mode (fallback)
                      <>
                        <img 
                          src={cameraFeedUrl} 
                          alt="Live Camera Feed" 
                          className="w-full h-full object-contain"
                          onError={() => {
                            // Individual image error - don't clear URL, let retry logic handle it
                          }}
                        />
                        <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                          Live Feed
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="text-center space-y-2">
                          <Camera className="h-12 w-12 mx-auto text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">
                            Waiting for camera feed...
                          </p>
                        </div>
                      </div>
                    )
                  ) : (
                    // Heatmap View
                    heatmapUrl ? (
                      <>
                        <img 
                          src={heatmapUrl} 
                          alt="Live Heatmap" 
                          className="w-full h-full object-contain"
                          onError={() => {
                            setHeatmapUrl(null)
                          }}
                        />
                        <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                          Live Heatmap
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="text-center space-y-2">
                          <Video className="h-12 w-12 mx-auto text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">
                            Waiting for heatmap data...
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Heatmap updates every 30 seconds
                          </p>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

            {!isConnected && (
              <div className="pt-4 border-t">
                <Alert>
                  <Settings className="h-4 w-4" />
                  <AlertDescription>
                    Connect your camera to start live streaming and real-time heatmap analysis.
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Instructions Card */}
      {!isConnected && (
        <Card>
          <CardHeader>
            <CardTitle>Setup Instructions</CardTitle>
            <CardDescription>
              How to configure your Tapo camera for live streaming
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>Open the Tapo app on your device</li>
              <li>Navigate to your camera&apos;s settings</li>
              <li>Go to &quot;Advanced Settings&quot; → &quot;Camera Account&quot;</li>
              <li>Create a unique username and password for RTSP/ONVIF access</li>
              <li>Note down your camera&apos;s IP address from the device settings</li>
              <li>Enter the credentials and IP address in the form above</li>
              <li>Click &quot;Connect Camera&quot; to start streaming</li>
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default LiveStreaming

