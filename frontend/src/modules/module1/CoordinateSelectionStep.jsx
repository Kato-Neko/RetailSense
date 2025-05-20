"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Info, Target } from "lucide-react"
import { useEffect } from "react"
import { toast } from "sonner"

const CoordinateSelectionStep = ({
  firstFrame,
  pointsData,
  onFrameClick,
  onRemovePoint,
  isValid,
  onPrevious,
  onNext,
}) => {
  // Define the expected order of points
  const pointLabels = ["Bottom Left", "Bottom Right", "Top Right", "Top Left"]

  // Get the current point label based on how many points are already selected
  const currentPointLabel = pointsData.length < 4 ? pointLabels[pointsData.length] : null

  // Fix the issue with the first frame not showing properly
  useEffect(() => {
    // If we're on this step but don't have the first frame, show an error
    if (!firstFrame) {
      toast.error("First frame not available. Please go back to Step 1 and reupload the video.")
    }
  }, [firstFrame])

  return (
    <Card className="w-full border-none bg-transparent shadow-none">
      <CardContent className="p-6">
        <h2 className="text-xl font-semibold mb-3 bg-gradient-to-r from-blue-400 to-cyan-400 text-transparent bg-clip-text">
          Step 3: Select Coordinate Points
        </h2>

        <Alert className="mb-3 py-2 border-slate-700 bg-slate-800/50">
          <Info className="h-4 w-4 text-blue-400" />
          <AlertTitle className="text-slate-200 text-sm">Instructions</AlertTitle>
          <AlertDescription className="text-slate-300 text-xs">
            Click on the image to select 4 coordinate points. These points will be used to define the area for heatmap
            generation. Click on a point to remove it if you need to adjust.
          </AlertDescription>
        </Alert>

        {currentPointLabel && (
          <div className="mb-2 text-sm font-medium text-blue-400 flex items-center">
            <Target className="h-4 w-4 mr-1" />
            Now selecting: {currentPointLabel}
          </div>
        )}

        <div className="mb-4">
          {firstFrame ? (
            <div
              className="w-full h-[350px] border border-slate-700 rounded-lg overflow-hidden cursor-crosshair relative bg-black"
              onClick={onFrameClick}
            >
              <img
                src={firstFrame || "/placeholder.svg"}
                alt="First frame"
                className="w-full h-full object-contain"
                onError={(e) => {
                  console.error("Image failed to load")
                  e.target.src = "/placeholder.svg"
                }}
              />

              {/* Plotted points */}
              {pointsData.map((pt, idx) => (
                <div
                  key={idx}
                  style={{
                    position: "absolute",
                    left: `calc(${pt.x * 100}% - 12px)`,
                    top: `calc(${pt.y * 100}% - 12px)`,
                  }}
                  className="w-6 h-6 rounded-full bg-gradient-to-r from-blue-600 to-cyan-600 flex items-center justify-center cursor-pointer z-10 shadow-lg shadow-blue-900/30"
                  title="Remove point"
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemovePoint(idx)
                  }}
                >
                  <span className="text-white font-bold text-xs">{idx + 1}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="w-full h-[350px] border border-slate-700 rounded-lg flex items-center justify-center bg-slate-800/30">
              <p className="text-slate-400">Please upload a video in Step 1 to see the first frame.</p>
            </div>
          )}
        </div>

        {/* Points status */}
        <div className="p-3 bg-slate-800/30 rounded-lg border border-slate-800 mb-6">
          <div
            className={`text-sm font-medium ${pointsData.length === 4 ? "text-green-400" : "text-amber-400"} flex items-center`}
          >
            {pointsData.length === 4 ? (
              <>
                <svg
                  className="w-4 h-4 mr-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
                All 4 points selected
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4 mr-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  ></path>
                </svg>
                {pointsData.length}/4 points selected
              </>
            )}
          </div>
          <p className="text-xs text-slate-400">You must select exactly 4 points to define the area.</p>
        </div>

        <div className="flex justify-between">
          <Button
            onClick={onPrevious}
            variant="outline"
            className="px-6 border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-700 hover:text-white"
          >
            Previous
          </Button>
          <Button
            onClick={onNext}
            disabled={!isValid}
            className="px-6 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white"
          >
            Next
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default CoordinateSelectionStep
