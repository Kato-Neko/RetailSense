"use client";

import { useMemo } from "react";
import { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { heatmapService } from "../../services/api";
import "../../styles/VideoProcessing.css";
import VideoUploadBox from "./VideoUploadBox";
import { ChevronUp, ChevronDown, Clock } from "lucide-react";

const getProgressPercent = (statusMessage) => {
  // Try to extract percentage from status message
  if (!statusMessage) return null;
  const match = statusMessage.match(/(\d+)%/);
  if (match) {
    return Number.parseInt(match[1], 10);
  }
  return null;
};

// Helper function to format time with seconds
const formatTimeWithSeconds = (hours, minutes, seconds) => {
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
  )}:${String(seconds).padStart(2, "0")}`;
};

// Helper function to parse time with seconds
const parseTimeWithSeconds = (timeString) => {
  const parts = timeString.split(":");
  const hours = Number.parseInt(parts[0] || "0", 10);
  const minutes = Number.parseInt(parts[1] || "0", 10);
  const seconds = Number.parseInt(parts[2] || "0", 10);
  return { hours, minutes, seconds };
};

// Helper to validate time format
const isValidTimeFormat = (timeString) => {
  return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/.test(timeString);
};

const VideoProcessing = () => {
  const [file, setFile] = useState(null);
  const [duration, setDuration] = useState(0);
  const [roundedDuration, setRoundedDuration] = useState(0); // New state for rounded duration
  const [floorplan, setFloorplan] = useState(null);
  const [pointsData, setPointsData] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [processingComplete, setProcessingComplete] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [backendError, setBackendError] = useState(null);
  const [progressPercent, setProgressPercent] = useState(null);
  const [firstFrame, setFirstFrame] = useState(null);
  const [plottedPoints, setPlottedPoints] = useState([]);
  const [heatmapPreview, setHeatmapPreview] = useState(null);
  const navigate = useNavigate();
  const [detectionResults, setDetectionResults] = useState([]);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [useStubDetection, setUseStubDetection] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("00:00:00");
  const [endTime, setEndTime] = useState("00:00:00");
  const [validationErrors, setValidationErrors] = useState({});

  // Define isTimeRangeValid function before using it
  const isTimeRangeValid = () => {
    console.log("--- Validating Time Range ---");
    console.log("startDate:", startDate);
    console.log("endDate:", endDate);
    console.log("startTime:", startTime);
    console.log("endTime:", endTime);
    console.log("original duration:", duration);
    console.log("rounded duration:", roundedDuration);

    if (!startDate || !endDate) {
      console.log("Validation failed: Missing date");
      return false;
    }

    if (!startTime || !endTime) {
      console.log("Validation failed: Missing time");
      return false;
    }

    if (!isValidTimeFormat(startTime) || !isValidTimeFormat(endTime)) {
      console.log("Validation failed: Invalid time format");
      return false;
    }

    try {
      // For time with seconds, we need to handle the parsing differently
      const startParts = parseTimeWithSeconds(startTime);
      const endParts = parseTimeWithSeconds(endTime);

      console.log("startParts:", startParts);
      console.log("endParts:", endParts);

      // Create date objects for comparison
      const startDateTime = new Date(startDate);
      startDateTime.setHours(
        startParts.hours,
        startParts.minutes,
        startParts.seconds
      );

      const endDateTime = new Date(endDate);
      endDateTime.setHours(endParts.hours, endParts.minutes, endParts.seconds);

      console.log("startDateTime:", startDateTime.toISOString());
      console.log("endDateTime:", endDateTime.toISOString());

      const selectedDuration = (endDateTime - startDateTime) / 1000; // Duration in seconds
      console.log("selectedDuration:", selectedDuration);

      // Use rounded duration for validation instead of exact duration
      const isValid =
        selectedDuration <= roundedDuration && selectedDuration > 0;
      console.log("Time range valid:", isValid);
      return isValid;
    } catch (error) {
      console.error("Error validating time range:", error);
      return false;
    }
  };

  // Check all validation conditions and log them
  const checkAllValidationConditions = () => {
    console.log("--- Checking All Validation Conditions ---");
    const hasFile = !!file;
    console.log("Has file:", hasFile);

    const hasFirstFrame = !!firstFrame;
    console.log("Has first frame:", hasFirstFrame);

    const hasEnoughPoints = pointsData.length === 4;
    console.log(
      "Has enough points:",
      hasEnoughPoints,
      `(${pointsData.length}/4)`
    );

    const timeRangeValid = isTimeRangeValid();
    console.log("Time range valid:", timeRangeValid);

    const notProcessing = !isProcessing;
    console.log("Not processing:", notProcessing);

    const notComplete = !processingComplete;
    console.log("Not complete:", notComplete);

    const noError = !backendError;
    console.log("No backend error:", noError);

    const allValid =
      hasFile &&
      hasFirstFrame &&
      hasEnoughPoints &&
      timeRangeValid &&
      notProcessing &&
      notComplete &&
      noError;
    console.log("All validation conditions met:", allValid);

    return allValid;
  };

  // Poll for job status if we have a jobId and are processing
  useEffect(() => {
    let intervalId;

    if (jobId && isProcessing) {
      intervalId = setInterval(async () => {
        try {
          const response = await heatmapService.getJobStatus(jobId);
          setStatusMessage(response.message || "Processing video...");

          // Update processing step based on message content
          if (response.message && response.message.includes("YOLO")) {
            setProcessingStep(1);
          } else if (response.message && response.message.includes("track")) {
            setProcessingStep(2);
          } else if (
            (response.message && response.message.includes("Normalizing")) ||
            (response.message && response.message.includes("Saving"))
          ) {
            setProcessingStep(3);
          }

          // Check if processing is complete
          if (response.status === "completed") {
            setIsProcessing(false);
            setProcessingComplete(true);
            clearInterval(intervalId);
            toast.success("Video processing complete");
          } else if (response.status === "error") {
            setIsProcessing(false);
            clearInterval(intervalId);
            toast.error(`Processing failed: ${response.message}`);
          }
        } catch (error) {
          console.error("Error checking job status:", error);
          // Don't stop polling on network errors, they might be temporary
          setStatusMessage("Waiting for server response...");
        }
      }, 2000); // Poll every 2 seconds
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [jobId, isProcessing]);

  useEffect(() => {
    // Update progress percent when statusMessage changes
    const percent = getProgressPercent(statusMessage);
    setProgressPercent(percent);
  }, [statusMessage]);

  useEffect(() => {
    if (processingComplete && jobId) {
      navigate(`/heatmap-generation?jobId=${jobId}`);
    }
  }, [processingComplete, jobId, navigate]);

  // Log validation status whenever relevant state changes
  useEffect(() => {
    if (file && firstFrame) {
      console.log("State changed, checking validation...");
      checkAllValidationConditions();
    }
  }, [
    file,
    firstFrame,
    pointsData,
    startDate,
    endDate,
    startTime,
    endTime,
    duration,
    roundedDuration,
  ]);

  // Fetch first frame as PNG when video is selected
  useEffect(() => {
    if (!file) return;
    console.log("Loading video file:", file.name);

    const video = document.createElement("video");
    video.src = URL.createObjectURL(file);
    video.onloadeddata = () => {
      console.log("Video loaded, duration:", video.duration);

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      setFirstFrame(canvas.toDataURL("image/png"));

      // Set both original and rounded duration
      setDuration(video.duration);
      const rounded = Math.floor(video.duration); // Round down to whole seconds
      setRoundedDuration(rounded);
      console.log("Original duration:", video.duration);
      console.log("Rounded duration:", rounded);

      // Set default date to today
      const today = new Date();
      const formattedDate = today.toISOString().split("T")[0]; // YYYY-MM-DD format
      setStartDate(formattedDate);
      setEndDate(formattedDate);
      console.log("Dates set to:", formattedDate);

      // Set default start time to now with seconds
      const startHours = today.getHours();
      const startMinutes = today.getMinutes();
      const startSeconds = today.getSeconds();
      const formattedStartTime = formatTimeWithSeconds(
        startHours,
        startMinutes,
        startSeconds
      );
      console.log("Start time set to:", formattedStartTime);

      // First set the start time
      setStartTime(formattedStartTime);

      // Then calculate end time directly here
      // Calculate total seconds
      const startTotalSeconds =
        startHours * 3600 + startMinutes * 60 + startSeconds;
      const videoDurationSeconds = rounded; // Use rounded duration for end time calculation

      // Add duration to start time (in seconds)
      const endTotalSeconds = startTotalSeconds + videoDurationSeconds;

      // Convert back to hours, minutes, and seconds
      const endHours = Math.floor(endTotalSeconds / 3600) % 24; // Use modulo 24 to handle day wraparound
      const endMinutes = Math.floor((endTotalSeconds % 3600) / 60);
      const endSeconds = endTotalSeconds % 60;

      // Format with leading zeros
      const formattedEndTime = formatTimeWithSeconds(
        endHours,
        endMinutes,
        endSeconds
      );
      console.log("End time calculated as:", formattedEndTime);

      // Set the end time directly
      setEndTime(formattedEndTime);
    };
  }, [file]);

  // Handle point plotting on the first frame
  const handleFrameClick = (e) => {
    if (pointsData.length >= 4) return; // Limit to 4 points
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width).toFixed(4);
    const y = ((e.clientY - rect.top) / rect.height).toFixed(4);
    setPointsData([...pointsData, { x, y }]);
    console.log(`Point ${pointsData.length + 1} added at (${x}, ${y})`);
  };

  // Remove a point if clicked
  const handleRemovePoint = (idx) => {
    setPointsData(pointsData.filter((_, i) => i !== idx));
    console.log(`Point ${idx + 1} removed`);
  };

  // Update isReadyToProcess condition
  const isReadyToProcess = useMemo(() => {
    const result =
      file &&
      firstFrame &&
      pointsData.length === 4 &&
      isTimeRangeValid() &&
      !isProcessing &&
      !processingComplete &&
      !backendError;

    console.log("isReadyToProcess:", result);
    return result;
  }, [
    file,
    firstFrame,
    pointsData,
    startDate,
    endDate,
    startTime,
    endTime,
    isProcessing,
    processingComplete,
    backendError,
    roundedDuration, // Add roundedDuration to dependencies
  ]);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    if (!selectedFile.type.includes("video/")) {
      toast.error("Please upload a valid video file");
      return;
    }
    console.log("File selected:", selectedFile.name);
    setFile(selectedFile);
    setBackendError(null);
    setPointsData([]);
    setFirstFrame(null);
  };

  const handleFloorplanChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    if (!selectedFile.type.match(/image\/(png|jpg|jpeg)/)) {
      toast.error("Please upload a valid floorplan image (PNG, JPG, JPEG)");
      return;
    }
    setFloorplan(selectedFile);
    setBackendError(null);
  };

  const handlePointsChange = (e) => {
    setPointsData(e.target.value);
  };

  const handleProcessVideo = async () => {
    console.log("Process Video button clicked");
    console.log("Validation status:", checkAllValidationConditions());

    if (!checkAllValidationConditions()) {
      toast.error("Please ensure all criteria are met before processing.");
      return;
    }

    setIsProcessing(true);
    setBackendError(null);
    try {
      const formData = new FormData();
      formData.append("videoFile", file);
      formData.append("pointsData", JSON.stringify(pointsData));
      formData.append("start_date", startDate);
      formData.append("end_date", endDate);
      formData.append("start_time", startTime);
      formData.append("end_time", endTime);
      console.log("Submitting form data:", {
        pointsData,
        startDate,
        endDate,
        startTime,
        endTime,
      });

      const response = await heatmapService.createJob(formData);
      setJobId(response.job_id);
      setStatusMessage("Video uploaded and processing started");
      toast.success("Video uploaded and processing started");
    } catch (error) {
      console.error("Error processing video:", error);
      setIsProcessing(false);
      setBackendError(error.error || "Failed to process video");
      toast.error(error.error || "Failed to process video");
    }
  };

  const handleCancelJob = async () => {
    if (!jobId) return;
    try {
      await heatmapService.cancelJob(jobId);
      setIsProcessing(false);
      setStatusMessage("Processing cancelled.");
      toast("Processing cancelled");
    } catch (err) {
      toast.error("Failed to cancel job");
    }
  };

  const resetProcess = () => {
    setFile(null);
    setFloorplan(null);
    setPointsData([]);
    setProcessingStep(0);
    setProcessingComplete(false);
    setJobId(null);
    setStatusMessage("");
    setBackendError(null);
  };

  const viewHeatmap = () => {
    if (jobId) {
      navigate(`/heatmap-generation?jobId=${jobId}`);
    }
  };

  const tryAgain = () => {
    setBackendError(null);
    setIsProcessing(false);
  };

  // Function to update end time based on start time and video duration
  const updateEndTime = (newStartTime) => {
    console.log("Updating end time based on start time:", newStartTime);
    if (!roundedDuration || roundedDuration <= 0) {
      console.log("Cannot update end time: invalid duration", roundedDuration);
      return;
    }

    // Parse start time with seconds
    const {
      hours: startHours,
      minutes: startMinutes,
      seconds: startSeconds,
    } = parseTimeWithSeconds(newStartTime);
    console.log("Parsed start time:", {
      startHours,
      startMinutes,
      startSeconds,
    });

    // Calculate total seconds
    const startTotalSeconds =
      startHours * 3600 + startMinutes * 60 + startSeconds;
    const videoDurationSeconds = roundedDuration; // Use rounded duration
    console.log("Video duration (seconds):", videoDurationSeconds);

    // Add duration to start time (in seconds)
    const endTotalSeconds = startTotalSeconds + videoDurationSeconds;

    // Convert back to hours, minutes, and seconds
    const endHours = Math.floor(endTotalSeconds / 3600) % 24; // Use modulo 24 to handle day wraparound
    const endMinutes = Math.floor((endTotalSeconds % 3600) / 60);
    const endSeconds = endTotalSeconds % 60;

    // Format with leading zeros
    const formattedEndTime = formatTimeWithSeconds(
      endHours,
      endMinutes,
      endSeconds
    );
    console.log("Calculated end time:", formattedEndTime);

    setEndTime(formattedEndTime);
  };

  // Time input helpers
  const adjustTime = (timeString, field, amount) => {
    const { hours, minutes, seconds } = parseTimeWithSeconds(timeString);

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

    return formatTimeWithSeconds(newHours, newMinutes, newSeconds);
  };

  // Handle changes to the start time input
  const handleStartTimeChange = (e) => {
    const newStartTime = e.target.value;
    console.log("Start time changed to:", newStartTime);
    setStartTime(newStartTime);

    if (isValidTimeFormat(newStartTime)) {
      updateEndTime(newStartTime); // Update end time based on new start time
    }
  };

  // Handle changes to the end time input
  const handleEndTimeChange = (e) => {
    const newEndTime = e.target.value;
    console.log("End time changed to:", newEndTime);
    setEndTime(newEndTime);
  };

  // Adjust start time
  const adjustStartTime = (field, amount) => {
    const newTime = adjustTime(startTime, field, amount);
    console.log(`Adjusting start time ${field} by ${amount} to ${newTime}`);
    setStartTime(newTime);
    updateEndTime(newTime);
  };

  // Adjust end time
  const adjustEndTime = (field, amount) => {
    const newTime = adjustTime(endTime, field, amount);
    console.log(`Adjusting end time ${field} by ${amount} to ${newTime}`);
    setEndTime(newTime);
  };

  // Set to current time
  const setToCurrentTime = () => {
    const now = new Date();
    const currentTime = formatTimeWithSeconds(
      now.getHours(),
      now.getMinutes(),
      now.getSeconds()
    );
    console.log("Setting to current time:", currentTime);
    setStartTime(currentTime);
    updateEndTime(currentTime);
  };

  // Format duration for display
  const formatDuration = (durationInSeconds) => {
    if (!durationInSeconds) return "0 seconds";

    const minutes = Math.floor(durationInSeconds / 60);
    const seconds = Math.floor(durationInSeconds % 60);
    const milliseconds = Math.floor((durationInSeconds % 1) * 1000);

    let result = "";
    if (minutes > 0) {
      result += `${minutes} minute${minutes !== 1 ? "s" : ""} `;
    }
    if (seconds > 0 || minutes === 0) {
      result += `${seconds} second${seconds !== 1 ? "s" : ""} `;
    }
    if (milliseconds > 0) {
      result += `${milliseconds} ms`;
    }

    return result.trim();
  };

  // Time input component with helpers
  const TimeInput = ({ label, value, onChange, onAdjust }) => (
    <div style={{ marginBottom: "10px" }}>
      <div
        style={{ display: "flex", alignItems: "center", marginBottom: "5px" }}
      >
        <span style={{ marginRight: "5px", minWidth: "40px" }}>{label}:</span>
        <input
          type="text"
          value={value}
          onChange={onChange}
          placeholder="HH:MM:SS"
          pattern="[0-9]{2}:[0-9]{2}:[0-9]{2}"
          style={{
            width: "100%",
            padding: "5px",
            border: isValidTimeFormat(value)
              ? "1px solid #ccc"
              : "1px solid red",
          }}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: "30%",
          }}
        >
          <button
            type="button"
            onClick={() => onAdjust("hours", 1)}
            style={{ padding: "2px 5px", marginBottom: "2px" }}
          >
            <ChevronUp size={12} />
          </button>
          <span style={{ fontSize: "12px" }}>Hours</span>
          <button
            type="button"
            onClick={() => onAdjust("hours", -1)}
            style={{ padding: "2px 5px", marginTop: "2px" }}
          >
            <ChevronDown size={12} />
          </button>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: "30%",
          }}
        >
          <button
            type="button"
            onClick={() => onAdjust("minutes", 1)}
            style={{ padding: "2px 5px", marginBottom: "2px" }}
          >
            <ChevronUp size={12} />
          </button>
          <span style={{ fontSize: "12px" }}>Minutes</span>
          <button
            type="button"
            onClick={() => onAdjust("minutes", -1)}
            style={{ padding: "2px 5px", marginTop: "2px" }}
          >
            <ChevronDown size={12} />
          </button>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: "30%",
          }}
        >
          <button
            type="button"
            onClick={() => onAdjust("seconds", 1)}
            style={{ padding: "2px 5px", marginBottom: "2px" }}
          >
            <ChevronUp size={12} />
          </button>
          <span style={{ fontSize: "12px" }}>Seconds</span>
          <button
            type="button"
            onClick={() => onAdjust("seconds", -1)}
            style={{ padding: "2px 5px", marginTop: "2px" }}
          >
            <ChevronDown size={12} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div
      className="video-processing-overhaul"
      style={{
        display: "flex",
        flexDirection: "row",
        width: "100%",
        padding: "20px",
        background: "var(--background)",
      }}
    >
      <div
        className="video-upload-section"
        style={{ flex: 1, position: "relative" }}
      >
        <VideoUploadBox file={file} onFileChange={handleFileChange} />
        {firstFrame && (
          <div
            className="point-plotting-overlay"
            onClick={handleFrameClick}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              cursor: pointsData.length < 4 ? "crosshair" : "default",
              zIndex: 20,
            }}
          >
            <img
              src={firstFrame || "/placeholder.svg"}
              alt="First frame"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                borderRadius: 8,
                filter: "brightness(0.95)",
                position: "absolute",
                top: 0,
                left: 0,
                zIndex: 1,
              }}
            />
            {/* Plotted points */}
            {pointsData.map((pt, idx) => (
              <div
                key={idx}
                style={{
                  position: "absolute",
                  left: `calc(${pt.x * 100}% - 10px)`,
                  top: `calc(${pt.y * 100}% - 10px)`,
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: "#fff",
                  border: "2px solid #222",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  zIndex: 2,
                }}
                title="Remove point"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemovePoint(idx);
                }}
              >
                <span
                  style={{ color: "#222", fontWeight: "bold", fontSize: 12 }}
                >
                  {idx + 1}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div
        className="date-time-section"
        style={{ flex: 0, width: "300px", marginLeft: "20px" }}
      >
        <div className="duration-display">
          {file ? (
            <div>
              <p>
                Please select the appropriate date and time for this
                <span style={{ color: "green" }}>{` ${formatDuration(
                  duration
                )}`}</span>{" "}
                video.
              </p>
              <p style={{ fontSize: "14px", color: "#666" }}>
                <strong>Note:</strong> For validation purposes, the duration is
                rounded down to{" "}
                <span style={{ color: "blue" }}>{roundedDuration} seconds</span>
                .
              </p>
            </div>
          ) : (
            <p>Please upload a video to see its duration.</p>
          )}
        </div>
        <div className="date-time-inputs">
          <label>Date Range:</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />

          <div
            style={{
              marginTop: "15px",
              marginBottom: "10px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <label>Time Range (HH:MM:SS):</label>
            <div>
              <button
                type="button"
                onClick={setToCurrentTime}
                style={{
                  marginLeft: "5px",
                  padding: "3px 8px",
                  display: "flex",
                  alignItems: "center",
                  fontSize: "12px",
                }}
              >
                <Clock size={12} style={{ marginRight: "5px" }} /> Now
              </button>
            </div>
          </div>

          <TimeInput
            label="Start"
            value={startTime}
            onChange={handleStartTimeChange}
            onAdjust={adjustStartTime}
          />

          <TimeInput
            label="End"
            value={endTime}
            onChange={handleEndTimeChange}
            onAdjust={adjustEndTime}
          />

          {/* Validation status display */}
          <div style={{ marginTop: "15px", fontSize: "14px" }}>
            <div
              style={{
                color: file ? "green" : "red",
                marginBottom: "5px",
              }}
            >
              ✓ Video file: {file ? "Uploaded" : "Missing"}
            </div>
            <div
              style={{
                color: pointsData.length === 4 ? "green" : "red",
                marginBottom: "5px",
              }}
            >
              ✓ Corner points: {pointsData.length}/4
            </div>
            <div
              style={{
                color: isTimeRangeValid() ? "green" : "red",
                marginBottom: "5px",
              }}
            >
              ✓ Time range: {isTimeRangeValid() ? "Valid" : "Invalid"}
            </div>
          </div>
        </div>
        <button
          className="process-button"
          onClick={handleProcessVideo}
          disabled={!isReadyToProcess}
          style={{
            marginTop: "15px",
            padding: "10px",
            backgroundColor: isReadyToProcess ? "#4CAF50" : "#cccccc",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: isReadyToProcess ? "pointer" : "not-allowed",
          }}
        >
          Process Video
        </button>
      </div>
    </div>
  );
};

export default VideoProcessing;
