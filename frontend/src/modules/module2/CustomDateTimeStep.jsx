import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Calendar as CalendarIcon, Clock, CheckCircle, AlertTriangle, ChevronUp, ChevronDown } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { format } from "date-fns"

function getDefaultDateTime() {
  const now = new Date();
  const startDate = now;
  const startTime = now.toTimeString().slice(0, 8);
  const end = new Date(now.getTime() + 60 * 60 * 1000); // +1 hour
  const endDate = end;
  const endTime = end.toTimeString().slice(0, 8);
  return { startDate, endDate, startTime, endTime };
}

function pad(n) { return n.toString().padStart(2, "0"); }

function parseTimeWithSeconds(timeString) {
  const parts = timeString.split(":");
  const hours = Number.parseInt(parts[0] || "0", 10);
  const minutes = Number.parseInt(parts[1] || "0", 10);
  const seconds = Number.parseInt(parts[2] || "0", 10);
  return { hours, minutes, seconds };
}

function formatTimeWithSeconds(hours, minutes, seconds) {
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function TimeInputHelper({ value, onChange }) {
  const { hours, minutes, seconds } = parseTimeWithSeconds(value);

  const adjust = (field, amount) => {
    let newHours = hours;
    let newMinutes = minutes;
    let newSeconds = seconds;
    if (field === "hours") {
      newHours = (hours + amount + 24) % 24;
    } else if (field === "minutes") {
      newMinutes = minutes + amount;
      if (newMinutes >= 60) {
        newHours = (hours + Math.floor(newMinutes / 60)) % 24;
        newMinutes = newMinutes % 60;
      } else if (newMinutes < 0) {
        newHours = (hours + Math.floor(newMinutes / 60) + 24) % 24;
        newMinutes = ((newMinutes % 60) + 60) % 60;
      }
    } else if (field === "seconds") {
      newSeconds = seconds + amount;
      if (newSeconds >= 60) {
        newMinutes = minutes + Math.floor(newSeconds / 60);
        newSeconds = newSeconds % 60;
        if (newMinutes >= 60) {
          newHours = (hours + Math.floor(newMinutes / 60)) % 24;
          newMinutes = newMinutes % 60;
        }
      } else if (newSeconds < 0) {
        newMinutes = minutes + Math.floor(newSeconds / 60);
        newSeconds = ((newSeconds % 60) + 60) % 60;
        if (newMinutes < 0) {
          newHours = (hours + Math.floor(newMinutes / 60) + 24) % 24;
          newMinutes = ((newMinutes % 60) + 60) % 60;
        }
      }
    }
    onChange(formatTimeWithSeconds(newHours, newMinutes, newSeconds));
  };

  return (
    <div className="flex flex-col items-center w-full">
      <Input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="HH:MM:SS"
        pattern="[0-9]{2}:[0-9]{2}:[0-9]{2}"
        className="w-full h-10 text-center font-mono bg-muted/60 border border-border rounded-md mb-2 text-lg"
      />
      <div className="flex justify-center space-x-8 w-full">
        {/* Hours */}
        <div className="flex flex-col items-center">
          <button type="button" onClick={() => adjust("hours", 1)} className="rounded-full p-1 bg-muted hover:bg-muted/70 border border-border mb-1"><ChevronUp className="h-4 w-4" /></button>
          <span className="text-xs text-muted-foreground">H</span>
          <button type="button" onClick={() => adjust("hours", -1)} className="rounded-full p-1 bg-muted hover:bg-muted/70 border border-border mt-1"><ChevronDown className="h-4 w-4" /></button>
        </div>
        {/* Minutes */}
        <div className="flex flex-col items-center">
          <button type="button" onClick={() => adjust("minutes", 1)} className="rounded-full p-1 bg-muted hover:bg-muted/70 border border-border mb-1"><ChevronUp className="h-4 w-4" /></button>
          <span className="text-xs text-muted-foreground">M</span>
          <button type="button" onClick={() => adjust("minutes", -1)} className="rounded-full p-1 bg-muted hover:bg-muted/70 border border-border mt-1"><ChevronDown className="h-4 w-4" /></button>
        </div>
        {/* Seconds */}
        <div className="flex flex-col items-center">
          <button type="button" onClick={() => adjust("seconds", 1)} className="rounded-full p-1 bg-muted hover:bg-muted/70 border border-border mb-1"><ChevronUp className="h-4 w-4" /></button>
          <span className="text-xs text-muted-foreground">S</span>
          <button type="button" onClick={() => adjust("seconds", -1)} className="rounded-full p-1 bg-muted hover:bg-muted/70 border border-border mt-1"><ChevronDown className="h-4 w-4" /></button>
        </div>
      </div>
    </div>
  );
}

export default function CustomDateTimeStep({ selectedJob, dateRange, setDateRange, timeRange, setTimeRange, setIsValidDateTime }) {
  // Use safe defaults if dateRange/timeRange are null
  const safeDateRange = dateRange || { start: '', end: '' };
  const safeTimeRange = timeRange || { start: '', end: '' };
  const defaults = getDefaultDateTime();
  // Defensive: fallback to empty object if setter is not provided
  const safeSetDateRange = setDateRange || (() => {});
  const safeSetTimeRange = setTimeRange || (() => {});
  const [isValid, setIsValid] = useState(true);
  const [validationError, setValidationError] = useState("");

  // Set date/time from selectedJob if present and not already set
  useEffect(() => {
    if (
      selectedJob && selectedJob.start_datetime && selectedJob.end_datetime &&
      (!safeDateRange.start || !safeDateRange.end || !safeTimeRange.start || !safeTimeRange.end)
    ) {
      const startDateObj = new Date(selectedJob.start_datetime);
      const endDateObj = new Date(selectedJob.end_datetime);
      safeSetDateRange({
        start: startDateObj,
        end: endDateObj
      });
      safeSetTimeRange({
        start: startDateObj.toTimeString().slice(0, 8),
        end: endDateObj.toTimeString().slice(0, 8)
      });
    }
  }, [selectedJob, safeDateRange.start, safeDateRange.end, safeTimeRange.start, safeTimeRange.end, safeSetDateRange, safeSetTimeRange]);

  // Compute min/max for date and time pickers
  const minDate = selectedJob && selectedJob.start_datetime ? new Date(selectedJob.start_datetime) : null;
  const maxDate = selectedJob && selectedJob.end_datetime ? new Date(selectedJob.end_datetime) : null;
  const minDateStr = minDate ? minDate.toISOString().split('T')[0] : undefined;
  const maxDateStr = maxDate ? maxDate.toISOString().split('T')[0] : undefined;
  const minTimeStr = minDate ? minDate.toTimeString().slice(0, 8) : undefined;
  const maxTimeStr = maxDate ? maxDate.toTimeString().slice(0, 8) : undefined;

  useEffect(() => {
    // Improved validation logic
    if (!safeDateRange.start || !safeDateRange.end || !safeTimeRange.start || !safeTimeRange.end) {
      setIsValid(false);
      setValidationError("All fields must be filled");
      if (setIsValidDateTime) setIsValidDateTime(false);
      return;
    }
    try {
      const start = new Date(safeDateRange.start);
      start.setHours(...safeTimeRange.start.split(":").map(Number));
      const end = new Date(safeDateRange.end);
      end.setHours(...safeTimeRange.end.split(":").map(Number));
      if (end <= start) {
        setIsValid(false);
        setValidationError("End date/time must be after start date/time");
        if (setIsValidDateTime) setIsValidDateTime(false);
        return;
      }
      if (minDate && start < minDate) {
        setIsValid(false);
        setValidationError("Start date/time cannot be before job start");
        if (setIsValidDateTime) setIsValidDateTime(false);
        return;
      }
      if (maxDate && end > maxDate) {
        setIsValid(false);
        setValidationError("End date/time cannot be after job end");
        if (setIsValidDateTime) setIsValidDateTime(false);
        return;
      }
      setIsValid(true);
      setValidationError("");
      if (setIsValidDateTime) setIsValidDateTime(true);
    } catch {
      setIsValid(false);
      setValidationError("Invalid date/time format");
      if (setIsValidDateTime) setIsValidDateTime(false);
    }
  }, [safeDateRange, safeTimeRange, minDate, maxDate, setIsValidDateTime]);

  return (
    <div className="flex items-center justify-center h-full w-full">
      <Card className="w-full max-w-2xl border-none bg-transparent shadow-none">
        <CardContent className="p-8 flex flex-col items-center justify-center">
          <div className="grid grid-cols-2 gap-8 mb-6 mt-2 w-full">
            {/* Date Range */}
            <div className="bg-muted/40 p-6 rounded-lg border border-border backdrop-blur flex flex-col items-center justify-center">
              <div className="flex items-center mb-4">
                <CalendarIcon className="h-6 w-6 mr-3 text-blue-400" />
                <Label className="block text-foreground font-medium text-lg">Date Range</Label>
              </div>
              <div className="space-y-4 w-full flex flex-col items-center justify-center flex-grow">
                {/* Start Date Picker */}
                <div className="w-full max-w-xs flex flex-col items-center">
                  <Label className="text-xs pl-2 mb-1 text-muted-foreground">Start Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        className="w-full h-10 flex items-center justify-between bg-muted/60 border border-border rounded-md px-3 text-foreground text-center focus:outline-none"
                        type="button"
                        disabled={!selectedJob}
                      >
                        <span className="flex-1 text-center">
                          {safeDateRange.start ? format(safeDateRange.start, "yyyy-MM-dd") : <span className="text-muted-foreground">Pick a date</span>}
                        </span>
                        <CalendarIcon className="ml-2 h-5 w-5 text-blue-400" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="center" className="p-0 w-auto">
                      <Calendar
                        mode="single"
                        selected={safeDateRange.start}
                        onSelect={date => {
                          if (minDate && date < minDate) return;
                          if (maxDate && date > maxDate) return;
                          safeSetDateRange(r => ({ ...r, start: date }))
                        }}
                        initialFocus
                        disabled={date => (minDate && date < minDate) || (maxDate && date > maxDate)}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                {/* End Date Picker */}
                <div className="w-full max-w-xs flex flex-col items-center">
                  <Label className="text-xs pl-2 mb-1 text-muted-foreground">End Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        className="w-full h-10 flex items-center justify-between bg-muted/60 border border-border rounded-md px-3 text-foreground text-center focus:outline-none"
                        type="button"
                        disabled={!selectedJob}
                      >
                        <span className="flex-1 text-center">
                          {safeDateRange.end ? format(safeDateRange.end, "yyyy-MM-dd") : <span className="text-muted-foreground">Pick a date</span>}
                        </span>
                        <CalendarIcon className="ml-2 h-5 w-5 text-blue-400" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="center" className="p-0 w-auto">
                      <Calendar
                        mode="single"
                        selected={safeDateRange.end}
                        onSelect={date => {
                          if (minDate && date < minDate) return;
                          if (maxDate && date > maxDate) return;
                          safeSetDateRange(r => ({ ...r, end: date }))
                        }}
                        initialFocus
                        disabled={date => (minDate && date < minDate) || (maxDate && date > maxDate)}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>
            {/* Time Range */}
            <div className="bg-muted/40 p-6 rounded-lg border border-border backdrop-blur flex flex-col items-center justify-center">
              <div className="flex items-center mb-4">
                <Clock className="h-6 w-6 mr-3 text-blue-400" />
                <Label className="text-foreground font-medium text-lg">Time Range</Label>
              </div>
              <div className="space-y-4 w-full">
                {/* Start Time */}
                <div className="w-full">
                  <Label className="text-xs pl-2 mb-1 text-muted-foreground">Start Time</Label>
                  <TimeInputHelper
                    value={safeTimeRange.start}
                    onChange={val => {
                      if (safeDateRange.start && minDateStr && format(safeDateRange.start, 'yyyy-MM-dd') === minDateStr && minTimeStr && val < minTimeStr) return;
                      safeSetTimeRange(r => ({ ...r, start: val }))
                    }}
                  />
                </div>
                {/* End Time */}
                <div className="w-full">
                  <Label className="text-xs pl-2 mb-1 text-muted-foreground">End Time</Label>
                  <TimeInputHelper
                    value={safeTimeRange.end}
                    onChange={val => {
                      if (safeDateRange.end && maxDateStr && format(safeDateRange.end, 'yyyy-MM-dd') === maxDateStr && maxTimeStr && val > maxTimeStr) return;
                      safeSetTimeRange(r => ({ ...r, end: val }))
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-center mt-2">
            {isValid ? (
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-100/80 border border-green-300 text-green-900 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300">
                <CheckCircle className="h-4 w-4 mr-1 text-green-400" />
                <span className="text-sm font-semibold">Valid time range</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-100/80 border border-red-300 text-red-900 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
                <AlertTriangle className="h-4 w-4 mr-1 text-red-400" />
                <span className="text-sm font-semibold">{validationError}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 