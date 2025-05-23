import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CheckCircle, Calendar, Clock, Filter, Lightbulb } from "lucide-react"
import { Progress } from "@/components/ui/progress"

export default function CustomConfirmationStep({ dateRange, timeRange, onNext, progress = 0, isGenerating = false, recommendations = [], progressPercent }) {
  // Use props or fallback to placeholder values
  const dr = dateRange || { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' };
  const tr = timeRange || { start: 'HH:MM:SS', end: 'HH:MM:SS' };
  const startDateStr = dr.start instanceof Date ? dr.start.toLocaleDateString() : dr.start;
  const endDateStr = dr.end instanceof Date ? dr.end.toLocaleDateString() : dr.end;
  const startTimeStr = tr.start;
  const endTimeStr = tr.end;

  return (
    <Card className="w-full border-none bg-transparent shadow-none">
      <CardContent className="p-6">
        <div className="mb-6">
          <div className="grid grid-cols-2 gap-2 p-10 bg-muted/40 rounded-lg border border-border mb-10 ">
            <div className="text-sm font-semibold text-muted-foreground flex items-center mt-2 mb-2 ml-4">
              <Calendar className="h-4 w-4 mr-2 text-blue-400" />
              Date Range:
            </div>
            <div className="text-sm text-muted-foreground text-right">
              {startDateStr} to {endDateStr}
            </div>
            <div className="text-sm font-semibold text-muted-foreground flex items-center mt-2 mb-2 ml-4">
              <Clock className="h-4 w-4 mr-2 text-blue-400" />
              Time Range:
            </div>
            <div className="text-sm text-muted-foreground text-right">
              {startTimeStr} to {endTimeStr}
            </div>
          </div>
          <Alert className="p-10 mt-10 mb-10 py-3 border-green-300 bg-green-100/80 text-green-900 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300">
            <CheckCircle className="h-4 w-4 text-green-400" />
            <AlertTitle className="text-sm">Ready to Generate</AlertTitle>
            <AlertDescription className="text-xs">
              All steps have been completed. Click "Generate Custom Heatmap" to start.
            </AlertDescription>
          </Alert>
          <div className="flex justify-end mt-4 w-full">
            <button
              className="bg-gradient-to-r from-white to-cyan-200 text-black font-semibold shadow-md border border-border py-2 px-6 text-base rounded-md hover:opacity-90 dark:from-blue-900 dark:to-cyan-800 dark:text-white disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={onNext}
              disabled={isGenerating}
            >
              {isGenerating ? 'Generating...' : 'Generate Custom Heatmap'}
            </button>
          </div>
          {isGenerating && (
            <div className="w-full mt-2">
              <Progress value={progress} turbo />
              <div className="text-center text-sm text-muted-foreground mt-2">
                Generating... {typeof progressPercent === 'number' ? Math.round(progressPercent) : Math.round(progress)}%
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
} 