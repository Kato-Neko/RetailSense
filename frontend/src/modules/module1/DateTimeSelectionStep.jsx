"use client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ChevronUp, ChevronDown, Clock, Calendar } from "lucide-react"

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
    <div className="mb-3">
      <div className="flex items-center mb-1">
        <Input
          type="text"
          value={value}
          onChange={onChange}
          placeholder="HH:MM:SS"
          pattern="[0-9]{2}:[0-9]{2}:[0-9]{2}"
          className={`w-full h-9 py-1 bg-slate-800/50 border-slate-700 text-center text-slate-200 focus-visible:ring-blue-500 ${
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
            className="h-6 w-6 p-0 border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300"
          >
            <ChevronUp className="h-3 w-3" />
          </Button>
          <span className="text-xs text-slate-400">H</span>
          <Button
            type="button"
            onClick={() => onAdjust("hours", -1)}
            variant="outline"
            size="sm"
            className="h-6 w-6 p-0 border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300"
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
            className="h-6 w-6 p-0 border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300"
          >
            <ChevronUp className="h-3 w-3" />
          </Button>
          <span className="text-xs text-slate-400">M</span>
          <Button
            type="button"
            onClick={() => onAdjust("minutes", -1)}
            variant="outline"
            size="sm"
            className="h-6 w-6 p-0 border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300"
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
            className="h-6 w-6 p-0 border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300"
          >
            <ChevronUp className="h-3 w-3" />
          </Button>
          <span className="text-xs text-slate-400">S</span>
          <Button
            type="button"
            onClick={() => onAdjust("seconds", -1)}
            variant="outline"
            size="sm"
            className="h-6 w-6 p-0 border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300"
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

        <p className="text-sm text-slate-300 mb-1">
          Please select the appropriate date and time for this
          <span className="text-green-400 font-medium">{` ${formatDuration(duration)}`}</span> video.
        </p>
        <p className="text-xs text-slate-400 mb-4">
          <strong>Note:</strong> For validation purposes, the duration is rounded down to{" "}
          <span className="text-blue-400 font-medium">{roundedDuration} seconds</span>.
        </p>

        <div className="grid grid-cols-2 gap-6 mb-10 mt-10">
          <div className="bg-slate-800/30 p-4 rounded-lg border border-slate-800">
            <div className="flex items-center mb-3">
              <Calendar className="h-6 w-6 mr-3 text-blue-400" />
              <Label className="block text-slate-300 font-medium text-lg">Date Range:</Label>
            </div>
            <div className="space-y-3">
              <div className="mt-10 mb-10"> 
                <Label className="text-sm pl-3 mb-1 text-slate-400">Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full h-9 py-1 bg-slate-800/50 border-slate-700 text-slate-200 justify-center focus-visible:ring-blue-500"
                />
              </div>
              <div className="mb-10">
                <Label className="text-sm pl-3 mb-1 text-slate-400">End Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full h-9 py-1 bg-slate-800/50 border-slate-700 text-slate-200 justify-center focus-visible:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="bg-slate-800/30 p-4 rounded-lg border border-slate-800">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center">
                <Clock className="h-6 w-6 mr-3 text-blue-400" />
                <Label className="text-slate-300 font-medium text-lg">Time Range:</Label>
              </div>
              <Button
                type="button"
                onClick={setToCurrentTime}
                variant="outline"
                size="sm"
                className="flex items-center text-xs h-7 border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                <Clock className="h-3 w-3 mr-1 text-blue-400" /> Now
              </Button>
            </div>

            <Label className="text-sm pl-3 mt-10 mb-1 text-slate-400">Start Time</Label>
            <TimeInput className="justify-center" value={startTime} onChange={handleStartTimeChange} onAdjust={adjustStartTime} />
            <Label className="text-sm pl-3 mt-3 mb-1 text-slate-400">End Time</Label>
            <TimeInput
              className="justify-center"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              onAdjust={adjustEndTime}
            />
          </div>
        </div>

        {/* Validation status */}
        <div className="p-3 bg-slate-800/30 rounded-lg border border-slate-800 mb-6">
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
          <p className="text-xs text-slate-400">
            The time range must be greater than 0 and not exceed the video duration.
          </p>
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

export default DateTimeSelectionStep

