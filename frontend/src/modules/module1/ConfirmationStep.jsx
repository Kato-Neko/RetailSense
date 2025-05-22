"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CheckCircle, AlertCircle, Loader2, FileVideo, Calendar, Clock, Target } from "lucide-react"

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
    <Card className="w-full border-none bg-transparent shadow-none">
      <CardContent className="p-6">
        <h2 className="text-xl font-semibold mb-4 bg-gradient-to-r from-blue-400 to-cyan-400 text-transparent bg-clip-text">
          Step 4: Confirm and Process
        </h2>

        <div className="mb-6">
          <h3 className="text-lg font-medium mb-4 mt-4 text-foreground">Summary</h3>

          <div className="grid grid-cols-2 gap-2 p-10 bg-muted/40 rounded-lg border border-border mt-10 mb-10 ">
            <div className="text-sm font-semibold text-muted-foreground flex items-center mt-2 mb-2 ml-4">
              <FileVideo className="h-4 w-4 mr-2 text-blue-400" />
              Video File:
            </div>
            <div className="text-sm text-muted-foreground max-w-[220px] truncate break-all" title={file?.name || "No file selected"}>
              {file?.name || "No file selected"}
            </div>

            <div className="text-sm font-semibold text-muted-foreground flex items-center mt-2 mb-2 ml-4">
              <Calendar className="h-4 w-4 mr-2 text-blue-400" />
              Date Range:
            </div>
            <div className="text-sm text-muted-foreground">
              {startDate} to {endDate}
            </div>

            <div className="text-sm font-semibold text-muted-foreground flex items-center mt-2 mb-2 ml-4">
              <Clock className="h-4 w-4 mr-2 text-blue-400" />
              Time Range:
            </div>
            <div className="text-sm text-muted-foreground">
              {startTime} to {endTime}
            </div>

            <div className="text-sm font-semibold text-muted-foreground flex items-center mt-2 mb-2 ml-4">
              <Target className="h-4 w-4 mr-2 text-blue-400" />
              Coordinate Points:
            </div>
            <div className="text-sm text-muted-foreground">{pointsData.length} points selected</div>
          </div>

          {backendError && (
            <Alert variant="destructive" className="mb-4 py-3 border-red-800 bg-red-900/30">
              <AlertCircle className="h-4 w-4 text-red-400" />
              <AlertTitle className="text-sm text-red-300">Error</AlertTitle>
              <AlertDescription className="text-xs text-red-300">{backendError}</AlertDescription>
            </Alert>
          )}

          {isProcessing && (
            <div className="space-y-2 mb-4 bg-muted/40 p-4 rounded-lg border border-border">
              <div className="flex items-center">
                <Loader2 className="h-4 w-4 mr-2 animate-spin text-blue-400" />
                <p className="text-sm font-medium text-muted-foreground">Processing: {statusMessage}</p>
              </div>
              <Progress
                value={progressPercent || 0}
                className="h-2"
                turbo={true}
              />
            </div>
          )}

          {!isProcessing && !backendError && (
            <Alert className="p-10 mt-10 mb-10 py-3 border-green-300 bg-green-100/80 text-green-900 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300">
              <CheckCircle className="h-4 w-4 text-green-400" />
              <AlertTitle className="text-sm">Ready to Process</AlertTitle>
              <AlertDescription className="text-xs">
                All steps have been completed. Click "Process Video" to start generating the heatmap.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <div className="flex justify-between">
          <Button
            onClick={onPrevious}
            variant="outline"
            className="px-6 border-border bg-muted/50 text-foreground hover:bg-muted/70 hover:text-foreground"
            disabled={isProcessing}
          >
            Previous
          </Button>

          {isProcessing ? (
            <Button onClick={onCancel} variant="destructive" className="px-6 bg-red-600 hover:bg-red-700 text-white">
              Cancel Processing
            </Button>
          ) : (
            <Button
              onClick={onProcess}
              className="px-6 bg-gradient-to-r from-white to-cyan-200 text-black font-semibold shadow-md border border-border py-2 text-sm hover:opacity-90 dark:from-blue-900 dark:to-cyan-800 dark:text-white"
              disabled={backendError}
            >
              Process Video
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default ConfirmationStep
