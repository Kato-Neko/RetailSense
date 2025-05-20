"use client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ChevronUp, ChevronDown, Clock } from "lucide-react"

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

  // Function to update end time based on start time and video duration
  const updateEndTime = (newStartTime) => {
    if (!roundedDuration || roundedDuration <= 0) {
      return
    }

    // Parse start time with seconds
    const { hours: startHours, minutes: startMinutes, seconds: startSeconds } = parseTimeWithSeconds(newStartTime)

    // Calculate total seconds
    const startTotalSeconds = startHours * 3600 + startMinutes * 60 + startSeconds
    const videoDurationSeconds = roundedDuration // Use rounded duration

    // Add duration to start time (in seconds)
    const endTotalSeconds = startTotalSeconds + videoDurationSeconds

    // Convert back to hours, minutes, and seconds
    const endHours = Math.floor(endTotalSeconds / 3600) % 24 // Use modulo 24 to handle day wraparound
    const endMinutes = Math.floor((endTotalSeconds % 3600) / 60)
    const endSeconds = endTotalSeconds % 60

    // Format with leading zeros
    const formattedEndTime = formatTimeWithSeconds(endHours, endMinutes, endSeconds)

    setEndTime(formattedEndTime)
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

  // Handle changes to the start time input
  const handleStartTimeChange = (e) => {
    const newStartTime = e.target.value
    setStartTime(newStartTime)

    if (/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/.test(newStartTime)) {
      updateEndTime(newStartTime)
    }
  }

  // Adjust start time
  const adjustStartTime = (field, amount) => {
    const newTime = adjustTime(startTime, field, amount)
    setStartTime(newTime)
    updateEndTime(newTime)
  }

  // Adjust end time
  const adjustEndTime = (field, amount) => {
    const newTime = adjustTime(endTime, field, amount)
    setEndTime(newTime)
  }

  // Set to current time
  const setToCurrentTime = () => {
    const now = new Date()
    const currentTime = formatTimeWithSeconds(now.getHours(), now.getMinutes(), now.getSeconds())
    setStartTime(currentTime)
    updateEndTime(currentTime)
  }

  // Time input component with helpers
  const TimeInput = ({ label, value, onChange, onAdjust }) => (
    <div className="mb-4">
      <div className="flex items-center mb-2">
        <Label className="w-16">{label}:</Label>
        <Input
          type="text"
          value={value}
          onChange={onChange}
          placeholder="HH:MM:SS"
          pattern="[0-9]{2}:[0-9]{2}:[0-9]{2}"
          className={`w-full ${!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/.test(value) ? "border-red-500" : ""}`}
        />
      </div>
      <div className="flex justify-between ml-16">
        <div className="flex flex-col items-center w-1/3">
          <Button
            type="button"
            onClick={() => onAdjust("hours", 1)}
            variant="outline"
            size="sm"
            className="mb-1 h-6 w-6 p-0"
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <span className="text-xs">Hours</span>
          <Button
            type="button"
            onClick={() => onAdjust("hours", -1)}
            variant="outline"
            size="sm"
            className="mt-1 h-6 w-6 p-0"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-col items-center w-1/3">
          <Button
            type="button"
            onClick={() => onAdjust("minutes", 1)}
            variant="outline"
            size="sm"
            className="mb-1 h-6 w-6 p-0"
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <span className="text-xs">Minutes</span>
          <Button
            type="button"
            onClick={() => onAdjust("minutes", -1)}
            variant="outline"
            size="sm"
            className="mt-1 h-6 w-6 p-0"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-col items-center w-1/3">
          <Button
            type="button"
            onClick={() => onAdjust("seconds", 1)}
            variant="outline"
            size="sm"
            className="mb-1 h-6 w-6 p-0"
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <span className="text-xs">Seconds</span>
          <Button
            type="button"
            onClick={() => onAdjust("seconds", -1)}
            variant="outline"
            size="sm"
            className="mt-1 h-6 w-6 p-0"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )

  return (
    <Card className="w-full h-full">
      <CardContent className="p-5 h-full flex flex-col">
        <h2 className="text-xl font-semibold mb-3">Step 2: Set Date and Time Range</h2>

        <div className="flex-1 overflow-y-auto mb-3">
          <p className="text-sm text-muted-foreground mb-2">
            Please select the appropriate date and time for this
            <span className="text-green-600 font-medium">{` ${formatDuration(duration)}`}</span> video.
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            <strong>Note:</strong> For validation purposes, the duration is rounded down to{" "}
            <span className="text-blue-600 font-medium">{roundedDuration} seconds</span>.
          </p>

          <div className="mb-4">
            <Label className="block mb-2">Date Range:</Label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full"
                />
              </div>
              <div>
                <Label className="text-xs">End Date</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full" />
              </div>
            </div>
          </div>

          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <Label>Time Range (HH:MM:SS):</Label>
              <Button
                type="button"
                onClick={setToCurrentTime}
                variant="outline"
                size="sm"
                className="flex items-center text-xs"
              >
                <Clock className="h-3 w-3 mr-1" /> Now
              </Button>
            </div>

            <TimeInput label="Start" value={startTime} onChange={handleStartTimeChange} onAdjust={adjustStartTime} />

            <TimeInput
              label="End"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              onAdjust={adjustEndTime}
            />
          </div>

          {/* Validation status */}
          <div className="p-3 bg-gray-100 rounded-lg border border-gray-300">
            <h3 className="text-sm font-semibold text-gray-800 mb-1">Validation Status:</h3>
            <div className={`text-sm font-medium ${isValid ? "text-green-600" : "text-red-600"} flex items-center`}>
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
            <p className="text-xs text-gray-700 mt-1">
              The time range must be greater than 0 and not exceed the video duration.
            </p>
          </div>
        </div>

        <div className="flex justify-between">
          <Button onClick={onPrevious} variant="outline" className="px-6">
            Previous
          </Button>
          <Button onClick={onNext} disabled={!isValid} className="px-6">
            Next
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default DateTimeSelectionStep
