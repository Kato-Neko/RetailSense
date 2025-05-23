"use client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Upload } from "lucide-react"

const VideoSelectionStep = ({ file, videoPreviewUrl, onFileChange, onNext, isValid }) => {
  const handleFileInputChange = (e) => {
    const selectedFile = e.target.files[0]
    if (selectedFile) {
      onFileChange(selectedFile)
    }
  }

  return (
    <Card className="w-full h-full border-none bg-transparent shadow-none">
      <CardContent className="p-5 h-full flex flex-col">
        <h2 className="text-xl font-semibold mb-3 bg-gradient-to-r from-blue-400 to-cyan-400 text-transparent bg-clip-text">
          Step 1: Select Video File
        </h2>

        <div className="flex-1 mb-4">
          {!file ? (
            // Show upload area when no file is selected
            <div className="h-full">
              <p className="text-muted-foreground mb-4">
                Please upload a valid video file to begin the heatmap creation process.
              </p>

              <label className="flex flex-col items-center justify-center w-full h-56 border-2 border-dashed border-border rounded-lg cursor-pointer bg-muted/40 hover:bg-muted/60 transition-all duration-300">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <div className="rounded-full bg-gradient-to-br from-blue-900/50 to-cyan-900/50 w-16 h-16 flex items-center justify-center mb-4">
                    <Upload className="w-8 h-8 text-blue-400" />
                  </div>
                  <p className="mb-2 text-sm text-muted-foreground">
                    <span className="font-semibold">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-muted-foreground">MP4, AVI, MOV (MAX. 100MB)</p>
                </div>
                <input type="file" className="hidden" accept="video/*" onChange={handleFileInputChange} />
              </label>
            </div>
          ) : (
            // Show video preview when file is selected
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-foreground">Video Preview:</h3>
                <div className="flex items-center">
                  <p className="text-xs text-muted-foreground mr-2">{file.name}</p>
                  <p className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-2 h-7 text-xs text-muted-foreground hover:text-foreground hover:bg-muted"
                    onClick={() => onFileChange(null)}
                  >
                    Change
                  </Button>
                </div>
              </div>

              <div className="flex-1 aspect-video bg-black rounded-lg overflow-hidden border border-border">
                {videoPreviewUrl && (
                  <video
                    key={videoPreviewUrl}
                    src={videoPreviewUrl}
                    className="w-full h-full object-contain"
                    controls
                    muted
                    playsInline
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default VideoSelectionStep
