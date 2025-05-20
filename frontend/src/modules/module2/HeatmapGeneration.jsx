"use client";

import { useState, useEffect, useRef } from "react";
import { Calendar, Clock, Download, Filter, Map, Loader, Trash2, Users, BarChart2, Lightbulb, Timer } from "lucide-react";
import toast from "react-hot-toast";
import { useLocation } from "react-router-dom";
import { heatmapService } from "../../services/api";
import "../../styles/HeatmapGeneration.css";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line, Legend } from 'recharts';

const HeatmapGeneration = () => {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const initialJobId = queryParams.get("jobId");

  const [isGenerating, setIsGenerating] = useState(false);
  const [heatmapGenerated, setHeatmapGenerated] = useState(false);
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [timeRange, setTimeRange] = useState({ start: "09:00", end: "21:00" });
  const [selectedArea, setSelectedArea] = useState("all");
  const [jobId, setJobId] = useState(initialJobId);
  const [jobHistory, setJobHistory] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const imageRef = useRef(null);
  const [analysis, setAnalysis] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState(null);
  const [startTimestamp, setStartTimestamp] = useState('');
  const [endTimestamp, setEndTimestamp] = useState('');
  const [videoDuration, setVideoDuration] = useState(null);
  const [warning, setWarning] = useState('');
  const videoRef = useRef(null);
  const [customHeatmapUrl, setCustomHeatmapUrl] = useState(null);
  const [customProgress, setCustomProgress] = useState(0);
  const [customJobId, setCustomJobId] = useState(null);

  // Initialize date range to today and yesterday
  useEffect(() => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    setDateRange({
      start: yesterday.toISOString().split("T")[0],
      end: today.toISOString().split("T")[0],
    });
  }, []);

  // Fetch job history on component mount
  useEffect(() => {
    const fetchJobHistory = async () => {
      try {
        const history = await heatmapService.getJobHistory();
        setJobHistory(history.filter((job) => job.status === "completed"));

        // If we have an initial jobId from URL params, select it
        if (initialJobId) {
          const job = history.find((j) => j.job_id === initialJobId);
          if (job) {
            setSelectedJob(job);
            setHeatmapGenerated(true);
          }
        }
      } catch (error) {
        console.error("Error fetching job history:", error);
        toast.error("Failed to load heatmap history");
      }
    };

    fetchJobHistory();
  }, [initialJobId]);

  // Poll for job status if we have a jobId and are generating
  useEffect(() => {
    let intervalId;

    if (jobId && isGenerating) {
      intervalId = setInterval(async () => {
        try {
          const response = await heatmapService.getJobStatus(jobId);
          setStatusMessage(response.message || "Generating heatmap...");

          // Check if processing is complete
          if (response.status === "completed") {
            setIsGenerating(false);
            setHeatmapGenerated(true);

            // Fetch the job details to update selectedJob
            const history = await heatmapService.getJobHistory();
            const job = history.find((j) => j.job_id === jobId);
            if (job) {
              setSelectedJob(job);
              setJobHistory(
                history.filter((job) => job.status === "completed")
              );
            }

            clearInterval(intervalId);
            toast.success("Heatmap generated successfully");
          } else if (response.status === "error") {
            setIsGenerating(false);
            clearInterval(intervalId);
            toast.error(`Generation failed: ${response.message}`);
          }
        } catch (error) {
          console.error("Error checking job status:", error);
          // Don't stop polling on network errors, they might be temporary
        }
      }, 2000); // Poll every 2 seconds
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [jobId, isGenerating]);

  // When a job is selected, load the processed video to get its duration
  useEffect(() => {
    if (selectedJob && selectedJob.job_id) {
      const videoUrl = heatmapService.getProcessedVideoUrl(selectedJob.job_id);
      const video = document.createElement('video');
      video.src = videoUrl;
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        setVideoDuration(video.duration);
      };
    }
  }, [selectedJob]);

  const handleSelectJob = (job) => {
    setSelectedJob(job);
    setHeatmapGenerated(true);
  };

  const handleGenerateHeatmap = async () => {
    if (!selectedJob) {
      setWarning('Please select a job first.');
      return;
    }
    if (!startTimestamp || !endTimestamp) {
      setWarning('Please enter both start and end time.');
      return;
    }
    if (videoDuration && Number(endTimestamp) > videoDuration) {
      setWarning('End time cannot be greater than video duration.');
      return;
    }
    setWarning('');
    setCustomJobId(selectedJob.job_id);
    setCustomProgress(0);
    setIsGenerating(true);
    setStatusMessage('Sending request…');
    const payload = {
      start_time: startTimestamp,
      end_time: endTimestamp,
      area: selectedArea,
    };
    try {
      const response = await heatmapService.generateCustomHeatmap(selectedJob.job_id, payload);
      setStatusMessage('Custom heatmap generated!');
      setHeatmapGenerated(true);
      setCustomHeatmapUrl(heatmapService.getCustomHeatmapImageUrl(selectedJob.job_id, startTimestamp, endTimestamp));
      toast.success('Custom heatmap generated!');
    } catch (err) {
      console.error('Custom heatmap request failed:', err);
      toast.error(`Failed to generate custom heatmap: ${err.message}`);
      setIsGenerating(false);
    }
  };

  const handleExport = async (format) => {
    if (!heatmapGenerated || !selectedJob) {
      toast.error("Please generate or select a heatmap first");
      return;
    }

    try {
      let blob;
      let filename;
      let mimeType;

      switch (format) {
        case "png":
          if (imageRef.current) {
            // For PNG, we can use the image source directly
            const link = document.createElement("a");
            link.href = imageRef.current.src;
            link.download = `heatmap_${selectedJob.job_id}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success("Heatmap exported as PNG");
          }
          break;

        case "csv":
          mimeType = 'text/csv';
          filename = `heatmap_${selectedJob.job_id}.csv`;
          blob = await heatmapService.exportHeatmapCsv(selectedJob.job_id);
          break;

        case "pdf":
          mimeType = 'application/pdf';
          filename = `heatmap_${selectedJob.job_id}.pdf`;
          blob = await heatmapService.exportHeatmapPdf(selectedJob.job_id);
          break;

        default:
          toast.error("Unsupported export format");
          return;
      }

      // For CSV and PDF, create and trigger download
      if (format !== "png") {
        // Create a blob with the correct MIME type
        const fileBlob = new Blob([blob], { type: mimeType });
        
        // Create a temporary URL for the blob
        const url = window.URL.createObjectURL(fileBlob);
        
        // Create a temporary link element
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        
        // Append to body, click, and cleanup
        document.body.appendChild(link);
        link.click();
        
        // Cleanup
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        toast.success(`Heatmap exported as ${format.toUpperCase()}`);
      }
    } catch (error) {
      console.error(`Error exporting heatmap as ${format}:`, error);
      toast.error(`Failed to export heatmap as ${format.toUpperCase()}`);
    }
  };

  const fetchAnalysis = async (jobId) => {
    setAnalysisLoading(true);
    setAnalysisError(null);
    try {
      const data = await heatmapService.getHeatmapAnalysis(jobId);
      setAnalysis(data);
    } catch (err) {
      setAnalysisError(err.error || "Failed to fetch analysis");
      setAnalysis(null);
    } finally {
      setAnalysisLoading(false);
    }
  };

  useEffect(() => {
    if (selectedJob && selectedJob.job_id && selectedJob.status === "completed") {
      fetchAnalysis(selectedJob.job_id);
    } else {
      setAnalysis(null);
    }
  }, [selectedJob]);

  useEffect(() => {
    if (!customJobId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/heatmap_jobs/${customJobId}/custom_heatmap_progress`);
        const data = await res.json();
        setCustomProgress(data.progress);
        if (data.progress >= 1) {
          clearInterval(interval);
          setIsGenerating(false);
        }
      } catch (e) {
        // Optionally handle error
      }
    }, 500);
    return () => clearInterval(interval);
  }, [customJobId]);

  const handleDeleteJob = async (jobId) => {
    if (!window.confirm("Are you sure you want to delete this heatmap?")) return;
    try {
      await heatmapService.deleteJob(jobId);
      setJobHistory((prev) => prev.filter((job) => job.job_id !== jobId));
      if (selectedJob && selectedJob.job_id === jobId) {
        setSelectedJob(null);
        setHeatmapGenerated(false);
        setCustomHeatmapUrl(null);
      }
      toast.success("Heatmap deleted!");
    } catch (err) {
      toast.error("Failed to delete heatmap.");
    }
  };

  // Prepare data for the Peak Hours line chart
  const peakHoursData = analysis?.peak_hours?.map(ph => ({
    x: `${ph.start_minute}-${ph.end_minute}`,
    y: ph.count,
  })) || [];

  return (
    <div className="heatmap-container">
      <h1 className="page-title">Heatmap Generation</h1>

      <div className="heatmap-grid">
        <div className="settings-card">
          <h2 className="section-title">Heatmap Settings</h2>

          <div className="settings-form">
            <div className="form-group">
              <label className="form-label">Time Range (seconds)</label>
              <div className="input-group">
                <input
                  type="number"
                  className="form-input"
                  placeholder="Start (s)"
                  value={startTimestamp}
                  min={0}
                  max={videoDuration || undefined}
                  onChange={e => setStartTimestamp(e.target.value)}
                />
                <span className="input-separator">to</span>
                <input
                  type="number"
                  className="form-input"
                  placeholder="End (s)"
                  value={endTimestamp}
                  min={0}
                  max={videoDuration || undefined}
                  onChange={e => setEndTimestamp(e.target.value)}
                />
                {videoDuration && (
                  <span className="input-hint">(Video duration: {Math.floor(videoDuration)}s)</span>
                )}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Store Area</label>
              <div className="input-group">
                <Filter className="input-icon" />
                <select
                  className="form-select"
                  value={selectedArea}
                  onChange={(e) => setSelectedArea(e.target.value)}
                >
                  <option value="all">All Areas</option>
                  <option value="entrance">Entrance</option>
                  <option value="checkout">Checkout</option>
                  <option value="aisles">Product Aisles</option>
                  <option value="displays">Center Displays</option>
                </select>
              </div>
            </div>

            {warning && (
              <div className="warning-card">
                <span className="warning-title">⚠️ Warning</span>
                <div className="warning-message">{warning}</div>
              </div>
            )}

            {isGenerating ? (
              <div className="generate-progress-bar">
                <div
                  className="generate-progress-fill"
                  style={{ width: `${Math.round(customProgress * 100)}%` }}
                />
                <span className="generate-progress-label">
                  Generating... {Math.round(customProgress * 100)}%
                </span>
              </div>
            ) : (
              <button
                onClick={handleGenerateHeatmap}
                className="generate-button"
              >
                <Map className="button-icon" /> Generate Heatmap
              </button>
            )}

            {isGenerating && statusMessage && (
              <div className="status-message">{statusMessage}</div>
            )}

            {jobHistory.length > 0 && (
              <div className="job-history">
                <h3 className="history-title">Previous Heatmaps</h3>
                <div className="history-list">
                  {jobHistory.map((job) => (
                    <div
                      key={job.job_id}
                      className={`history-item ${
                        selectedJob && selectedJob.job_id === job.job_id
                          ? "selected"
                          : ""
                      }`}
                      onClick={() => handleSelectJob(job)}
                    >
                      <div className="history-item-name">
                        {job.input_video_name || "Heatmap"}
                      </div>
                      <div className="history-item-date">
                        {new Date(job.created_at).toLocaleDateString()}
                      </div>
                      <button
                        className="delete-heatmap-btn"
                        onClick={e => {
                          e.stopPropagation();
                          handleDeleteJob(job.job_id);
                        }}
                        title="Delete heatmap"
                        style={{ background: "none", border: "none", cursor: "pointer", marginLeft: 8 }}
                      >
                        <Trash2 size={18} color="#d32f2f" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {heatmapGenerated && selectedJob && (
              <div className="export-buttons">
                <button
                  onClick={() => handleExport("csv")}
                  className="export-button"
                >
                  <Download className="export-icon" /> CSV
                </button>
                <button
                  onClick={() => handleExport("pdf")}
                  className="export-button"
                >
                  <Download className="export-icon" /> PDF
                </button>
                <button
                  onClick={() => handleExport("png")}
                  className="export-button"
                >
                  <Download className="export-icon" /> PNG
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="visualization-card">
          <h2 className="section-title">Heatmap Visualization</h2>

          {!heatmapGenerated || !selectedJob ? (
            <div className="empty-heatmap">
              <Map className="empty-icon" />
              <p className="empty-text">
                {jobHistory.length > 0
                  ? "Select a previous heatmap or generate a new one"
                  : "Configure settings and generate a heatmap to visualize foot traffic"}
              </p>
            </div>
          ) : (
            <div className="heatmap-visualization">
              {isLoading ? (
                <div className="loading-heatmap">
                  <Loader className="spinner" />
                  <p>Loading heatmap...</p>
                </div>
              ) : (
                <>
                  <img
                    ref={imageRef}
                    src={customHeatmapUrl || heatmapService.getHeatmapImageUrl(selectedJob.job_id) || "/placeholder.svg"}
                    alt="Foot traffic heatmap"
                    className="heatmap-image"
                    onLoad={() => setIsLoading(false)}
                    onError={() => {
                      setIsLoading(false);
                      toast.error("Failed to load heatmap image");
                    }}
                  />
                  <div className="heatmap-legend">
                    <div className="legend-labels">
                      <span className="legend-title">Traffic Density:</span>
                      <div className="legend-gradient"></div>
                    </div>
                    <div className="legend-values">
                      <span className="legend-value">Low</span>
                      <span className="legend-value">Medium</span>
                      <span className="legend-value">High</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {heatmapGenerated && selectedJob && (
        <div className="analysis-grid">
          {/* Total Visitors Card */}
          <div className="analysis-card">
            <div className="analysis-header">
              <Users className="analysis-icon" />
              <h3 className="analysis-title">Total Visitors</h3>
            </div>
            {analysisLoading ? (
              <p className="analysis-loading">Loading...</p>
            ) : (
              <p className="total-visitors">{analysis?.total_visitors ?? 0}</p>
            )}
          </div>

          {/* Traffic Distribution Card */}
          <div className="analysis-card">
            <div className="analysis-header">
              <BarChart2 className="analysis-icon" />
              <h3 className="analysis-title">Traffic Distribution</h3>
            </div>
            {analysis && (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart
                  data={[
                    { name: 'High', value: analysis.areas?.high?.percentage ?? 0 },
                    { name: 'Medium', value: analysis.areas?.medium?.percentage ?? 0 },
                    { name: 'Low', value: analysis.areas?.low?.percentage ?? 0 }
                  ]}
                  margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis unit="%" />
                  <Tooltip />
                  <Bar dataKey="value" fill="#1976d2" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Recommendations Card */}
          <div className="analysis-card">
            <div className="analysis-header">
              <Lightbulb className="analysis-icon" />
              <h3 className="analysis-title">Recommendations</h3>
            </div>
            <ul className="analysis-list">
              {analysis?.recommendations?.length > 0 ? (
                analysis.recommendations.map((rec, idx) => (
                  <li key={idx} className="recommendation">{rec}</li>
                ))
              ) : (
                <li className="muted">No recommendations available.</li>
              )}
            </ul>
          </div>

          {/* Peak Hours Card */}
          <div className="analysis-card">
            <div className="analysis-header">
              <Timer className="analysis-icon" />
              <h3 className="analysis-title">Peak Hours</h3>
            </div>
            {peakHoursData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={peakHoursData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="x" label={{ value: 'Minute Range', position: 'insideBottomRight', offset: 0 }} />
                  <YAxis label={{ value: 'Detections', angle: -90, position: 'insideLeft' }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="y" stroke="#1976d2" dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="muted">No peak hours detected.</p>
            )}
          </div>
        </div>
      )}

      {/* Hidden video element for duration calculation */}
      {selectedJob && (
        <video
          ref={videoRef}
          src={heatmapService.getProcessedVideoUrl(selectedJob.job_id)}
          style={{ display: 'none' }}
          onLoadedMetadata={e => setVideoDuration(e.target.duration)}
        />
      )}
    </div>
  );
};

export default HeatmapGeneration;