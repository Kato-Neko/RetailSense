import React, { useEffect, useRef } from "react";
import { runYoloOnFrame } from "../../utils/yolo_onnx";
import { runSortOnDetections } from "../../utils/sort";
import API_BASE_URL from "../../config";

const FRAME_SKIP = 2; // Process every 2nd frame for performance

// This is a stub. Actual YOLO/SORT logic will be added next.
const DetectionOverlay = ({ videoRef, canvasRef, detectionResults, setDetectionResults, isProcessing, jobId, useStubDetection }) => {
  const overlayCanvasRef = useRef(null);
  const animationRef = useRef(null);
  const frameCountRef = useRef(0);

  useEffect(() => {
    if (!isProcessing || !videoRef || !canvasRef) return;
    let stopped = false;

    const processFrame = async () => {
      if (!videoRef || !canvasRef || !videoRef.current || !canvasRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const overlayCanvas = overlayCanvasRef.current;
      if (!video || !canvas || !overlayCanvas) return;

      frameCountRef.current++;
      if (frameCountRef.current % FRAME_SKIP !== 0) {
        if (!stopped) animationRef.current = requestAnimationFrame(processFrame);
        return;
      }

      // Draw current video frame to hidden canvas
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      let tracks = [];
      if (useStubDetection) {
        // Always draw a fake detection box for testing
        tracks = [{ id: 1, x1: canvas.width * 0.3, y1: canvas.height * 0.3, x2: canvas.width * 0.6, y2: canvas.height * 0.7 }];
      } else {
        // Run YOLO detection (ONNX.js)
        const detections = await runYoloOnFrame(imageData);
        // Run SORT tracking
        tracks = runSortOnDetections(detections);
      }
      setDetectionResults(tracks);

      // Send detection data to backend for heatmap (optional, stub)
      if (jobId && tracks.length > 0) {
        fetch(`${API_BASE_URL}/heatmap_jobs/${jobId}/detections`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ detections: tracks }),
        }).catch(() => {}); // Ignore errors for now
      }

      // Draw overlays
      overlayCanvas.width = video.videoWidth;
      overlayCanvas.height = video.videoHeight;
      const octx = overlayCanvas.getContext("2d");
      octx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
      tracks.forEach(track => {
        // Draw bounding box
        octx.strokeStyle = "#00FF00";
        octx.lineWidth = 2;
        octx.strokeRect(track.x1, track.y1, track.x2 - track.x1, track.y2 - track.y1);
        // Draw ID label
        octx.font = "16px monospace";
        octx.fillStyle = "black";
        octx.fillRect(track.x1, track.y1 - 22, 60, 20);
        octx.fillStyle = "#00FF00";
        octx.fillText(`ID: ${track.id}`, track.x1 + 4, track.y1 - 7);
      });

      if (!stopped) {
        animationRef.current = requestAnimationFrame(processFrame);
      }
    };

    animationRef.current = requestAnimationFrame(processFrame);
    return () => {
      stopped = true;
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isProcessing, videoRef, canvasRef, setDetectionResults, jobId, useStubDetection]);

  // Overlay canvas for drawing boxes/IDs
  return (
    <canvas
      ref={overlayCanvasRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 10,
      }}
    />
  );
};

export default DetectionOverlay; 