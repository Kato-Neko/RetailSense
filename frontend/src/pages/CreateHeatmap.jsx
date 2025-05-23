"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { heatmapService } from "../services/api"
import { Carousel, CarouselContent, CarouselItem } from "../components/ui/carousel"
import VideoSelectionStep from "../modules/module1/VideoSelectionStep"
import DateTimeSelectionStep from "../modules/module1/DateTimeSelectionStep"
import CoordinateSelectionStep from "../modules/module1/CoordinateSelectionStep"
import ConfirmationStep from "../modules/module1/ConfirmationStep"
import { toast } from "sonner"
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"

const CreateHeatmap = () => {
  const [file, setFile] = useState(null)
  const [videoPreviewUrl, setVideoPreviewUrl] = useState(null)
  const [duration, setDuration] = useState(0)
  const [roundedDuration, setRoundedDuration] = useState(0)
  const [firstFrame, setFirstFrame] = useState(null)
  const [pointsData, setPointsData] = useState([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStep, setProcessingStep] = useState(0)
  const [processingComplete, setProcessingComplete] = useState(false)
  const [jobId, setJobId] = useState(null)
  const [statusMessage, setStatusMessage] = useState("")
  const [backendError, setBackendError] = useState(null)
  const [progressPercent, setProgressPercent] = useState(null)
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [startTime, setStartTime] = useState("00:00:00")
  const [endTime, setEndTime] = useState("00:00:00")
  const [currentStep, setCurrentStep] = useState(0)
  const [api, setApi] = useState(null)
  const navigate = useNavigate()
  const videoProcessed = useRef(false)

  // Function to check if time range is valid
  const isTimeRangeValid = useCallback(() => {
    if (!startDate || !endDate || !startTime || !endTime) {
      return false
    }

    if (
      !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/.test(startTime) ||
      !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/.test(endTime)
    ) {
      return false
    }

    try {
      // Parse time with seconds
      const parseTimeWithSeconds = (timeString) => {
        const parts = timeString.split(":")
        return {
          hours: Number.parseInt(parts[0] || "0", 10),
          minutes: Number.parseInt(parts[1] || "0", 10),
          seconds: Number.parseInt(parts[2] || "0", 10),
        }
      }

      const startParts = parseTimeWithSeconds(startTime)
      const endParts = parseTimeWithSeconds(endTime)

      // Create date objects for comparison
      const startDateTime = new Date(startDate)
      startDateTime.setHours(startParts.hours, startParts.minutes, startParts.seconds)

      const endDateTime = new Date(endDate)
      endDateTime.setHours(endParts.hours, endParts.minutes, endParts.seconds)

      const selectedDuration = (endDateTime - startDateTime) / 1000 // Duration in seconds

      // Use rounded duration for validation
      return selectedDuration <= roundedDuration && selectedDuration > 0
    } catch (error) {
      console.error("Error validating time range:", error)
      return false
    }
  }, [startDate, endDate, startTime, endTime, roundedDuration])

  // Check if the current step is valid and can proceed to the next step
  const isStepValid = useCallback(
    (step) => {
      switch (step) {
        case 0: // Video selection
          return !!file
        case 1: // Date/time selection
          return isTimeRangeValid()
        case 2: // Coordinate selection
          return pointsData.length === 4
        case 3: // Confirmation
          return true
        default:
          return false
      }
    },
    [file, pointsData.length, isTimeRangeValid],
  )

  // Fix for navigation issues - force update when video is processed
  useEffect(() => {
    if (file && firstFrame && !videoProcessed.current) {
      videoProcessed.current = true
      // Force a re-render to ensure navigation works
      setCurrentStep(0)
    }
  }, [file, firstFrame])

  // Handle carousel API setup
  useEffect(() => {
    if (api) {
      // Initial setup when API is available
      api.scrollTo(currentStep)

      // Set up event listener for carousel changes
      const handleSelect = () => {
        const selectedIndex = api.selectedScrollSnap()

        // If trying to go forward without completing previous steps
        if (selectedIndex > 0) {
          let canProceed = true

          // Check all previous steps
          for (let i = 0; i < selectedIndex; i++) {
            if (!isStepValid(i)) {
              canProceed = false
              break
            }
          }

          if (!canProceed) {
            // Find the last valid step
            let lastValidStep = 0
            for (let i = 0; i < selectedIndex; i++) {
              if (isStepValid(i)) {
                lastValidStep = i + 1
              } else {
                break
              }
            }

            // Go back to the last valid step
            api.scrollTo(lastValidStep)
            setCurrentStep(lastValidStep)
            toast.error("Please complete the previous steps before proceeding.")
            return
          }
        }

        // Update current step if navigation is valid
        setCurrentStep(selectedIndex)
      }

      api.on("select", handleSelect)

      return () => {
        api.off("select", handleSelect)
      }
    }
  }, [api, isStepValid, currentStep])

  // Poll for job status if we have a jobId and are processing
  useEffect(() => {
    let intervalId
    let failedAttempts = 0; // Track failed backend polls
    if (jobId && isProcessing) {
      intervalId = setInterval(async () => {
        try {
          const response = await heatmapService.getJobStatus(jobId)
          setStatusMessage(response.message || "Processing video...")
          failedAttempts = 0; // Reset on success
          // Update processing step based on message content
          if (response.message && response.message.includes("YOLO")) {
            setProcessingStep(1)
          } else if (response.message && response.message.includes("track")) {
            setProcessingStep(2)
          } else if (
            (response.message && response.message.includes("Normalizing")) ||
            (response.message && response.message.includes("Saving"))
          ) {
            setProcessingStep(3)
          }
          // Check if processing is complete
          if (response.status === "completed") {
            setIsProcessing(false)
            setProcessingComplete(true)
            clearInterval(intervalId)
            toast.success("Video processing complete")
            // Dispatch dashboard refresh event
            window.dispatchEvent(new Event('dashboard-refresh'));
            // Write to localStorage for global notification
            localStorage.setItem('jobCompleted', JSON.stringify({
              jobName: file?.name || 'Video',
              jobId,
              ts: Date.now()
            }));
            // Dispatch custom event and show toast in same tab
            window.dispatchEvent(new CustomEvent('job-completed', { detail: { jobName: file?.name || 'Video', jobId } }));
          } else if (response.status === "error") {
            setIsProcessing(false)
            clearInterval(intervalId)
            toast.error(`Processing failed: ${response.message}`)
          }
        } catch (error) {
          failedAttempts++;
          if (failedAttempts >= 5) {
            setIsProcessing(false);
            setStatusMessage("Server unreachable. Please check your connection or try again later.");
            clearInterval(intervalId);
            toast.error("Unable to contact server. Please check your connection or try again later.");
          } else {
            setStatusMessage("Waiting for server response...");
          }
        }
      }, 2000) // Poll every 2 seconds
    }
    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [jobId, isProcessing, file])

  // Update progress percent when statusMessage changes
  useEffect(() => {
    const getProgressPercent = (statusMessage) => {
      if (!statusMessage) return null
      const match = statusMessage.match(/(\d+)%/)
      if (match) {
        return Number.parseInt(match[1], 10)
      }
      return null
    }

    const percent = getProgressPercent(statusMessage)
    setProgressPercent(percent)
  }, [statusMessage])

  useEffect(() => {
    if (processingComplete && jobId) {
      navigate(`/view-heatmap?jobId=${jobId}`)
    }
  }, [processingComplete, jobId, navigate])

  // Clean up video preview URL when component unmounts
  useEffect(() => {
    return () => {
      if (videoPreviewUrl) {
        URL.revokeObjectURL(videoPreviewUrl)
      }
    }
  }, [videoPreviewUrl])

  // On mount, restore in-progress job from backend if currentJobId is in localStorage
  useEffect(() => {
    const restoreInProgressJob = async () => {
      const savedJobId = localStorage.getItem('currentJobId');
      if (savedJobId && !jobId) {
        try {
          // Fetch job status
          const statusResp = await heatmapService.getJobStatus(savedJobId);
          if (statusResp.status === 'pending' || statusResp.status === 'processing') {
            // Fetch job details from backend
            const jobDetails = await heatmapService.getJobDetails(savedJobId);
            // Fetch pointsData from new endpoint for robust restoration
            let restoredPoints = [];
            try {
              restoredPoints = await heatmapService.getJobPoints(savedJobId);
            } catch (e) {
              restoredPoints = [];
            }
            // Fetch time range from new endpoint for robust restoration
            let restoredTimeRange = { start_date: '', end_date: '', start_time: '', end_time: '' };
            try {
              restoredTimeRange = await heatmapService.getJobTimeRange(savedJobId);
            } catch (e) {
              restoredTimeRange = { start_date: '', end_date: '', start_time: '', end_time: '' };
            }
            setJobId(savedJobId);
            setIsProcessing(true);
            setCurrentStep(3); // Step 4 (0-based index)
            // Restore summary fields from backend
            setStartDate(restoredTimeRange.start_date);
            setEndDate(restoredTimeRange.end_date);
            setStartTime(restoredTimeRange.start_time);
            setEndTime(restoredTimeRange.end_time);
            setPointsData(restoredPoints); // Use robustly restored points
            setFile({ name: jobDetails.input_video_name }); // Only name, can't restore file object
          } else {
            // Job is done or cancelled, clear localStorage and reset UI
            localStorage.removeItem('currentJobId');
            setJobId(null);
            setIsProcessing(false);
            setCurrentStep(0);
          }
        } catch (err) {
          // If job not found, clear state
          localStorage.removeItem('currentJobId');
          setJobId(null);
          setIsProcessing(false);
          setCurrentStep(0);
        }
      }
    };
    restoreInProgressJob();
  }, []);

  // When job is completed, errored, or cancelled, remove currentJobId from localStorage
  useEffect(() => {
    if (jobId && (statusMessage.includes('completed') || statusMessage.includes('cancelled') || statusMessage.includes('error'))) {
      localStorage.removeItem('currentJobId');
    }
  }, [jobId, statusMessage]);

  // Handle file selection and extract first frame
  const handleFileChange = (selectedFile) => {
    if (!selectedFile) {
      setFile(null)
      setVideoPreviewUrl(null)
      return
    }

    if (!selectedFile.type.includes("video/")) {
      toast.error("Please upload a valid video file")
      return
    }

    setFile(selectedFile)
    setBackendError(null)
    setPointsData([])
    setFirstFrame(null)
    videoProcessed.current = false

    // Create video preview URL
    if (videoPreviewUrl) {
      URL.revokeObjectURL(videoPreviewUrl)
    }
    const url = URL.createObjectURL(selectedFile)
    setVideoPreviewUrl(url)

    // Extract first frame and set duration
    const video = document.createElement("video")
    video.src = url
    video.onloadedmetadata = () => {
      video.currentTime = 0.1 // Set to slightly after the start to ensure we get a valid frame
    }

    video.onloadeddata = () => {
      setTimeout(() => {
        // Add a small delay to ensure the frame is loaded
        const canvas = document.createElement("canvas")
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext("2d")
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

        try {
          const dataURL = canvas.toDataURL("image/png")
          setFirstFrame(dataURL)
          console.log("First frame extracted successfully")
        } catch (err) {
          console.error("Error creating data URL:", err)
          toast.error("Failed to extract first frame from video")
        }

        // Set both original and rounded duration
        setDuration(video.duration)
        const rounded = Math.floor(video.duration) // Round down to whole seconds
        setRoundedDuration(rounded)

        // Set default date to today
        const today = new Date()
        const formattedDate = today.toISOString().split("T")[0] // YYYY-MM-DD format
        setStartDate(formattedDate)
        setEndDate(formattedDate)

        // Set default start time to now with seconds
        const formatTimeWithSeconds = (hours, minutes, seconds) => {
          return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
            2,
            "0",
          )}:${String(seconds).padStart(2, "0")}`
        }

        const startHours = today.getHours()
        const startMinutes = today.getMinutes()
        const startSeconds = today.getSeconds()
        const formattedStartTime = formatTimeWithSeconds(startHours, startMinutes, startSeconds)

        // Set the start time
        setStartTime(formattedStartTime)

        // Calculate end time
        const startTotalSeconds = startHours * 3600 + startMinutes * 60 + startSeconds
        const videoDurationSeconds = rounded

        // Add duration to start time (in seconds)
        const endTotalSeconds = startTotalSeconds + videoDurationSeconds - 1

        // Convert back to hours, minutes, and seconds
        const endHours = Math.floor(endTotalSeconds / 3600) % 24
        const endMinutes = Math.floor((endTotalSeconds % 3600) / 60)
        const endSeconds = endTotalSeconds % 60

        // Format with leading zeros
        const formattedEndTime = formatTimeWithSeconds(endHours, endMinutes, endSeconds)

        // Set the end time
        setEndTime(formattedEndTime)
      }, 200)
    }
  }

  // Handle point plotting on the first frame
  const handleFrameClick = (e) => {
    if (pointsData.length >= 4) return // Limit to 4 points
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width).toFixed(4)
    const y = ((e.clientY - rect.top) / rect.height).toFixed(4)
    setPointsData([...pointsData, { x, y }])
  }

  // Remove a point if clicked
  const handleRemovePoint = (idx) => {
    setPointsData(pointsData.filter((_, i) => i !== idx))
  }

  // Process the video
  const handleProcessVideo = async () => {
    if (!isStepValid(3)) {
      toast.error("Please ensure all criteria are met before processing.")
      return
    }
    setIsProcessing(true)
    setBackendError(null)
    try {
      const formData = new FormData()
      formData.append("videoFile", file)
      formData.append("pointsData", JSON.stringify(pointsData))
      formData.append("start_date", startDate)
      formData.append("end_date", endDate)
      formData.append("start_time", startTime)
      formData.append("end_time", endTime)
      const response = await heatmapService.createJob(formData)
      setJobId(response.job_id)
      setStatusMessage("Video uploaded and processing started")
      // Always set currentJobId in localStorage after job creation
      localStorage.setItem('currentJobId', response.job_id)
      toast.success("Video uploaded and processing started")
    } catch (error) {
      console.error("Error processing video:", error)
      setIsProcessing(false)
      setBackendError(error.error || "Failed to process video")
      toast.error(error.error || "Failed to process video")
    }
  }

  // Handle cancel job with navigation-aware logic
  const handleCancelJob = async () => {
    if (!jobId) return;
    try {
      await heatmapService.cancelJob(jobId);
      setIsProcessing(false);
      setStatusMessage("Processing cancelled.");
      toast.info("Processing cancelled");
      // Dispatch dashboard refresh event
      window.dispatchEvent(new Event('dashboard-refresh'));
      // Write to localStorage for global notification
      localStorage.setItem('jobCancelled', JSON.stringify({
        jobName: file?.name || 'Video',
        jobId,
        ts: Date.now()
      }));
      // Dispatch custom event and show toast in same tab
      window.dispatchEvent(new CustomEvent('job-cancelled', { detail: { jobName: file?.name || 'Video', jobId } }));
      // If file is not a real File object (user navigated away), reset to step 1
      if (!file || !(file instanceof File)) {
        setJobId(null);
        setFile(null);
        setVideoPreviewUrl(null);
        setPointsData([]);
        setStartDate("");
        setEndDate("");
        setStartTime("00:00:00");
        setEndTime("00:00:00");
        setFirstFrame(null);
        setCurrentStep(0);
        localStorage.removeItem('currentJobId');
      }
      // else: stay on step 4, allow retry
    } catch (err) {
      toast.error("Failed to cancel job");
    }
  };

  return (
    <div className="container mx-auto px-4 py-4 max-w-4xl">
      {/* Carousel for steps */}
      <div className="bg-gradient-to-br from-background/80 to-muted/90 dark:from-slate-900/80 dark:to-slate-950/90 rounded-lg border border-border shadow-xl shadow-primary/10 backdrop-blur-xl">
        <Carousel
          setApi={setApi}
          opts={{
            startIndex: currentStep,
            dragFree: false,
            draggable: false,
          }}
        >
          <CarouselContent>
            {/* Step 1: Video Selection */}
            <CarouselItem>
              <VideoSelectionStep
                file={file}
                videoPreviewUrl={videoPreviewUrl}
                onFileChange={handleFileChange}
                isValid={isStepValid(0)}
              />
            </CarouselItem>
            {/* Step 2: Date/Time Selection */}
            <CarouselItem>
              <DateTimeSelectionStep
                startDate={startDate}
                endDate={endDate}
                startTime={startTime}
                endTime={endTime}
                duration={duration}
                roundedDuration={roundedDuration}
                setStartDate={setStartDate}
                setEndDate={setEndDate}
                setStartTime={setStartTime}
                setEndTime={setEndTime}
                isValid={isTimeRangeValid()}
              />
            </CarouselItem>
            {/* Step 3: Coordinate Selection */}
            <CarouselItem>
              <CoordinateSelectionStep
                firstFrame={firstFrame}
                pointsData={pointsData}
                onFrameClick={handleFrameClick}
                onRemovePoint={handleRemovePoint}
                isValid={pointsData.length === 4}
              />
            </CarouselItem>
            {/* Step 4: Confirmation */}
            <CarouselItem>
              <ConfirmationStep
                file={file}
                startDate={startDate}
                endDate={endDate}
                startTime={startTime}
                endTime={endTime}
                pointsData={pointsData}
                isProcessing={isProcessing}
                statusMessage={statusMessage}
                progressPercent={progressPercent}
                backendError={backendError}
                onProcess={handleProcessVideo}
                onCancel={handleCancelJob}
              />
            </CarouselItem>
          </CarouselContent>
        </Carousel>
      </div>
      {/* Step Pagination (Unified) - now at the bottom */}
      <div className="mt-20">
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => {
                  if (currentStep > 0 && !isProcessing) {
                    setCurrentStep(currentStep - 1);
                  }
                }}
                disabled={currentStep === 0 || isProcessing}
              />
            </PaginationItem>
            {[0, 1, 2, 3].map((idx) => (
              <PaginationItem key={idx}>
                <PaginationLink
                  isActive={currentStep === idx}
                  onClick={() => {
                    // Only allow navigation if all previous steps are valid
                    let canProceed = true;
                    for (let i = 0; i < idx; i++) {
                      if (!isStepValid(i)) {
                        canProceed = false;
                        break;
                      }
                    }
                    if (canProceed && !isProcessing) setCurrentStep(idx);
                  }}
                  disabled={
                    (idx > 0 && !isStepValid(idx - 1)) ||
                    (idx > currentStep + 1) ||
                    isProcessing
                  }
                >
                  {idx + 1}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                onClick={() => {
                  if (isStepValid(currentStep) && currentStep < 3 && !isProcessing) {
                    setCurrentStep(currentStep + 1);
                  }
                }}
                disabled={
                  !isStepValid(currentStep) ||
                  currentStep === 3 ||
                  isProcessing
                }
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  )
}

export default CreateHeatmap
