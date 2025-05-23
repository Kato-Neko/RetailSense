"use client";

import { useState, useEffect, useRef, useContext } from "react";
import { Map, Loader, Trash2, Users, BarChart2, Lightbulb, Timer, Filter, Download, Calendar } from "lucide-react";
import toast from "react-hot-toast";
import { useLocation } from "react-router-dom";
import { heatmapService } from "../../services/api";
import { BarChart as ReBarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
//import { Select } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { HeatmapContext } from "./HeatmapContext";
import HeatmapHistoryPanel from "./HeatmapHistoryPanel";

const HeatmapGeneration = () => {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const initialJobId = queryParams.get("jobId");

  const [isGenerating, setIsGenerating] = useState(false);
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [timeRange, setTimeRange] = useState({ start: "09:00", end: "21:00" });
  const [jobId, setJobId] = useState(initialJobId);
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
  const [customProgress, setCustomProgress] = useState(0);
  const [customJobId, setCustomJobId] = useState(null);
  const [videoDateRange, setVideoDateRange] = useState({ start: null, end: null });
  const [isMultiDay, setIsMultiDay] = useState(false);

  const {
    jobHistory,
    selectedJob,
    heatmapGenerated,
    heatmapUrl,
    isExportRangeValid,
    isLoading,
    setIsLoading,
    handleExport,
    customDateRange,
    setCustomDateRange,
    customTimeRange,
    setCustomTimeRange,
    selectedArea,
    setSelectedArea,
    isCustomDateTimeValid,
    isCustomGenerating,
    customStatusMessage,
    customProgressPercent,
    customBackendError,
    customGenerationComplete,
    customHeatmapUrl,
    handleCustomExport,
    handleGenerateCustomHeatmap,
    handleCancelCustomJob,
    handleSelectJob,
    handleDeleteJob,
    isHistoryLoading
  } = useContext(HeatmapContext);

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

  // When a job is selected, load the processed video to get its duration and date range
  useEffect(() => {
    if (selectedJob && selectedJob.job_id) {
      const videoUrl = heatmapService.getProcessedVideoUrl(selectedJob.job_id);
      const video = document.createElement('video');
      video.src = videoUrl;
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        setVideoDuration(video.duration);
      };

      // Set video date range from job data
      if (selectedJob.start_datetime && selectedJob.end_datetime) {
        const startDate = new Date(selectedJob.start_datetime);
        const endDate = new Date(selectedJob.end_datetime);
        setVideoDateRange({ start: startDate, end: endDate });
        
        // Check if video spans multiple days
        const isMultiDayVideo = startDate.toDateString() !== endDate.toDateString();
        setIsMultiDay(isMultiDayVideo);

        // Set default time range from video metadata with seconds
        const startTime = startDate.toTimeString().slice(0, 8);
        const endTime = endDate.toTimeString().slice(0, 8);
        setTimeRange({ start: startTime, end: endTime });

        // Set default date range
        setDateRange({
          start: startDate.getFullYear() + '-' +
                 String(startDate.getMonth() + 1).padStart(2, '0') + '-' +
                 String(startDate.getDate()).padStart(2, '0'),
          end: endDate.getFullYear() + '-' +
               String(endDate.getMonth() + 1).padStart(2, '0') + '-' +
               String(endDate.getDate()).padStart(2, '0')
        });
      }
    }
  }, [selectedJob]);

  const handleGenerateHeatmap = async () => {
    if (!selectedJob) {
      toast.error("Please select a job first.", {
        position: "top-right",
        style: {
          background: '#1a1a1a',
          color: '#fff',
          border: '1px solid #333',
          borderRadius: '8px',
          padding: '16px'
        }
      });
      return;
    }

    const startDate = new Date(`${dateRange.start}T${timeRange.start}`);
    const endDate = new Date(`${dateRange.end}T${timeRange.end}`);
    const videoStart = new Date(selectedJob.start_datetime);
    const videoEnd = new Date(selectedJob.end_datetime);

    if (startDate < videoStart || endDate > videoEnd) {
      toast.error("Selected date/time range is outside video recording period.", {
        position: "top-right",
        style: {
          background: '#1a1a1a',
          color: '#fff',
          border: '1px solid #333',
          borderRadius: '8px',
          padding: '16px'
        }
      });
      return;
    }

    setWarning('');
    setCustomJobId(selectedJob.job_id);
    setCustomProgress(0);
    setIsGenerating(true);
    setStatusMessage('Generating heatmap...');

    // Convert datetime to seconds from video start
    const startTimeInSeconds = (startDate - videoStart) / 1000;
    const endTimeInSeconds = (endDate - videoStart) / 1000;

    const payload = {
      start_time: startTimeInSeconds,
      end_time: endTimeInSeconds,
      area: selectedArea,
    };

    try {
      const response = await heatmapService.generateCustomHeatmap(selectedJob.job_id, payload);
      setStatusMessage('Custom heatmap generated!');
      setHeatmapGenerated(true);
      setCustomHeatmapUrl(heatmapService.getCustomHeatmapImageUrl(selectedJob.job_id, startTimeInSeconds, endTimeInSeconds));
      toast.success('Heatmap generated successfully!', {
        position: "top-right",
        style: {
          background: '#1a1a1a',
          color: '#fff',
          border: '1px solid #333',
          borderRadius: '8px',
          padding: '16px'
        }
      });
    } catch (err) {
      console.error('Custom heatmap request failed:', err);
      toast.error(`Failed to generate heatmap: ${err.message}`, {
        position: "top-right",
        style: {
          background: '#1a1a1a',
          color: '#fff',
          border: '1px solid #333',
          borderRadius: '8px',
          padding: '16px'
        }
      });
      setIsGenerating(false);
      setStatusMessage('');
    }
  };

  const fetchAnalysis = async (jobId) => {
    setAnalysisLoading(true);
    setAnalysisError(null);
    try {
      let data;
      if (customHeatmapUrl) {
        // Calculate time in seconds for custom heatmap
        const videoStart = new Date(selectedJob.start_datetime);
        const startDate = new Date(`${dateRange.start}T${timeRange.start}`);
        const endDate = new Date(`${dateRange.end}T${timeRange.end}`);
        const startTimeInSeconds = (startDate - videoStart) / 1000;
        const endTimeInSeconds = (endDate - videoStart) / 1000;

        data = await heatmapService.getCustomHeatmapAnalysis(jobId, {
          start_time: startTimeInSeconds,
          end_time: endTimeInSeconds,
          area: selectedArea
        });
      } else {
        data = await heatmapService.getHeatmapAnalysis(jobId);
      }
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
  }, [selectedJob, customHeatmapUrl, dateRange, timeRange, selectedArea]);

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

  // Prepare data for the Peak Hours line chart
  const peakHoursData = analysis?.peak_hours?.map(ph => ({
    x: `${ph.start_minute}-${ph.end_minute}`,
    y: ph.count,
  })) || [];

  return (
    <div className="relative min-h-screen w-full bg-background dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 py-8 px-1 md:px-0 overflow-x-hidden">
      {/* Soft background blur and gradient effects */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-32 -left-32 w-80 h-80 bg-blue-400/20 dark:bg-blue-700/20 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 right-0 w-64 h-64 bg-cyan-300/20 dark:bg-cyan-500/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-1/2 w-80 h-80 bg-fuchsia-300/10 dark:bg-fuchsia-700/10 rounded-full blur-3xl"></div>
      </div>
      <div className="container relative z-10 mx-auto max-w-7xl px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Settings Card */}
          <Card className="col-span-1 bg-gradient-to-br from-background/80 to-muted/90 dark:from-slate-900/80 dark:to-slate-950/90 border border-border shadow-xl shadow-primary/10 backdrop-blur-xl rounded-xl">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-foreground tracking-tight drop-shadow mb-2">Heatmap Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="text-muted-foreground mb-1 block">Date Range</Label>
                <div className="flex gap-2 items-center">
                  <div className="relative w-full">
                    <Input
                      type="date"
                      value={dateRange.start}
                      min={videoDateRange.start?.toISOString().split('T')[0]}
                      max={videoDateRange.end?.toISOString().split('T')[0]}
                      onChange={e => {
                        const newDate = e.target.value;
                        const minDate = videoDateRange.start?.toISOString().split('T')[0];
                        if (minDate && newDate < minDate) {
                          toast.error('Start date cannot be before video start.', {
                            position: 'top-right',
                            style: {
                              background: '#1a1a1a',
                              color: '#fff',
                              border: '1px solid #333',
                              borderRadius: '8px',
                              padding: '16px'
                            }
                          });
                          setDateRange(prev => ({ ...prev, start: minDate }));
                        } else {
                          setDateRange(prev => ({ ...prev, start: newDate }));
                        }
                      }}
                      className="w-full pr-8 [&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-2 [&::-webkit-calendar-picker-indicator]:top-1/2 [&::-webkit-calendar-picker-indicator]:-translate-y-1/2 bg-muted text-foreground border border-border"
                      disabled={!isMultiDay}
                    />
                    <Calendar className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  </div>
                  <span className="text-muted-foreground">to</span>
                  <div className="relative w-full">
                    <Input
                      type="date"
                      value={dateRange.end}
                      min={videoDateRange.start?.toISOString().split('T')[0]}
                      max={videoDateRange.end?.toISOString().split('T')[0]}
                      onChange={e => {
                        const newDate = e.target.value;
                        const maxDate = videoDateRange.end?.toISOString().split('T')[0];
                        if (maxDate && newDate > maxDate) {
                          toast.error('End date cannot be after video end.', {
                            position: 'top-right',
                            style: {
                              background: '#1a1a1a',
                              color: '#fff',
                              border: '1px solid #333',
                              borderRadius: '8px',
                              padding: '16px'
                            }
                          });
                          setDateRange(prev => ({ ...prev, end: maxDate }));
                        } else {
                          setDateRange(prev => ({ ...prev, end: newDate }));
                        }
                      }}
                      className="w-full pr-8 [&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-2 [&::-webkit-calendar-picker-indicator]:top-1/2 [&::-webkit-calendar-picker-indicator]:-translate-y-1/2 bg-muted text-foreground border border-border"
                      disabled={!isMultiDay}
                    />
                    <Calendar className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground mb-1 block">Time Range</Label>
                <div className="flex gap-2 items-center">
                  <div className="relative w-full">
                    <Input
                      type="time"
                      value={timeRange.start}
                      min={videoDateRange.start?.toTimeString().slice(0, 8)}
                      max={videoDateRange.end?.toTimeString().slice(0, 8)}
                      onChange={e => {
                        const newTime = e.target.value;
                        const minTime = videoDateRange.start?.toTimeString().slice(0, 8);
                        if (minTime && newTime < minTime && dateRange.start === videoDateRange.start?.toISOString().split('T')[0]) {
                          toast.error('Start time cannot be before video start.', {
                            position: 'top-right',
                            style: {
                              background: '#1a1a1a',
                              color: '#fff',
                              border: '1px solid #333',
                              borderRadius: '8px',
                              padding: '16px'
                            }
                          });
                          setTimeRange(prev => ({ ...prev, start: minTime }));
                        } else {
                          setTimeRange(prev => ({ ...prev, start: newTime }));
                        }
                      }}
                      className="w-full pr-12 [&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-2 [&::-webkit-calendar-picker-indicator]:top-1/2 [&::-webkit-calendar-picker-indicator]:-translate-y-1/2 bg-muted text-foreground border border-border"
                      step="1"
                    />
                  </div>
                  <span className="text-muted-foreground">to</span>
                  <div className="relative w-full">
                    <Input
                      type="time"
                      value={timeRange.end}
                      min={videoDateRange.start?.toTimeString().slice(0, 8)}
                      max={videoDateRange.end?.toTimeString().slice(0, 8)}
                      onChange={e => {
                        const newTime = e.target.value;
                        const maxTime = videoDateRange.end?.toTimeString().slice(0, 8);
                        if (maxTime && newTime > maxTime && dateRange.end === videoDateRange.end?.toISOString().split('T')[0]) {
                          toast.error('End time cannot be after video end.', {
                            position: 'top-right',
                            style: {
                              background: '#1a1a1a',
                              color: '#fff',
                              border: '1px solid #333',
                              borderRadius: '8px',
                              padding: '16px'
                            }
                          });
                          setTimeRange(prev => ({ ...prev, end: maxTime }));
                        } else {
                          setTimeRange(prev => ({ ...prev, end: newTime }));
                        }
                      }}
                      className="w-full pr-12 [&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-2 [&::-webkit-calendar-picker-indicator]:top-1/2 [&::-webkit-calendar-picker-indicator]:-translate-y-1/2 bg-muted text-foreground border border-border"
                      step="1"
                    />
                  </div>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground mb-1 block">Store Area</Label>
                <div className="flex gap-2 items-center">
                  <Filter className="text-muted-foreground" />
                  <select
                    className="w-full bg-muted text-foreground rounded-md border border-border px-3 py-2"
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
                <div className="rounded-md bg-yellow-100/80 border border-yellow-300 text-yellow-900 px-4 py-2 flex flex-col dark:bg-yellow-900/30 dark:border-yellow-600 dark:text-yellow-100">
                  <span className="font-semibold mb-1">⚠️ Warning</span>
                  <span>{warning}</span>
                </div>
              )}
              {statusMessage && (
                <div className="rounded-md bg-blue-100/80 border border-blue-300 text-blue-900 px-4 py-2 flex flex-col dark:bg-blue-900/30 dark:border-blue-600 dark:text-blue-100">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Status</span>
                    <button onClick={() => setStatusMessage('')} className="text-blue-900 dark:text-blue-100 hover:text-blue-700 dark:hover:text-blue-300">✕</button>
                  </div>
                  <span>{statusMessage}</span>
                </div>
              )}
              {isGenerating ? (
                <div className="w-full">
                  <Progress value={Math.round(customProgress * 100)} className="h-4" />
                  <div className="text-center text-sm text-muted-foreground mt-2">
                    Generating... {Math.round(customProgress * 100)}%
                  </div>
                </div>
              ) : (
                <Button
                  onClick={handleGenerateHeatmap}
                  className="w-full bg-gradient-to-r from-white to-cyan-200 text-black font-semibold shadow-md border border-border py-2 text-sm hover:opacity-90 dark:from-blue-900 dark:to-cyan-800 dark:text-white"
                  disabled={isGenerating && !customHeatmapUrl}
                >
                  <Map className="mr-2 h-5 w-5" /> Generate Heatmap
                </Button>
              )}
            </CardContent>
          </Card>
          {/* Visualization Card */}
          <Card className="col-span-2 bg-gradient-to-br from-background/80 to-muted/90 dark:from-slate-900/80 dark:to-slate-950/90 border border-border shadow-xl shadow-primary/10 backdrop-blur-xl rounded-xl flex flex-col">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-foreground tracking-tight drop-shadow mb-2">Heatmap Visualization</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-center items-center">
              {!heatmapGenerated || !selectedJob ? (
                <div className="flex flex-col items-center justify-center h-80 w-full">
                  <Map className="h-16 w-16 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground text-lg text-center">
                    {jobHistory.length > 0
                      ? "Select a previous heatmap or generate a new one"
                      : "Configure settings and generate a heatmap to visualize foot traffic"}
                  </p>
                </div>
              ) : (
                <div className="w-full flex flex-col items-center">
                  <img
                    ref={imageRef}
                    src={customHeatmapUrl || heatmapService.getHeatmapImageUrl(selectedJob.job_id) || "/placeholder.svg"}
                    alt="Foot traffic heatmap"
                    className="rounded-lg border border-border w-full max-w-2xl mb-4"
                    onLoad={() => setIsLoading(false)}
                    onError={() => {
                      setIsLoading(false);
                      toast.error("Failed to load heatmap image");
                    }}
                  />
                  <div className="w-full flex flex-col items-center mt-2">
                    <span className="text-muted-foreground font-medium mb-1">Traffic Density:</span>
                    <div className="w-64 h-4 rounded bg-gradient-to-r from-blue-600 via-yellow-300 to-red-600 mb-1" />
                    <div className="flex justify-between w-64 text-xs text-muted-foreground">
                      <span>Low</span>
                      <span>Medium</span>
                      <span>High</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        {/* Analysis Section */}
        {heatmapGenerated && selectedJob && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-10">
            {/* Total Visitors Card */}
            <Card className="bg-gradient-to-br from-background/80 to-muted/90 dark:from-slate-900/80 dark:to-slate-950/90 border border-border shadow-md backdrop-blur rounded-xl">
              <CardHeader className="flex flex-row items-center gap-2">
                <Users className="text-blue-400 h-6 w-6" />
                <CardTitle className="text-base font-semibold text-foreground">Total Visitors</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center h-36">
                {analysisLoading ? (
                  <p className="text-blue-400">Loading...</p>
                ) : (
                  <p className="text-3xl font-bold text-blue-400">{analysis?.total_visitors ?? 0}</p>
                )}
              </CardContent>
            </Card>
            {/* Traffic Distribution Card */}
            <Card className="bg-gradient-to-br from-background/80 to-muted/90 dark:from-slate-900/80 dark:to-slate-950/90 border border-border shadow-md backdrop-blur rounded-xl">
              <CardHeader className="flex flex-row items-center gap-2">
                <BarChart2 className="text-cyan-400 h-6 w-6" />
                <CardTitle className="text-base font-semibold text-foreground">Traffic Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {analysis && (
                  <ResponsiveContainer width="100%" height={120}>
                    <ReBarChart
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
                    </ReBarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            {/* Recommendations Card */}
            <Card className="bg-gradient-to-br from-background/80 to-muted/90 dark:from-slate-900/80 dark:to-slate-950/90 border border-border shadow-md backdrop-blur rounded-xl">
              <CardHeader className="flex flex-row items-center gap-2">
                <Lightbulb className="text-yellow-400 h-6 w-6" />
                <CardTitle className="text-base font-semibold text-foreground">Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc pl-5 text-muted-foreground">
                  {analysis?.recommendations?.length > 0 ? (
                    analysis.recommendations.map((rec, idx) => (
                      <li key={idx} className="mb-1 text-green-400">{rec}</li>
                    ))
                  ) : (
                    <li className="text-muted-foreground">No recommendations available.</li>
                  )}
                </ul>
              </CardContent>
            </Card>
            {/* Peak Hours Card */}
            <Card className="bg-gradient-to-br from-background/80 to-muted/90 dark:from-slate-900/80 dark:to-slate-950/90 border border-border shadow-md backdrop-blur rounded-xl">
              <CardHeader className="flex flex-row items-center gap-2">
                <Timer className="text-purple-400 h-6 w-6" />
                <CardTitle className="text-base font-semibold text-foreground">Peak Hours</CardTitle>
              </CardHeader>
              <CardContent>
                {peakHoursData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={120}>
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
                  <p className="text-muted-foreground">No peak hours detected.</p>
                )}
              </CardContent>
            </Card>
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
      <div className="mt-8">
        <HeatmapHistoryPanel />
      </div>
    </div>
  );
};

export default HeatmapGeneration;