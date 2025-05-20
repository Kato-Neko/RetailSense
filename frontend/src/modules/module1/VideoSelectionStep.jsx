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
    <Card className="w-full h-full">
      <CardContent className="p-6 h-full flex flex-col">
        <h2 className="text-xl font-semibold mb-4">Step 1: Select Video File</h2>

        <div className="flex-1 mb-4">
          {!file ? (
            // Show upload area when no file is selected
            <div className="h-full">
              <p className="text-muted-foreground mb-6">
                Please upload a valid video file to begin the heatmap creation process.
              </p>

              <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:hover:bg-bray-800 dark:bg-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:hover:border-gray-500 dark:hover:bg-gray-600">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-8 h-8 mb-4 text-gray-500 dark:text-gray-400" />
                  <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                    <span className="font-semibold">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">MP4, AVI, MOV (MAX. 100MB)</p>
                </div>
                <input type="file" className="hidden" accept="video/*" onChange={handleFileInputChange} />
              </label>
            </div>
          ) : (
            // Show video preview when file is selected
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium">Video Preview:</h3>
                <div className="flex items-center">
                  <p className="text-xs text-gray-500 mr-2">{file.name}</p>
                  <p className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                  <Button variant="ghost" size="sm" className="ml-2 h-7 text-xs" onClick={() => onFileChange(null)}>
                    Change
                  </Button>
                </div>
              </div>

              <div className="flex-1 aspect-video bg-black rounded-lg overflow-hidden">
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

        <div className="flex justify-end">
          <Button onClick={onNext} disabled={!isValid} className="px-6">
            Next
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default VideoSelectionStep
