import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, BarChart2, Lightbulb, Timer, Map, FileVideo, Calendar, Clock, Target, CheckCircle, Download } from "lucide-react"
import { ChartContainer } from "@/components/ui/chart"
import { BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar } from "recharts"
import { heatmapService } from "../services/api"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Button } from "@/components/ui/button"
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"
import CustomDateTimeStep from "@/modules/module2/CustomDateTimeStep"
import CustomConfirmationStep from "@/modules/module2/CustomConfirmationStep"

import { toast } from "sonner"
import AnalyticsSummaryBox from "@/modules/module2/CustomExportStep"
import apiClient from "../services/api"
import { useLocation, Link, useNavigate } from "react-router-dom"

// Add turbo gradient animation for the download icon
const turboGradientStyle = `
@keyframes turbo-glow {
  0% { filter: drop-shadow(0 0 6px #ff0022) drop-shadow(0 0 12px #ffef00); background-position: 0% 0%; }
  20% { filter: drop-shadow(0 0 8px #ff7a00) drop-shadow(0 0 16px #21ff00); background-position: 20% 0%; }
  40% { filter: drop-shadow(0 0 10px #ffef00) drop-shadow(0 0 20px #00cfff); background-position: 40% 0%; }
  60% { filter: drop-shadow(0 0 12px #002bff) drop-shadow(0 0 24px #7a00ff); background-position: 60% 0%; }
  80% { filter: drop-shadow(0 0 14px #d400ff) drop-shadow(0 0 28px #ff00aa); background-position: 80% 0%; }
  100% { filter: drop-shadow(0 0 16px #ff0077) drop-shadow(0 0 32px #ff0000); background-position: 100% 0%; }
}
.turbo-glow {
  background: linear-gradient(90deg, #ff0022 0%, #ff7a00 10%, #ffef00 20%, #21ff00 30%, #00cfff 40%, #002bff 50%, #7a00ff 60%, #d400ff 70%, #ff00aa 80%, #ff0077 90%, #ff0000 100%);
  background-size: 200% 100%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: turbo-glow 2s linear infinite;
  filter: drop-shadow(0 0 8px #ff0022) drop-shadow(0 0 16px #ffef00);
}
`;
if (typeof document !== 'undefined' && !document.getElementById('turbo-glow-style')) {
  const style = document.createElement('style');
  style.id = 'turbo-glow-style';
  style.innerHTML = turboGradientStyle;
  document.head.appendChild(style);
}

// Custom Download icon with turbo-glow on the path only
function DownloadTurboIcon(props) {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-9 w-9" {...props}>
      <defs>
        <linearGradient id="turbo-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ff0022">
            <animate attributeName="stop-color" values="#ff0022;#ff7a00;#ffef00;#21ff00;#00cfff;#002bff;#7a00ff;#d400ff;#ff00aa;#ff0077;#ff0000;#ff0022" dur="2s" repeatCount="indefinite" />
          </stop>
          <stop offset="100%" stopColor="#ff0000">
            <animate attributeName="stop-color" values="#ff0000;#ff0022;#ff7a00;#ffef00;#21ff00;#00cfff;#002bff;#7a00ff;#d400ff;#ff00aa;#ff0077;#ff0000" dur="2s" repeatCount="indefinite" />
          </stop>
        </linearGradient>
      </defs>
      <path stroke="url(#turbo-gradient)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 13V4" />
      <path stroke="url(#turbo-gradient)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 14H5a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1h-2" />
      <path stroke="url(#turbo-gradient)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 9l-4 5-4-5" />
      <path stroke="url(#turbo-gradient)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h.01" />
    </svg>
  );
}

export default function ViewHeatmap() {
  // --- State ---
  const [jobHistory, setJobHistory] = useState([])
  const [selectedJob, setSelectedJob] = useState(null)
  const [heatmapGenerated, setHeatmapGenerated] = useState(false)
  const [analysis, setAnalysis] = useState(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [customHeatmapUrl, setCustomHeatmapUrl] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [settingsMode, setSettingsMode] = useState('standard')
  const [customStep, setCustomStep] = useState(0)
  const totalCustomSteps = 3
  // Custom workflow state
  const [customDateRange, setCustomDateRange] = useState(null)
  const [customTimeRange, setCustomTimeRange] = useState(null)
  // --- Custom generation state ---
  const [isCustomGenerating, setIsCustomGenerating] = useState(false);
  const [customProgress, setCustomProgress] = useState(0);
  const [customGenerationComplete, setCustomGenerationComplete] = useState(false);
  const [isValidDateTime, setIsValidDateTime] = useState(false);
  const [detections, setDetections] = useState(null);
  const [detectionsLoading, setDetectionsLoading] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  const [showSettings, setShowSettings] = useState(false);

  // Fetch job history on mount
  useEffect(() => {
    const fetchJobHistory = async () => {
      try {
        const history = await heatmapService.getJobHistory()
        setJobHistory(history.filter((job) => job.status === "completed"))
      } catch (error) {
        setJobHistory([])
      }
    }
    fetchJobHistory()
  }, [])

  // Auto-select job if jobId is in URL
  useEffect(() => {
    if (jobHistory.length === 0) return;
    const params = new URLSearchParams(location.search);
    const jobId = params.get("jobId");
    if (jobId && !selectedJob) {
      const found = jobHistory.find(j => j.job_id === jobId);
      if (found) {
        setSelectedJob(found);
        setHeatmapGenerated(true);
        setCustomHeatmapUrl(null);
      }
    }
  }, [jobHistory, location.search, selectedJob]);

  // Fetch analysis when selectedJob changes
  useEffect(() => {
    if (!selectedJob) {
      setAnalysis(null)
      return
    }
    setAnalysisLoading(true)
    heatmapService.getHeatmapAnalysis(selectedJob.job_id)
      .then(data => setAnalysis(data))
      .catch(() => setAnalysis(null))
      .finally(() => setAnalysisLoading(false))
  }, [selectedJob])

  // Fetch detections if needed (single bin)
  useEffect(() => {
    if (!selectedJob) {
      setDetections(null);
      return;
    }
    if (analysis?.peak_hours && analysis.peak_hours.length === 1) {
      setDetectionsLoading(true);
      apiClient.get(`/heatmap_jobs/${selectedJob.job_id}/detections`).then(res => {
        setDetections(res.data.detections || []);
      }).catch(() => setDetections([])).finally(() => setDetectionsLoading(false));
    } else {
      setDetections(null);
    }
  }, [selectedJob, analysis?.peak_hours]);

  // Robust polling for custom heatmap progress
  useEffect(() => {
    let poll = null;
    if (isCustomGenerating && selectedJob && customProgress < 100) {
      poll = setInterval(async () => {
        try {
          const data = await heatmapService.getCustomHeatmapProgress(selectedJob.job_id);
          setCustomProgress(Math.round((data.progress || 0) * 100));
          if (data.progress >= 1) {
            clearInterval(poll);
            setIsCustomGenerating(false);
            setCustomGenerationComplete(true);
            // Fetch custom heatmap image and analytics
            const videoStart = new Date(selectedJob.start_datetime);
            const startDate = new Date(customDateRange.start);
            startDate.setHours(...customTimeRange.start.split(":").map(Number));
            const endDate = new Date(customDateRange.end);
            endDate.setHours(...customTimeRange.end.split(":").map(Number));
            const startTimeInSeconds = (startDate - videoStart) / 1000;
            const endTimeInSeconds = (endDate - videoStart) / 1000;
            const customUrl = heatmapService.getCustomHeatmapImageUrl(selectedJob.job_id, startTimeInSeconds, endTimeInSeconds);
            setCustomHeatmapUrl(customUrl);
            // Fetch custom analytics
            setAnalysisLoading(true);
            try {
              const customAnalysis = await heatmapService.getCustomHeatmapAnalysis(selectedJob.job_id, {
                start_time: startTimeInSeconds,
                end_time: endTimeInSeconds,
                area: 'all',
              });
              setAnalysis(customAnalysis);
              toast.success('Custom heatmap generated successfully!');
            } catch (err) {
              toast.error('Failed to fetch custom analytics.');
            } finally {
              setAnalysisLoading(false);
            }
            setCustomStep(2);
          }
        } catch (e) {
          clearInterval(poll);
          setIsCustomGenerating(false);
          setCustomProgress(0);
          toast.error('Custom heatmap progress polling failed.');
        }
      }, 500);
    }
    return () => {
      if (poll) clearInterval(poll);
    };
  }, [isCustomGenerating, selectedJob, customProgress, customDateRange, customTimeRange]);

  // Handlers
  const handleSelectJob = (job) => {
    setSelectedJob(job)
    setHeatmapGenerated(true)
    setCustomHeatmapUrl(null)
  }
  const handleDeleteJob = async (jobId) => {
    try {
      await heatmapService.deleteJob(jobId)
      setJobHistory(jobs => jobs.filter(j => j.job_id !== jobId))
      if (selectedJob && selectedJob.job_id === jobId) {
        setSelectedJob(null)
        setHeatmapGenerated(false)
        setAnalysis(null)
      }
    } catch {}
  }

  // Export handlers using fetch+blob for download (like HeatmapGeneration.jsx)
  const handleExportCSV = async () => {
    if (!selectedJob) return;
    try {
      const res = await apiClient.get(
        `/heatmap_jobs/${selectedJob.job_id}/export/csv`,
        { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `heatmap_${selectedJob.job_id}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('Failed to export CSV');
    }
  };

  const handleExportPDF = async () => {
    if (!selectedJob) return;
    try {
      const res = await apiClient.get(
        `/heatmap_jobs/${selectedJob.job_id}/export/pdf`,
        { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `heatmap_${selectedJob.job_id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('Failed to export PDF');
    }
  };

  const handleExportImage = async () => {
    if (!selectedJob) return;
    try {
      const res = await apiClient.get(
        `/heatmap_jobs/${selectedJob.job_id}/result/image`,
        { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `heatmap_${selectedJob.job_id}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('Failed to export image');
    }
  };

  // Prepare traffic distribution data
  const trafficData = [
    { name: 'High', value: analysis?.areas?.high?.percentage ?? 0 },
    { name: 'Medium', value: analysis?.areas?.medium?.percentage ?? 0 },
    { name: 'Low', value: analysis?.areas?.low?.percentage ?? 0 }
  ]

  // Prepare peak hours data (array of {x, y})
  const formatMinute = (min) => {
    const h = Math.floor(min / 60).toString().padStart(2, '0');
    const m = (min % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  };
  let peakHoursData = [];
  if (analysis?.peak_hours && analysis.peak_hours.length === 1 && detections) {
    // For short videos, bin detections by timestamp into 5 intervals and count unique visitors
    const bin = analysis.peak_hours[0];
    const startTime = bin.start_minute * 60;
    const endTime = bin.end_minute * 60;
    const totalDuration = endTime - startTime;
    const numBins = 5;
    const interval = totalDuration / numBins;
    for (let i = 0; i < numBins; i++) {
      const binStart = startTime + i * interval;
      const binEnd = binStart + interval;
      // Collect unique track_ids in this bin
      const trackIds = new Set();
      detections.forEach(det => {
        const t = det.timestamp;
        if (t >= binStart && t < binEnd) {
          trackIds.add(det.track_id);
        }
      });
      const formatSec = (sec) => {
        const h = Math.floor(sec / 3600).toString().padStart(2, '0');
        const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
        const s = Math.floor(sec % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
      };
      peakHoursData.push({
        x: `${formatSec(binStart)}-${formatSec(binEnd)}`,
        y: trackIds.size,
      });
    }
  } else if (analysis?.peak_hours && analysis.peak_hours.length > 1) {
    peakHoursData = analysis.peak_hours.map(ph => ({
      x: `${formatMinute(ph.start_minute)}-${formatMinute(ph.end_minute)}`,
      y: ph.count,
    }));
  }

  // Custom heatmap generation handler
  const handleGenerateCustomHeatmap = async () => {
    if (!selectedJob || !customDateRange || !customTimeRange) return;
    setIsCustomGenerating(true);
    setCustomProgress(0);
    setCustomGenerationComplete(false);

    const videoStart = new Date(selectedJob.start_datetime);
    const startDate = new Date(customDateRange.start);
    startDate.setHours(...customTimeRange.start.split(":").map(Number));
    const endDate = new Date(customDateRange.end);
    endDate.setHours(...customTimeRange.end.split(":").map(Number));
    const startTimeInSeconds = (startDate - videoStart) / 1000;
    const endTimeInSeconds = (endDate - videoStart) / 1000;

    // Log all relevant data for debugging
    console.log("[CustomHeatmap] job_id:", selectedJob.job_id);
    console.log("[CustomHeatmap] startDate:", startDate, "endDate:", endDate);
    console.log("[CustomHeatmap] videoStart:", videoStart);
    console.log("[CustomHeatmap] startTimeInSeconds:", startTimeInSeconds, "endTimeInSeconds:", endTimeInSeconds);
    const requestBody = { start_time: startTimeInSeconds, end_time: endTimeInSeconds };
    console.log("[CustomHeatmap] requestBody:", requestBody);

    try {
      await heatmapService.generateCustomHeatmap(selectedJob.job_id, requestBody);
      // Polling will now be handled by the useEffect above
    } catch (err) {
      setIsCustomGenerating(false);
      setCustomProgress(0);
      toast.error('Custom heatmap request failed: ' + (err?.error || err?.message || err));
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-gradient-to-b from-background via-muted to-background dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 py-8 px-1 md:px-0 overflow-x-hidden">
      {/* Soft background blur and gradient effects */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-32 -left-32 w-80 h-80 bg-blue-400/20 dark:bg-blue-700/20 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 right-0 w-64 h-64 bg-cyan-300/20 dark:bg-cyan-500/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-1/2 w-80 h-80 bg-fuchsia-300/10 dark:bg-fuchsia-700/10 rounded-full blur-3xl"></div>
      </div>
      <div className="container relative z-10 mx-auto max-w-7xl px-4 py-4">
        <div className="grid grid-rows-2 gap-2 w-full" style={{ minHeight: 'calc(100vh - 120px)' }}>
          {/* Row 1: Visualization & Settings */}
          <div className="grid grid-cols-4 gap-6 items-start">
            {/* Visualization */}
            <div className={`flex items-start justify-center relative ${showSettings ? 'col-span-2' : 'col-span-4'} w-full h-full`}>
              <Card className={`h-[750px] box-border flex flex-col shadow-xl rounded-xl bg-gradient-to-br from-background/80 to-muted/90 relative ${showSettings ? 'w-full max-w-2xl' : 'w-full'}`}>
                {/* Download Icon Button */}
                <button
                  className={`absolute top-4 right-4 z-20 transition-colors ${(!heatmapGenerated || !selectedJob) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-cyan-100 dark:hover:bg-cyan-800'}`}
                  onClick={() => { if (heatmapGenerated && selectedJob) setShowSettings(v => !v); }}
                  title="Show Heatmap Settings"
                  disabled={!heatmapGenerated || !selectedJob}
                  style={{ background: 'none', padding: 0, border: 'none' }}
                >
                  <DownloadTurboIcon />
                </button>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-bold text-foreground tracking-tight drop-shadow mb-2 whitespace-nowrap text-center">Heatmap Visualization</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-between items-center h-full w-full box-border">
                  <div className="flex-1 flex items-center justify-center w-full">
                    {(!heatmapGenerated || !selectedJob) ? (
                      <div className="flex flex-col items-center justify-center w-full h-full">
                        <Map className="h-16 w-16 text-muted-foreground mb-4" />
                        <p className="text-muted-foreground text-lg text-center">
                          {jobHistory.length > 0
                            ? <div className="flex flex-col items-center gap-2">
                                <div className="flex flex-row items-center gap-1 text-lg text-center">
                                  <button
                                    type="button"
                                    onClick={() => document.getElementById('analytics-section')?.scrollIntoView({ behavior: 'smooth' })}
                                    className="text-cyan-500 hover:text-cyan-600 dark:text-cyan-400 dark:hover:text-cyan-300 underline underline-offset-2 cursor-pointer bg-transparent border-none p-0 m-0"
                                  >
                                    Select a previous heatmap
                                  </button>
                                  <span>or</span>
                                  <Link
                                    to="/video-processing"
                                    className="text-cyan-500 hover:text-cyan-600 dark:text-cyan-400 dark:hover:text-cyan-300 underline underline-offset-2 cursor-pointer"
                                  >
                                    generate a new one
                                  </Link>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => document.getElementById('analytics-section')?.scrollIntoView({ behavior: 'smooth' })}
                                  className="text-sm text-muted-foreground hover:text-foreground transition-colors bg-transparent border-none p-0 m-0"
                                >
                                  View heatmap history ↓
                                </button>
                              </div>
                            : "Configure settings and generate a heatmap to visualize foot traffic"}
                        </p>
                      </div>
                    ) : (
                      <img
                        src={customHeatmapUrl || (selectedJob ? heatmapService.getHeatmapImageUrl(selectedJob.job_id) : null) || "/placeholder.svg"}
                        alt="Foot traffic heatmap"
                        className={`rounded-lg ${showSettings ? 'w-full h-full object-contain' : 'w-full h-[500px] object-contain'}`}
                        onLoad={() => setIsLoading(false)}
                        onError={() => setIsLoading(false)}
                      />
                    )}
                  </div>
                  <div className="w-full flex flex-col items-center mt-2 mb-4">
                    <span className="text-muted-foreground font-medium mb-1">Traffic Density:</span>
                    <div className="w-64 h-4 rounded bg-gradient-to-r from-blue-600 via-yellow-300 to-red-600 mb-1" />
                    <div className="flex justify-between w-64 text-xs text-muted-foreground">
                      <span>Low</span>
                      <span>Medium</span>
                      <span>High</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            {/* Settings (conditionally rendered) */}
            {showSettings && (
              <div className="col-span-2 flex items-start">
                <Card className="w-full h-[750px] box-border flex flex-col shadow-xl rounded-xl bg-gradient-to-br from-blue-400/30 to-background/80">
                  <CardHeader className="pb-2 items-center">
                    <CardTitle className="text-lg font-bold text-foreground tracking-tight drop-shadow mb-2 whitespace-nowrap text-center">Heatmap Settings</CardTitle>
                    {/* Toggle Group */}
                    <div className="flex justify-center w-full mt-4">
                      <ToggleGroup
                        type="single"
                        value={settingsMode}
                        onValueChange={val => val && setSettingsMode(val)}
                        variant="outline"
                        size="default"
                        className="bg-muted/60 border border-border rounded-lg overflow-hidden shadow-md"
                      >
                        <ToggleGroupItem value="standard" className={"px-6 py-2 text-base font-semibold transition-all rounded-md " + (settingsMode === "standard"
                          ? "bg-gradient-to-r from-white to-cyan-100 text-black border border-border dark:from-blue-900 dark:to-cyan-800 dark:text-white"
                          : "text-black bg-transparent hover:bg-muted/60 border border-transparent dark:text-white dark:bg-white/10 dark:hover:bg-white/20")}>Standard</ToggleGroupItem>
                        <ToggleGroupItem value="custom" className={"px-6 py-2 text-base font-semibold transition-all rounded-md " + (settingsMode === "custom"
                          ? "bg-gradient-to-r from-white to-cyan-100 text-black border border-border dark:from-blue-900 dark:to-cyan-800 dark:text-white"
                          : "text-black bg-transparent hover:bg-muted/60 border border-transparent dark:text-white dark:bg-white/10 dark:hover:bg-white/20")}>Custom</ToggleGroupItem>
                      </ToggleGroup>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col justify-start items-center w-full h-full box-border">
                    {settingsMode === "standard" && selectedJob && analysis && (
                      <div className="w-full max-w-xl mt-2 mb-2 flex flex-col items-center">
                        <AnalyticsSummaryBox
                          startDate={selectedJob.start_datetime ? new Date(selectedJob.start_datetime).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric', year: 'numeric' }) : 'N/A'}
                          endDate={selectedJob.end_datetime ? new Date(selectedJob.end_datetime).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric', year: 'numeric' }) : 'N/A'}
                          startTime={selectedJob.start_datetime ? new Date(selectedJob.start_datetime).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }) : 'N/A'}
                          endTime={selectedJob.end_datetime ? new Date(selectedJob.end_datetime).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }) : 'N/A'}
                          analysis={analysis}
                          detections={detections}
                        />
                        {/* Export Buttons */}
                        <div className="flex gap-4 mt-2">
                          <Button
                            className="bg-gradient-to-r from-white to-cyan-200 text-black font-semibold shadow-md border border-border py-2 text-sm hover:opacity-90 dark:from-blue-900 dark:to-cyan-800 dark:text-white flex-1"
                            onClick={handleExportCSV}
                          >
                            Export CSV
                          </Button>
                          <Button
                            className="bg-gradient-to-r from-white to-cyan-200 text-black font-semibold shadow-md border border-border py-2 text-sm hover:opacity-90 dark:from-blue-900 dark:to-cyan-800 dark:text-white flex-1"
                            onClick={handleExportPDF}
                          >
                            Export PDF
                          </Button>
                          <Button
                            className="bg-gradient-to-r from-white to-cyan-200 text-black font-semibold shadow-md border border-border py-2 text-sm hover:opacity-90 dark:from-blue-900 dark:to-cyan-800 dark:text-white flex-1"
                            onClick={handleExportImage}
                          >
                            Export JPG
                          </Button>
                        </div>
                      </div>
                    )}
                    {settingsMode === "custom" && (
                      <div className="w-full flex flex-col items-center justify-start h-full">
                        {/* Inline Carousel Section: Custom Steps */}
                        <div className="w-full max-w-xl mt-[-25px] h-[530px]">
                          {customStep === 0 && (
                            <CustomDateTimeStep
                              selectedJob={selectedJob}
                              dateRange={customDateRange}
                              setDateRange={setCustomDateRange}
                              timeRange={customTimeRange}
                              setTimeRange={setCustomTimeRange}
                              setIsValidDateTime={setIsValidDateTime}
                              onNext={() => setCustomStep(1)}
                            />
                          )}
                          {customStep === 1 && (
                            <CustomConfirmationStep
                              dateRange={customDateRange}
                              timeRange={customTimeRange}
                              onPrevious={() => setCustomStep(0)}
                              onNext={handleGenerateCustomHeatmap}
                              progress={customProgress}
                              isGenerating={isCustomGenerating}
                              recommendations={analysis?.recommendations || []}
                              progressPercent={customProgress}
                              isValidDateTime={isValidDateTime}
                            />
                          )}
                          {customStep === 2 && (
                            <>
                              <AnalyticsSummaryBox
                                customDateRange={customDateRange}
                                customTimeRange={customTimeRange}
                                analysis={analysis}
                                detections={detections}
                              />
                              <div className="flex gap-2 mt-2">
                                <Button
                                  className="bg-gradient-to-r from-white to-cyan-200 text-black font-semibold shadow-md border border-border py-2 text-sm hover:opacity-90 dark:from-blue-900 dark:to-cyan-800 dark:text-white flex-1"
                                  onClick={async () => {
                                    if (!selectedJob || !customDateRange || !customTimeRange) return;
                                    try {
                                      const videoStart = new Date(selectedJob.start_datetime);
                                      const startDate = new Date(customDateRange.start);
                                      startDate.setHours(...customTimeRange.start.split(":").map(Number));
                                      const endDate = new Date(customDateRange.end);
                                      endDate.setHours(...customTimeRange.end.split(":").map(Number));
                                      const startTimeInSeconds = (startDate - videoStart) / 1000;
                                      const endTimeInSeconds = (endDate - videoStart) / 1000;
                                      const startDatetimeStr = `${startDate.toLocaleDateString()} ${startDate.toLocaleTimeString()}`;
                                      const endDatetimeStr = `${endDate.toLocaleDateString()} ${endDate.toLocaleTimeString()}`;
                                      const res = await apiClient.get(
                                        `/heatmap_jobs/${selectedJob.job_id}/export/csv`,
                                        {
                                          params: {
                                            start_time: startTimeInSeconds,
                                            end_time: endTimeInSeconds,
                                            start_datetime: startDatetimeStr,
                                            end_datetime: endDatetimeStr
                                          },
                                          responseType: 'blob'
                                        }
                                      );
                                      const url = window.URL.createObjectURL(res.data);
                                      const a = document.createElement('a');
                                      a.href = url;
                                      a.download = `custom_heatmap_${selectedJob.job_id}.csv`;
                                      document.body.appendChild(a);
                                      a.click();
                                      a.remove();
                                      window.URL.revokeObjectURL(url);
                                    } catch (err) {
                                      toast.error('Failed to export CSV');
                                    }
                                  }}>
                                    Export CSV
                                  </Button>
                                <Button
                                  className="bg-gradient-to-r from-white to-cyan-200 text-black font-semibold shadow-md border border-border py-2 text-sm hover:opacity-90 dark:from-blue-900 dark:to-cyan-800 dark:text-white flex-1"
                                  onClick={async () => {
                                    if (!selectedJob || !customDateRange || !customTimeRange) return;
                                    try {
                                      const videoStart = new Date(selectedJob.start_datetime);
                                      const startDate = new Date(customDateRange.start);
                                      startDate.setHours(...customTimeRange.start.split(":").map(Number));
                                      const endDate = new Date(customDateRange.end);
                                      endDate.setHours(...customTimeRange.end.split(":").map(Number));
                                      const startTimeInSeconds = (startDate - videoStart) / 1000;
                                      const endTimeInSeconds = (endDate - videoStart) / 1000;
                                      const startDatetimeStr = `${startDate.toLocaleDateString()} ${startDate.toLocaleTimeString()}`;
                                      const endDatetimeStr = `${endDate.toLocaleDateString()} ${endDate.toLocaleTimeString()}`;
                                      const res = await apiClient.get(
                                        `/heatmap_jobs/${selectedJob.job_id}/export/pdf`,
                                        {
                                          params: {
                                            start_time: startTimeInSeconds,
                                            end_time: endTimeInSeconds,
                                            start_datetime: startDatetimeStr,
                                            end_datetime: endDatetimeStr
                                          },
                                          responseType: 'blob'
                                        }
                                      );
                                      const url = window.URL.createObjectURL(res.data);
                                      const a = document.createElement('a');
                                      a.href = url;
                                      a.download = `custom_heatmap_${selectedJob.job_id}.pdf`;
                                      document.body.appendChild(a);
                                      a.click();
                                      a.remove();
                                      window.URL.revokeObjectURL(url);
                                    } catch (err) {
                                      toast.error('Failed to export PDF');
                                    }
                                  }}>
                                    Export PDF
                                  </Button>
                                <Button
                                  className="bg-gradient-to-r from-white to-cyan-200 text-black font-semibold shadow-md border border-border py-2 text-sm hover:opacity-90 dark:from-blue-900 dark:to-cyan-800 dark:text-white flex-1"
                                  onClick={async () => {
                                    if (!selectedJob || !customDateRange || !customTimeRange) return;
                                    try {
                                      const videoStart = new Date(selectedJob.start_datetime);
                                      const startDate = new Date(customDateRange.start);
                                      startDate.setHours(...customTimeRange.start.split(":").map(Number));
                                      const endDate = new Date(customDateRange.end);
                                      endDate.setHours(...customTimeRange.end.split(":").map(Number));
                                      const startTimeInSeconds = (startDate - videoStart) / 1000;
                                      const endTimeInSeconds = (endDate - videoStart) / 1000;
                                      const res = await apiClient.get(
                                        `/heatmap_jobs/${selectedJob.job_id}/custom_heatmap_image`,
                                        {
                                          params: { start: startTimeInSeconds, end: endTimeInSeconds },
                                          responseType: 'blob'
                                        }
                                      );
                                      const url = window.URL.createObjectURL(res.data);
                                      const a = document.createElement('a');
                                      a.href = url;
                                      a.download = `custom_heatmap_${selectedJob.job_id}.jpg`;
                                      document.body.appendChild(a);
                                      a.click();
                                      a.remove();
                                      window.URL.revokeObjectURL(url);
                                    } catch (err) {
                                      toast.error('Failed to export image');
                                    }
                                  }}>
                                    Export JPG
                                  </Button>
                              </div>
                            </>
                          )}
                        </div>
                        <div className="flex justify-center mt-10 mb-0 flex-grow-0 w-full">
                          <Pagination>
                            <PaginationContent>
                              <PaginationItem>
                                <PaginationPrevious href="#" onClick={() => setCustomStep(customStep - 1)} disabled={customStep === 0} />
                              </PaginationItem>
                              {[...Array(totalCustomSteps)].map((_, idx) => (
                                <PaginationItem key={`pagination-step-${idx}`}>
                                  <PaginationLink
                                    href="#"
                                    isActive={customStep === idx}
                                    onClick={() => {
                                      if (
                                        (idx === 1 && (!customDateRange || !customTimeRange || !isValidDateTime)) ||
                                        (idx === 2 && !customGenerationComplete) ||
                                        (idx === 0 && !isValidDateTime && customStep !== 0)
                                      ) return;
                                      setCustomStep(idx);
                                    }}
                                    disabled={
                                      (idx === 1 && (!customDateRange || !customTimeRange || !isValidDateTime)) ||
                                      (idx === 2 && !customGenerationComplete) ||
                                      (idx > customStep + 1) ||
                                      (idx === 0 && !isValidDateTime && customStep !== 0)
                                    }
                                  >
                                    {idx + 1}
                                  </PaginationLink>
                                </PaginationItem>
                              ))}
                              <PaginationItem>
                                <PaginationNext
                                  href="#"
                                  onClick={() => setCustomStep(customStep + 1)}
                                  disabled={
                                    (customStep === 0 && !isValidDateTime) ||
                                    (customStep === 1 && !customGenerationComplete) ||
                                    customStep === totalCustomSteps - 1
                                  }
                                />
                              </PaginationItem>
                            </PaginationContent>
                          </Pagination>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
          {/* Row 2: Analytics Section */}
          <Card id="analytics-section" className="w-full h-full bg-gradient-to-br from-background/80 to-muted/90 dark:from-slate-900/80 dark:to-slate-950/90 border border-border shadow-2xl shadow-primary/10 backdrop-blur-xl rounded-xl p-8 flex flex-col">
            <div className="grid grid-cols-4 grid-rows-2 gap-3 h-full">
              {/* Heatmap History: col 1, row-span-2 */}
              <div className="col-span-1 row-span-2 h-full flex flex-col">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-bold text-foreground tracking-tight drop-shadow mb-2">Heatmap History</CardTitle>
                </CardHeader>
                <CardContent className="h-full flex-1 overflow-y-auto">
                  {jobHistory.length === 0 ? (
                    <div className="text-muted-foreground text-center mt-8">No heatmaps found.</div>
                  ) : (
                    <div className="space-y-2">
                      {jobHistory.map((job) => (
                        <div
                          key={job.job_id}
                          className={`flex items-center justify-between px-2 py-2 rounded-md cursor-pointer transition-colors ${selectedJob && selectedJob.job_id === job.job_id ? "bg-primary/20 dark:bg-blue-900/40" : "hover:bg-muted/60 dark:hover:bg-slate-800/60"}`}
                          onClick={() => handleSelectJob(job)}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-semibold text-foreground text-sm">
                              {job.input_video_name || job.input_floorplan_name || job.job_id.slice(0, 8) + "..."}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(job.start_datetime).toLocaleString()} - {new Date(job.end_datetime).toLocaleString()}
                            </div>
                          </div>
                          <button
                            className="ml-2 p-1 rounded hover:bg-red-100 dark:hover:bg-red-900"
                            onClick={e => {
                              e.stopPropagation();
                              handleDeleteJob(job.job_id);
                            }}
                            title="Delete heatmap"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3m5 0H6" /></svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </div>
              {/* Total Visitors: col 2, row 1 */}
              <Card className="bg-gradient-to-br from-yellow-400/40 to-background/80 border-none shadow-xl shadow-blue-400/20 backdrop-blur-md py-4 rounded-xl transition-transform hover:scale-[1.02] hover:shadow-blue-400/30 flex flex-col items-center">
                <CardHeader className="flex flex-row items-center gap-2 justify-center w-full">
                  <Users className="text-yellow-400 h-7 w-7 mb-2 drop-shadow" />
                  <CardTitle className="text-base font-semibold text-foreground whitespace-nowrap text-center">Total Visitors</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center flex-1">
                  {analysisLoading ? (
                    <p className="text-yellow-400">Loading...</p>
                  ) : (
                    <p className="text-3xl font-bold text-yellow-400">{analysis?.total_visitors ?? 0}</p>
                  )}
                </CardContent>
              </Card>
              {/* Traffic Distribution: col 3-4, row 1 */}
              <Card className="bg-gradient-to-br from-cyan-400/40 to-background/80 border-none shadow-xl shadow-cyan-400/20 backdrop-blur-md py-4 rounded-xl transition-transform hover:scale-[1.02] hover:shadow-cyan-400/30 flex flex-col items-center col-span-2 row-span-1">
                <CardHeader className="flex flex-row items-center gap-2 justify-center w-full">
                  <BarChart2 className="text-cyan-400 h-7 w-7 mb-2 drop-shadow" />
                  <CardTitle className="text-base font-semibold text-foreground whitespace-nowrap text-center">Traffic Distribution</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex items-center w-full">
                  <ChartContainer config={{ value: { color: '#1976d2', label: 'Visitors' } }} className="w-full h-full">
                    <BarChart data={[
                      { name: 'High', value: analysis?.areas?.high?.percentage ?? 0 },
                      { name: 'Medium', value: analysis?.areas?.medium?.percentage ?? 0 },
                      { name: 'Low', value: analysis?.areas?.low?.percentage ?? 0 }
                    ]} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis unit="%" />
                      <Tooltip />
                      <Bar dataKey="value" fill="#1976d2" />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>
              {/* Recommendations: col 2-3, row 2 */}
              <div className="col-span-2 row-span-1 h-full flex flex-col bg-gradient-to-br from-green-400/30 to-background/80 border-none shadow-xl shadow-green-400/20 backdrop-blur-md py-4 rounded-xl transition-transform hover:scale-[1.02] hover:shadow-green-400/30">
                <CardHeader className="flex flex-row items-center gap-2">
                  <Lightbulb className="text-green-400 h-7 w-7 mb-2 drop-shadow" />
                  <CardTitle className="text-base font-semibold text-foreground whitespace-nowrap text-center">Recommendations</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc pl-5 text-muted-foreground">
                    {analysis?.recommendations?.length > 0 ? (
                      analysis.recommendations.map((rec, idx) => (
                        <li key={`rec-list-${idx}`}>{rec}</li>
                      ))
                    ) : (
                      <li className="text-muted-foreground">No recommendations available.</li>
                    )}
                  </ul>
                </CardContent>
              </div>
              {/* Peak Hour/Minute: col 4, row 2 */}
              <div className="col-span-1 row-span-1 h-full flex flex-col bg-gradient-to-br from-purple-400/30 to-background/80 border-none shadow-xl shadow-purple-400/20 backdrop-blur-md py-4 rounded-xl transition-transform hover:scale-[1.02] hover:shadow-purple-400/30 items-center justify-center">
                <CardHeader className="flex flex-row items-center gap-2 justify-center">
                  <Timer className="text-purple-400 h-7 w-7 mb-2 drop-shadow" />
                  <CardTitle className="text-base font-semibold text-foreground whitespace-nowrap text-center">Peak Hour/Minute</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center w-full">
                  {analysisLoading || detectionsLoading ? (
                    <p className="text-purple-400">Loading...</p>
                  ) : (peakHoursData && peakHoursData.length > 0) ? (
                    <>
                      <ChartContainer className="w-full h-40" config={{ value: { color: '#a78bfa', label: 'Visitors' } }}>
                        <BarChart data={peakHoursData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="x" />
                          <YAxis allowDecimals={false} />
                          <Tooltip />
                          <Bar dataKey="y" fill="#a78bfa" />
                        </BarChart>
                      </ChartContainer>
                      <span className="text-xs text-muted-foreground mt-2">
                        Peak: {peakHoursData[0].x} min ({peakHoursData[0].y} visitors)
                      </span>
                    </>
                  ) : (
                    <span className="text-3xl font-bold text-purple-400 mb-1">N/A</span>
                  )}
                </CardContent>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
} 