"use client";

import { useState, useEffect, useRef } from "react";
import { Upload, Play, AlertCircle, CheckCircle, Loader, X } from "lucide-react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { heatmapService } from "../../services/api";
import "../../styles/VideoProcessing.css";
import VideoUploadBox from "./VideoUploadBox";
import ProgressCircle from "./ProgressCircle";
import API_BASE_URL from "../../config";
import DetectionOverlay from "./DetectionOverlay";

const getProgressPercent = (statusMessage) => {
  // Try to extract percentage from status message
  if (!statusMessage) return null;
  const match = statusMessage.match(/(\d+)%/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
};

const VideoProcessing = () => {
  const [file, setFile] = useState(null);
  const [floorplan, setFloorplan] = useState(null);
  const [pointsData, setPointsData] = useState("");
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

  // Fetch first frame as PNG when video is selected
  useEffect(() => {
    if (!file) return;
    // Simulate backend call to get first frame as PNG
    // Replace with actual API call
    const video = document.createElement('video');
    video.src = URL.createObjectURL(file);
    video.currentTime = 0.1;
    video.onloadeddata = () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      setFirstFrame(canvas.toDataURL('image/png'));
    };
  }, [file]);

  // Handle point plotting on the first frame
  const handleFrameClick = (e) => {
    if (plottedPoints.length >= 4) return;
    const rect = rightBoxRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width).toFixed(4);
    const y = ((e.clientY - rect.top) / rect.height).toFixed(4);
    setPlottedPoints([...plottedPoints, { x, y }]);
  };

  // Remove a point if clicked
  const handleRemovePoint = (idx) => {
    setPlottedPoints(plottedPoints.filter((_, i) => i !== idx));
  };

  // Only enable process button if video is uploaded and 4 points are placed
  const isReadyToProcess = file && plottedPoints.length === 4 && !isProcessing && !processingComplete && !backendError;

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    if (!selectedFile.type.includes("video/")) {
      toast.error("Please upload a valid video file");
      return;
    }
    setFile(selectedFile);
    setBackendError(null);
    setPlottedPoints([]);
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
    if (!file || plottedPoints.length !== 4) {
      toast.error("Please select a video and plot 4 points.");
      return;
    }
    setIsProcessing(true);
    setBackendError(null);
    try {
      const formData = new FormData();
      formData.append("videoFile", file);
      formData.append("pointsData", JSON.stringify(plottedPoints));
      const response = await heatmapService.createJob(formData);
      setJobId(response.job_id);
      setStatusMessage("Video uploaded and processing started");
      toast.success("Video uploaded and processing started");
    } catch (error) {
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
    setPointsData("");
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

  return (
    <div className="video-processing-overhaul" style={{ position: 'relative', minHeight: '85vh', width: '100%', padding: 0, margin: 0, background: 'var(--background)', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
      <h1 className="page-title">Video Processing</h1>
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', height: '100%' }}>
        <div style={{ width: '60vw', maxWidth: 900, minWidth: 320, height: '60vh', minHeight: 320, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <VideoUploadBox file={file} onFileChange={handleFileChange} videoRef={videoRef} />
          {/* Point plotting overlay */}
          {file && !isProcessing && (
            <div
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', cursor: plottedPoints.length < 4 ? 'crosshair' : 'default', zIndex: 20 }}
              onClick={e => {
                if (plottedPoints.length >= 4) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width).toFixed(4);
                const y = ((e.clientY - rect.top) / rect.height).toFixed(4);
                setPlottedPoints([...plottedPoints, { x, y }]);
              }}
            >
              {/* Show first frame as background for plotting */}
              {firstFrame && (
                <img
                  src={firstFrame}
                  alt="First frame"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8, filter: 'brightness(0.95)', position: 'absolute', top: 0, left: 0, zIndex: 1 }}
                />
              )}
              {/* Plotted points */}
              {plottedPoints.map((pt, idx) => (
                <div
                  key={idx}
                  style={{
                    position: 'absolute',
                    left: `calc(${pt.x * 100}% - 10px)` ,
                    top: `calc(${pt.y * 100}% - 10px)` ,
                    width: 20, height: 20, borderRadius: '50%', background: '#fff', border: '2px solid #222',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 2
                  }}
                  title="Remove point"
                  onClick={e => { e.stopPropagation(); setPlottedPoints(plottedPoints.filter((_, i) => i !== idx)); }}
                >
                  <span style={{ color: '#222', fontWeight: 'bold', fontSize: 12 }}>{idx + 1}</span>
                </div>
              ))}
            </div>
          )}
          {/* Progress overlay during processing */}
          {isProcessing && (
            <div
              style={{
                position: 'absolute',
                top: 0, left: 0, width: '100%', height: '100%',
                background: 'rgba(0,0,0,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 100
              }}
            >
              <ProgressCircle percent={progressPercent || 0} />
            </div>
          )}
          {/* Detection overlay (only during processing) */}
          {isProcessing && (
            <DetectionOverlay
              videoRef={videoRef}
              canvasRef={canvasRef}
              detectionResults={detectionResults}
              setDetectionResults={setDetectionResults}
              isProcessing={isProcessing}
              jobId={jobId}
              useStubDetection={useStubDetection}
            />
          )}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 40 }}>
        {isProcessing ? (
          <button className="process-button" style={{ background: '#232526', color: '#fff', border: '1.5px solid #444', fontWeight: 500, fontSize: 16, minWidth: 120 }} onClick={handleCancelJob}>
            Cancel
          </button>
        ) : (
          <button className="process-button" onClick={handleProcessVideo} disabled={!isReadyToProcess}>
            Process Video
          </button>
        )}
      </div>
    </div>
  );
};

export default VideoProcessing;
