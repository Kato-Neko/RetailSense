"use client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ChevronUp, ChevronDown, Clock, Calendar } from "lucide-react"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

const DateTimeSelectionStep = ({
  startDate,
  endDate,
  startTime,
  endTime,
  duration,
  roundedDuration,
  setStartDate,
  setEndDate,
  setStartTime,
  setEndTime,
  isValid,
  onPrevious,
  onNext,
}) => {
  // Format duration for display
  const formatDuration = (durationInSeconds) => {
    if (!durationInSeconds) return "0 seconds"

    const minutes = Math.floor(durationInSeconds / 60)
    const seconds = Math.floor(durationInSeconds % 60)
    const milliseconds = Math.floor((durationInSeconds % 1) * 1000)

    let result = ""
    if (minutes > 0) {
      result += `${minutes} minute${minutes !== 1 ? "s" : ""} `
    }
    if (seconds > 0 || minutes === 0) {
      result += `${seconds} second${seconds !== 1 ? "s" : ""} `
    }
    if (milliseconds > 0) {
      result += `${milliseconds} ms`
    }

    return result.trim()
  }

  // Helper function to format time with seconds
  const formatTimeWithSeconds = (hours, minutes, seconds) => {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
  }

  // Helper function to parse time with seconds
  const parseTimeWithSeconds = (timeString) => {
    const parts = timeString.split(":")
    const hours = Number.parseInt(parts[0] || "0", 10)
    const minutes = Number.parseInt(parts[1] || "0", 10)
    const seconds = Number.parseInt(parts[2] || "0", 10)
    return { hours, minutes, seconds }
  }

  // Function to update end time and end date based on start date, start time, and video duration
  const updateEndDateTime = (newStartDate, newStartTime) => {
    if (!roundedDuration || roundedDuration <= 0 || !newStartDate || !newStartTime) {
      return
    }
    // Parse start date and time
    const [startYear, startMonth, startDay] = newStartDate.split('-').map(Number)
    const { hours: startHours, minutes: startMinutes, seconds: startSeconds } = parseTimeWithSeconds(newStartTime)
    const startDateObj = new Date(startYear, startMonth - 1, startDay, startHours, startMinutes, startSeconds)
    // Add duration (in seconds)
    const endDateObj = new Date(startDateObj.getTime() + (roundedDuration - 1) * 1000)
    // Set end date and end time
    setEndDate(format(endDateObj, 'yyyy-MM-dd'))
    setEndTime(formatTimeWithSeconds(endDateObj.getHours(), endDateObj.getMinutes(), endDateObj.getSeconds()))
  }

  // Update end date/time when start date or start time changes
  const handleStartDateChange = (date) => {
    setStartDate(date)
    updateEndDateTime(date, startTime)
  }
  const handleStartTimeChange = (e) => {
    const newStartTime = e.target.value
    setStartTime(newStartTime)
    if (/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/.test(newStartTime)) {
      updateEndDateTime(startDate, newStartTime)
    }
  }

  // Also update end date/time when clicking Now
  const setToCurrentTime = () => {
    const now = new Date()
    const currentTime = formatTimeWithSeconds(now.getHours(), now.getMinutes(), now.getSeconds())
    const currentDate = format(now, 'yyyy-MM-dd')
    setStartDate(currentDate)
    setStartTime(currentTime)
    updateEndDateTime(currentDate, currentTime)
  }

  // Time input helpers
  const adjustTime = (timeString, field, amount) => {
    const { hours, minutes, seconds } = parseTimeWithSeconds(timeString)

    let newHours = hours
    let newMinutes = minutes
    let newSeconds = seconds

    if (field === "hours") {
      newHours = (hours + amount + 24) % 24
    } else if (field === "minutes") {
      newMinutes = minutes + amount
      if (newMinutes >= 60) {
        newHours = (hours + Math.floor(newMinutes / 60)) % 24
        newMinutes = newMinutes % 60
      } else if (newMinutes < 0) {
        newHours = (hours + Math.floor(newMinutes / 60) + 24) % 24
        newMinutes = ((newMinutes % 60) + 60) % 60
      }
    } else if (field === "seconds") {
      newSeconds = seconds + amount
      if (newSeconds >= 60) {
        newMinutes = minutes + Math.floor(newSeconds / 60)
        newSeconds = newSeconds % 60
        if (newMinutes >= 60) {
          newHours = (hours + Math.floor(newMinutes / 60)) % 24
          newMinutes = newMinutes % 60
        }
      } else if (newSeconds < 0) {
        newMinutes = minutes + Math.floor(newSeconds / 60)
        newSeconds = ((newSeconds % 60) + 60) % 60
        if (newMinutes < 0) {
          newHours = (hours + Math.floor(newMinutes / 60) + 24) % 24
          newMinutes = ((newMinutes % 60) + 60) % 60
        }
      }
    }

    return formatTimeWithSeconds(newHours, newMinutes, newSeconds)
  }

  // Adjust start time
  const adjustStartTime = (field, amount) => {
    const newTime = adjustTime(startTime, field, amount)
    setStartTime(newTime)
    updateEndDateTime(startDate, newTime)
  }

  // Adjust end time
  const adjustEndTime = (field, amount) => {
    const newTime = adjustTime(endTime, field, amount)
    setEndTime(newTime)
  }

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return ""
    const date = new Date(dateString)
    return format(date, "PPP")
  }

  // Time input component with helpers
  const TimeInput = ({ label, value, onChange, onAdjust }) => (
    <div className="mb-3">
      <div className="flex items-center mb-1">
        <Input
          type="text"
          value={value}
          onChange={onChange}
          placeholder="HH:MM:SS"
          pattern="[0-9]{2}:[0-9]{2}:[0-9]{2}"
          className={`w-full h-9 py-1 bg-muted/60 border-border text-center text-foreground focus-visible:ring-blue-500 dark:bg-slate-800 dark:text-slate-200 ${
            !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/.test(value) ? "border-red-500" : ""
          }`}
        />
      </div>
      <div className="flex justify-center ml-5 space-x-10">
        <div className="flex items-center gap-1 w-1/3">
          <Button
            type="button"
            onClick={() => onAdjust("hours", 1)}
            variant="outline"
            size="sm"
            className="h-6 w-6 p-0 border-border bg-muted/60 text-foreground hover:bg-muted/80 dark:bg-slate-800 dark:text-slate-200"
          >
            <ChevronUp className="h-3 w-3" />
          </Button>
          <span className="text-xs text-muted-foreground">H</span>
          <Button
            type="button"
            onClick={() => onAdjust("hours", -1)}
            variant="outline"
            size="sm"
            className="h-6 w-6 p-0 border-border bg-muted/60 text-foreground hover:bg-muted/80 dark:bg-slate-800 dark:text-slate-200"
          >
            <ChevronDown className="h-3 w-3" />
          </Button>
        </div>
        <div className="flex items-center gap-1 w-1/3">
          <Button
            type="button"
            onClick={() => onAdjust("minutes", 1)}
            variant="outline"
            size="sm"
            className="h-6 w-6 p-0 border-border bg-muted/60 text-foreground hover:bg-muted/80 dark:bg-slate-800 dark:text-slate-200"
          >
            <ChevronUp className="h-3 w-3" />
          </Button>
          <span className="text-xs text-muted-foreground">M</span>
          <Button
            type="button"
            onClick={() => onAdjust("minutes", -1)}
            variant="outline"
            size="sm"
            className="h-6 w-6 p-0 border-border bg-muted/60 text-foreground hover:bg-muted/80 dark:bg-slate-800 dark:text-slate-200"
          >
            <ChevronDown className="h-3 w-3" />
          </Button>
        </div>
        <div className="flex items-center gap-1 w-1/3">
          <Button
            type="button"
            onClick={() => onAdjust("seconds", 1)}
            variant="outline"
            size="sm"
            className="h-6 w-6 p-0 border-border bg-muted/60 text-foreground hover:bg-muted/80 dark:bg-slate-800 dark:text-slate-200"
          >
            <ChevronUp className="h-3 w-3" />
          </Button>
          <span className="text-xs text-muted-foreground">S</span>
          <Button
            type="button"
            onClick={() => onAdjust("seconds", -1)}
            variant="outline"
            size="sm"
            className="h-6 w-6 p-0 border-border bg-muted/60 text-foreground hover:bg-muted/80 dark:bg-slate-800 dark:text-slate-200"
          >
            <ChevronDown className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  )

  return (
    <Card className="w-full border-none bg-transparent shadow-none">
      <CardContent className="p-6">
        <h2 className="text-xl font-semibold mb-3 bg-gradient-to-r from-blue-400 to-cyan-400 text-transparent bg-clip-text">
          Step 2: Set Date and Time Range
        </h2>
        <p className="text-sm text-muted-foreground mb-1">
          Please select the appropriate date and time for this
          <span className="text-green-400 font-medium">{` ${formatDuration(duration)}`}</span> video.
        </p>
        <p className="text-xs text-muted-foreground mb-4">
          <strong>Note:</strong> For validation purposes, the duration is rounded down to{" "}
          <span className="text-blue-400 font-medium">{roundedDuration} seconds</span>.
        </p>
        <div className="grid grid-cols-2 gap-6 mb-10 mt-10">
          <div className="bg-muted/40 p-4 rounded-lg border border-border backdrop-blur">
            <div className="flex items-center mb-3">
              <Calendar className="h-6 w-6 mr-3 text-blue-400" />
              <Label className="block text-foreground font-medium text-lg">Date Range:</Label>
            </div>
            <div className="space-y-3">
              <div className="mt-10 mb-10">
                <Label className="text-sm pl-3 mb-1 text-muted-foreground">Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full h-9 py-1 bg-muted/60 border-border text-foreground font-normal flex items-center justify-center text-center",
                        !startDate && "text-muted-foreground"
                      )}
                    >
                      <span className="flex-1 text-center">{startDate ? formatDate(startDate) : <span>Pick a date</span>}</span>
                      <Calendar className="ml-2 h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={startDate ? new Date(startDate) : undefined}
                      onSelect={(date) => handleStartDateChange(date ? format(date, 'yyyy-MM-dd') : '')}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="mb-10">
                <Label className="text-sm pl-3 mb-1 text-muted-foreground">End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full h-9 py-1 bg-muted/60 border-border text-foreground font-normal flex items-center justify-center text-center",
                        !endDate && "text-muted-foreground"
                      )}
                    >
                      <span className="flex-1 text-center">{endDate ? formatDate(endDate) : <span>Pick a date</span>}</span>
                      <Calendar className="ml-2 h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={endDate ? new Date(endDate) : undefined}
                      onSelect={(date) => setEndDate(date ? format(date, 'yyyy-MM-dd') : '')}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
          <div className="bg-muted/40 p-4 rounded-lg border border-border backdrop-blur">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center">
                <Clock className="h-6 w-6 mr-3 text-blue-400" />
                <Label className="text-foreground font-medium text-lg">Time Range:</Label>
              </div>
              <Button
                type="button"
                onClick={setToCurrentTime}
                variant="outline"
                size="sm"
                className="flex items-center text-xs h-7 border-border bg-muted hover:bg-muted/60 text-foreground"
              >
                <Clock className="h-3 w-3 mr-1 text-blue-400" /> Now
              </Button>
            </div>
            <Label className="text-sm pl-3 mt-10 mb-1 text-muted-foreground">Start Time</Label>
            <TimeInput className="justify-center" value={startTime} onChange={handleStartTimeChange} onAdjust={adjustStartTime} />
            <Label className="text-sm pl-3 mt-3 mb-1 text-muted-foreground">End Time</Label>
            <TimeInput
              className="justify-center"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              onAdjust={adjustEndTime}
            />
          </div>
        </div>
        <div className="p-3 bg-muted/40 rounded-lg border border-border mb-6">
          <div className={`text-sm font-medium ${isValid ? "text-green-400" : "text-red-400"} flex items-center`}>
            {isValid ? (
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
                Time range is valid
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
                Time range is invalid
              </>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            The time range must be greater than 0 and not exceed the video duration.
          </p>
        </div>
        <div className="flex justify-between">
          <Button
            onClick={onPrevious}
            variant="outline"
            className="px-6 border-border bg-muted/50 text-foreground hover:bg-muted/70 hover:text-foreground"
          >
            Previous
          </Button>
          <Button
            onClick={onNext}
            disabled={!isValid}
            className="px-6 bg-gradient-to-r from-white to-cyan-200 text-black font-semibold shadow-md border border-border py-2 text-sm hover:opacity-90 dark:from-blue-900 dark:to-cyan-800 dark:text-white"
          >
            Next
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default DateTimeSelectionStep

