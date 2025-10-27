"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { Video, Camera, Wifi, Settings, Play, Square, Loader2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

const LiveStreaming = () => {
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

      // TODO: Replace with actual API call when backend is ready
      // const response = await fetch('/api/heatmap_jobs/live', {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     'Authorization': `Bearer ${localStorage.getItem('access_token')}`
      //   },
      //   body: JSON.stringify({
      //     rtsp_url: rtspUrl,
      //     camera_name: cameraConfig.cameraName || cameraConfig.ipAddress,
      //     points_data: [] // Will be configured later
      //   })
      // })

      // Simulate connection for now
      await new Promise((resolve) => setTimeout(resolve, 2000))

      setIsConnected(true)
      setIsConnecting(false)
      setStreamStatus("connected")
      toast.success("Camera connected successfully!")
    } catch (error) {
      console.error("Connection error:", error)
      setIsConnecting(false)
      setStreamStatus("error")
      toast.error("Failed to connect to camera. Please check your settings.")
    }
  }

  const handleDisconnect = () => {
    setIsConnected(false)
    setStreamStatus("disconnected")
    toast.info("Camera disconnected")
  }

  const handleStopStream = () => {
    // TODO: Implement stop stream API call
    setIsConnected(false)
    setStreamStatus("disconnected")
    toast.info("Stream stopped")
  }

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
                </>
              )}
            </div>

            {isConnected && (
              <div className="pt-4 border-t">
                <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                  <div className="text-center space-y-2">
                    <Video className="h-12 w-12 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Live stream preview will appear here
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Backend integration coming soon
                    </p>
                  </div>
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

