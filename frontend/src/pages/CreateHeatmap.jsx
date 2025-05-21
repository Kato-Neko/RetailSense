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

    if (jobId && isProcessing) {
      intervalId = setInterval(async () => {
        try {
          const response = await heatmapService.getJobStatus(jobId)
          setStatusMessage(response.message || "Processing video...")

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
          } else if (response.status === "error") {
            setIsProcessing(false)
            clearInterval(intervalId)
            toast.error(`Processing failed: ${response.message}`)
          }
        } catch (error) {
          console.error("Error checking job status:", error)
          // Don't stop polling on network errors, they might be temporary
          setStatusMessage("Waiting for server response...")
        }
      }, 2000) // Poll every 2 seconds
    }

    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [jobId, isProcessing])

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
      navigate(`/heatmap-generation?jobId=${jobId}`)
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
      toast.success("Video uploaded and processing started")
    } catch (error) {
      console.error("Error processing video:", error)
      setIsProcessing(false)
      setBackendError(error.error || "Failed to process video")
      toast.error(error.error || "Failed to process video")
    }
  }

  // Handle navigation between steps
  const goToStep = (step) => {
    if (step >= 0 && step <= 3) {
      // If trying to go forward without completing previous steps
      let canProceed = true

      if (step > 0) {
        for (let i = 0; i < step; i++) {
          if (!isStepValid(i)) {
            canProceed = false
            break
          }
        }
      }

      if (!canProceed) {
        toast.error("Please complete the previous steps before proceeding.")
        return
      }

      setCurrentStep(step)
      api?.scrollTo(step)
    }
  }

  // Handle cancel job
  const handleCancelJob = async () => {
    if (!jobId) return
    try {
      await heatmapService.cancelJob(jobId)
      setIsProcessing(false)
      setStatusMessage("Processing cancelled.")
      toast.info("Processing cancelled")
    } catch (err) {
      toast.error("Failed to cancel job")
    }
  }

  // Force Next button to work properly
  const forceNextStep = () => {
    if (isStepValid(currentStep)) {
      const nextStep = currentStep + 1
      setCurrentStep(nextStep)
      api?.scrollTo(nextStep)
    } else {
      toast.error("Please complete the current step before proceeding.")
    }
  }

  return (
    <div className="container mx-auto px-4 py-4 max-w-4xl">
      {/* Step Pagination */}
      <div className="mb-6">
        <div className="flex justify-center mb-6">
          <div className="flex space-x-2">
            {['Select', 'Date', 'Points', 'Confirm'].map((step, index) => (
              <button
                key={index}
                onClick={() => goToStep(index)}
                disabled={index > 0 && !isStepValid(index - 1) && index > currentStep}
                className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 shadow-md backdrop-blur-md border border-border text-lg font-bold
                  ${currentStep === index
                    ? 'bg-gradient-to-br from-white to-cyan-200 text-black dark:from-blue-900 dark:to-cyan-800 dark:text-white'
                    : index < currentStep
                      ? 'bg-muted text-foreground'
                      : 'bg-muted/60 text-muted-foreground'}
                  ${index > 0 && !isStepValid(index - 1) && index > currentStep
                    ? 'opacity-50 cursor-not-allowed'
                    : 'cursor-pointer'}
                `}
              >
                {index + 1}
              </button>
            ))}
          </div>
        </div>
      </div>
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
                onNext={forceNextStep}
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
                onPrevious={() => goToStep(0)}
                onNext={forceNextStep}
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
                onPrevious={() => goToStep(1)}
                onNext={forceNextStep}
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
                onPrevious={() => goToStep(2)}
                onProcess={handleProcessVideo}
                onCancel={handleCancelJob}
              />
            </CarouselItem>
          </CarouselContent>
        </Carousel>
      </div>
    </div>
  )
}

export default CreateHeatmap
