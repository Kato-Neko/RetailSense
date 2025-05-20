"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react"

const ConfirmationStep = ({
  file,
  startDate,
  endDate,
  startTime,
  endTime,
  pointsData,
  isProcessing,
  statusMessage,
  progressPercent,
  backendError,
  onPrevious,
  onProcess,
  onCancel,
}) => {
  return (
    <Card className="w-full h-full">
      <CardContent className="p-6 h-full flex flex-col">
        <h2 className="text-xl font-semibold mb-4">Step 4: Confirm and Process</h2>

        <div className="flex-1 overflow-y-auto mb-3">
          <h3 className="text-lg font-medium mb-2">Summary</h3>

          <div className="mb-4">
            <div className="grid grid-cols-2 gap-2 p-3 bg-gray-100 rounded-lg border border-gray-300">
              <div className="text-sm font-semibold text-gray-800">Video File:</div>
              <div className="text-sm text-gray-800">{file?.name || "No file selected"}</div>

              <div className="text-sm font-semibold text-gray-800">Date Range:</div>
              <div className="text-sm text-gray-800">
                {startDate} to {endDate}
              </div>

              <div className="text-sm font-semibold text-gray-800">Time Range:</div>
              <div className="text-sm text-gray-800">
                {startTime} to {endTime}
              </div>

              <div className="text-sm font-semibold text-gray-800">Coordinate Points:</div>
              <div className="text-sm text-gray-800">{pointsData.length} points selected</div>
            </div>
          </div>

          {backendError && (
            <Alert variant="destructive" className="mb-3 py-2">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="text-sm">Error</AlertTitle>
              <AlertDescription className="text-xs">{backendError}</AlertDescription>
            </Alert>
          )}

          {isProcessing && (
            <div className="space-y-1 mb-3">
              <div className="flex items-center">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                <p className="text-sm font-medium">Processing: {statusMessage}</p>
              </div>
              <Progress value={progressPercent || 0} className="h-2" />
            </div>
          )}

          {!isProcessing && !backendError && (
            <Alert className="mb-3 py-2">
              <CheckCircle className="h-4 w-4" />
              <AlertTitle className="text-sm">Ready to Process</AlertTitle>
              <AlertDescription className="text-xs">
                All steps have been completed. Click "Process Video" to start generating the heatmap.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <div className="flex justify-between">
          <Button onClick={onPrevious} variant="outline" className="px-6" disabled={isProcessing}>
            Previous
          </Button>

          {isProcessing ? (
            <Button onClick={onCancel} variant="destructive" className="px-6">
              Cancel Processing
            </Button>
          ) : (
            <Button onClick={onProcess} className="px-6" disabled={backendError}>
              Process Video
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default ConfirmationStep
