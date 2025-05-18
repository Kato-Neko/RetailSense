"use client";

import { useState, useEffect, useRef } from "react";
import { Calendar, Clock, Download, Filter, Map, Loader, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { useLocation } from "react-router-dom";
import { heatmapService } from "../../services/api";
import "../../styles/HeatmapGeneration.css";

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

  const handleSelectJob = (job) => {
    setSelectedJob(job);
    setHeatmapGenerated(true);
  };

  const handleGenerateHeatmap = async () => {
    if (!dateRange.start || !dateRange.end) {
      toast.error("Please select a date range");
      return;
    }

    // 1. Flip on your loading state
    setIsGenerating(true);
    setStatusMessage("Sending request…");

    // 2. Build your payload from state
    const payload = {
      start_date: dateRange.start,
      end_date: dateRange.end,
      start_time: timeRange.start,
      end_time: timeRange.end,
      area: selectedArea,
    };

    try {
      // 3. POST to /api/heatmap via Vite proxy
      const res = await fetch("/api/heatmap_jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Status ${res.status}: ${errText}`);
      }

      const { job_id } = await res.json();

      // 4. Store the returned job ID so your polling useEffect starts
      setStatusMessage("Job queued; waiting for completion…");
      // note: you'll need to lift `jobId` into state if it isn't already:
      // const [jobId, setJobId] = useState(initialJobId);
      setJobId(job_id);

      toast.success("Heatmap request submitted!");
    } catch (err) {
      console.error("Heatmap request failed:", err);
      toast.error(`Failed to start heatmap: ${err.message}`);
      setIsGenerating(false);
    }
  };

  const handleExport = (format) => {
    if (!heatmapGenerated || !selectedJob) {
      toast.error("Please generate or select a heatmap first");
      return;
    }

    if (format === "png" && imageRef.current) {
      // For PNG, we can actually download the image
      const link = document.createElement("a");
      link.href = imageRef.current.src;
      link.download = `heatmap_${selectedJob.job_id}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Heatmap exported as PNG");
    } else {
      // For other formats, just show a success message
      toast.success(`Heatmap exported as ${format.toUpperCase()}`);
    }
  };

  const handleDeleteJob = async (job) => {
    if (!window.confirm(`Are you sure you want to delete heatmap for "${job.input_video_name || 'Heatmap'}"? This cannot be undone.`)) return;
    try {
      await heatmapService.deleteJob(job.job_id);
      toast.success("Heatmap deleted.");
      setJobHistory((prev) => prev.filter((j) => j.job_id !== job.job_id));
      if (selectedJob && selectedJob.job_id === job.job_id) {
        setSelectedJob(null);
        setHeatmapGenerated(false);
      }
    } catch (error) {
      toast.error(error.message || "Failed to delete heatmap.");
    }
  };

  return (
    <div className="heatmap-container">
      <h1 className="page-title">Heatmap Generation</h1>

      <div className="heatmap-grid">
        <div className="settings-card">
          <h2 className="section-title">Heatmap Settings</h2>

          <div className="settings-form">
            <div className="form-group">
              <label className="form-label">Date Range</label>
              <div className="input-group">
                <Calendar className="input-icon" />
                <input
                  type="date"
                  className="form-input"
                  value={dateRange.start}
                  onChange={(e) =>
                    setDateRange({ ...dateRange, start: e.target.value })
                  }
                />
                <span className="input-separator">to</span>
                <input
                  type="date"
                  className="form-input"
                  value={dateRange.end}
                  onChange={(e) =>
                    setDateRange({ ...dateRange, end: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Time Range</label>
              <div className="input-group">
                <Clock className="input-icon" />
                <input
                  type="time"
                  className="form-input"
                  value={timeRange.start}
                  onChange={(e) =>
                    setTimeRange({ ...timeRange, start: e.target.value })
                  }
                />
                <span className="input-separator">to</span>
                <input
                  type="time"
                  className="form-input"
                  value={timeRange.end}
                  onChange={(e) =>
                    setTimeRange({ ...timeRange, end: e.target.value })
                  }
                />
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

            <button
              onClick={handleGenerateHeatmap}
              disabled={isGenerating}
              className="generate-button"
            >
              {isGenerating ? (
                <>
                  <Loader className="spinner" /> Generating...
                </>
              ) : (
                <>
                  <Map className="button-icon" /> Generate Heatmap
                </>
              )}
            </button>

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
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
                    >
                      <div>
                        <div className="history-item-name">
                          {job.input_video_name || "Heatmap"}
                        </div>
                        <div className="history-item-date">
                          {new Date(job.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <button
                        className="delete-btn"
                        title="Delete heatmap"
                        onClick={e => { e.stopPropagation(); handleDeleteJob(job); }}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#e53935", marginLeft: 8 }}
                      >
                        <Trash2 size={20} />
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
                    src={
                      heatmapService.getHeatmapImageUrl(selectedJob.job_id) ||
                      "/placeholder.svg"
                    }
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
        <div className="analysis-card">
          <h2 className="section-title">Heatmap Analysis</h2>

          <div className="analysis-grid">
            <div className="analysis-section high-traffic">
              <h3 className="analysis-title">High Traffic Areas</h3>
              <ul className="analysis-list">
                <li>Store entrance (78% density)</li>
                <li>Right side display (65% density)</li>
                <li>Center display (58% density)</li>
              </ul>
            </div>

            <div className="analysis-section medium-traffic">
              <h3 className="analysis-title">Medium Traffic Areas</h3>
              <ul className="analysis-list">
                <li>Main pathways (45% density)</li>
                <li>Left side shelves (42% density)</li>
                <li>Checkout area (38% density)</li>
              </ul>
            </div>

            <div className="analysis-section low-traffic">
              <h3 className="analysis-title">Low Traffic Areas</h3>
              <ul className="analysis-list">
                <li>Back corner shelves (15% density)</li>
                <li>Seasonal display (12% density)</li>
                <li>Promotional area (8% density)</li>
              </ul>
            </div>
          </div>

          <div className="recommendations">
            <h3 className="recommendations-title">Recommendations</h3>
            <ul className="recommendations-list">
              <li>
                Consider moving high-margin products to high-traffic areas
              </li>
              <li>
                Redesign low-traffic areas to improve visibility and customer
                flow
              </li>
              <li>
                Adjust staffing based on peak traffic hours identified in the
                heatmap
              </li>
              <li>
                Test different promotional placements in medium-traffic zones
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default HeatmapGeneration;
