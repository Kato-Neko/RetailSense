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
          <h3 className="text-lg font-medium mb-4 mt-4 text-white">Summary</h3>

          <div className="grid grid-cols-2 gap-2 p-10 bg-slate-800/30 rounded-lg border border-slate-800 mt-10 mb-10 ">
            <div className="text-sm font-semibold text-slate-300 flex items-center mt-2 mb-2 ml-4">
              <FileVideo className="h-4 w-4 mr-2 text-blue-400" />
              Video File:
            </div>
            <div className="text-sm text-slate-300">{file?.name || "No file selected"}</div>

            <div className="text-sm font-semibold text-slate-300 flex items-center mt-2 mb-2 ml-4">
              <Calendar className="h-4 w-4 mr-2 text-blue-400" />
              Date Range:
            </div>
            <div className="text-sm text-slate-300">
              {startDate} to {endDate}
            </div>

            <div className="text-sm font-semibold text-slate-300 flex items-center mt-2 mb-2 ml-4">
              <Clock className="h-4 w-4 mr-2 text-blue-400" />
              Time Range:
            </div>
            <div className="text-sm text-slate-300">
              {startTime} to {endTime}
            </div>

            <div className="text-sm font-semibold text-slate-300 flex items-center mt-2 mb-2 ml-4">
              <Target className="h-4 w-4 mr-2 text-blue-400" />
              Coordinate Points:
            </div>
            <div className="text-sm text-slate-300">{pointsData.length} points selected</div>
          </div>

          {backendError && (
            <Alert variant="destructive" className="mb-4 py-3 border-red-800 bg-red-900/30">
              <AlertCircle className="h-4 w-4 text-red-400" />
              <AlertTitle className="text-sm text-red-300">Error</AlertTitle>
              <AlertDescription className="text-xs text-red-300">{backendError}</AlertDescription>
            </Alert>
          )}

          {isProcessing && (
            <div className="space-y-2 mb-4 bg-slate-800/30 p-4 rounded-lg border border-slate-800">
              <div className="flex items-center">
                <Loader2 className="h-4 w-4 mr-2 animate-spin text-blue-400" />
                <p className="text-sm font-medium text-slate-300">Processing: {statusMessage}</p>
              </div>
              <Progress
                value={progressPercent || 0}
                className="h-2"
                indicatorClassName="bg-gradient-to-r from-blue-600 to-cyan-600"
              />
            </div>
          )}

          {!isProcessing && !backendError && (
            <Alert className="p-10 mt-10 mb-10 py-3 border-green-800 bg-green-900/20">
              <CheckCircle className="h-4 w-4 text-green-400" />
              <AlertTitle className="text-sm text-green-300">Ready to Process</AlertTitle>
              <AlertDescription className="text-xs text-green-300">
                All steps have been completed. Click "Process Video" to start generating the heatmap.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <div className="flex justify-between">
          <Button
            onClick={onPrevious}
            variant="outline"
            className="px-6 border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-700 hover:text-white"
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
              className="px-6 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white"
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
