import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, BarChart2, Lightbulb, Timer, Map, FileVideo, Calendar, Clock, Target, CheckCircle } from "lucide-react"
import { ChartContainer } from "@/components/ui/chart"
import { BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar } from "recharts"
import { heatmapService } from "../services/api"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Button } from "@/components/ui/button"
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"
import CustomDateTimeStep from "@/modules/module2/CustomDateTimeStep"
import CustomConfirmationStep from "@/modules/module2/CustomConfirmationStep"
import CustomExportStep from "@/modules/module2/CustomExportStep"
import { toast } from "sonner"
import AnalyticsSummaryBox from "@/modules/module2/CustomExportStep"

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
      const res = await fetch(`/api/heatmap_jobs/${selectedJob.job_id}/export/csv`);
      if (!res.ok) throw new Error('Failed to export CSV');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `heatmap_${selectedJob.job_id}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to export CSV');
    }
  };

  const handleExportPDF = async () => {
    if (!selectedJob) return;
    try {
      const res = await fetch(`/api/heatmap_jobs/${selectedJob.job_id}/export/pdf`);
      if (!res.ok) throw new Error('Failed to export PDF');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `heatmap_${selectedJob.job_id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to export PDF');
    }
  };

  const handleExportImage = async () => {
    if (!selectedJob) return;
    try {
      const res = await fetch(`/api/heatmap_jobs/${selectedJob.job_id}/result/image`);
      if (!res.ok) throw new Error('Failed to export image');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `heatmap_${selectedJob.job_id}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to export image');
    }
  };

  // Prepare traffic distribution data
  const trafficData = [
    { name: 'High', value: analysis?.areas?.high?.percentage ?? 0 },
    { name: 'Medium', value: analysis?.areas?.medium?.percentage ?? 0 },
    { name: 'Low', value: analysis?.areas?.low?.percentage ?? 0 }
  ]

  // Prepare peak hours data (array of {x, y})
  const peakHoursData = analysis?.peak_hours?.map(ph => ({
    x: `${ph.start_minute}-${ph.end_minute}`,
    y: ph.count,
  })) || []

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
      // Only start polling if POST succeeded
      const poll = setInterval(async () => {
        try {
          const data = await heatmapService.getCustomHeatmapProgress(selectedJob.job_id);
          setCustomProgress(Math.round((data.progress || 0) * 100));
          if (data.progress >= 1) {
            clearInterval(poll);
            setIsCustomGenerating(false);
            setCustomGenerationComplete(true);
            // Fetch custom heatmap image and analytics
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
            // Auto-advance to export step
            setCustomStep(2);
          }
        } catch (e) {
          clearInterval(poll);
          setIsCustomGenerating(false);
          setCustomProgress(0);
          toast.error('Custom heatmap progress polling failed.');
        }
      }, 500);
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
            <div className="col-span-2 flex items-start justify-center">
              <Card className="w-full max-w-2xl h-[750px] box-border flex flex-col shadow-xl rounded-xl bg-gradient-to-br from-background/80 to-muted/90">
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
                            ? "Select a previous heatmap or generate a new one"
                            : "Configure settings and generate a heatmap to visualize foot traffic"}
                        </p>
                      </div>
                    ) : (
                      <img
                        src={customHeatmapUrl || (selectedJob ? heatmapService.getHeatmapImageUrl(selectedJob.job_id) : null) || "/placeholder.svg"}
                        alt="Foot traffic heatmap"
                        className="rounded-lg w-full h-full object-contain"
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
            {/* Settings */}
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
                      />
                      {/* Export Buttons */}
                      <div className="flex gap-4 mt-2">
                        <Button
                          className="bg-gradient-to-r from-white to-cyan-200 text-black font-semibold shadow-md border border-border py-2 text-sm hover:opacity-90 dark:from-blue-900 dark:to-cyan-800 dark:text-white"
                          onClick={handleExportCSV}
                        >
                          Export CSV
                        </Button>
                        <Button
                          className="bg-gradient-to-r from-white to-cyan-200 text-black font-semibold shadow-md border border-border py-2 text-sm hover:opacity-90 dark:from-blue-900 dark:to-cyan-800 dark:text-white"
                          onClick={handleExportPDF}
                        >
                          Export PDF
                        </Button>
                        <Button
                          className="bg-gradient-to-r from-white to-cyan-200 text-black font-semibold shadow-md border border-border py-2 text-sm hover:opacity-90 dark:from-blue-900 dark:to-cyan-800 dark:text-white"
                          onClick={handleExportImage}
                        >
                          Export Image
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
                          />
                        )}
                        {customStep === 2 && (
                          <>
                            <AnalyticsSummaryBox
                              customDateRange={customDateRange}
                              customTimeRange={customTimeRange}
                              analysis={analysis}
                            />
                            <div className="flex gap-2 mt-2">
                              <Button variant="outline" className="flex-1 border-border bg-muted text-foreground hover:bg-primary/10 dark:bg-slate-900/60 dark:text-white dark:hover:bg-blue-900/40" onClick={async () => {
                                if (!selectedJob || !customDateRange || !customTimeRange) return;
                                try {
                                  const videoStart = new Date(selectedJob.start_datetime);
                                  const startDate = new Date(customDateRange.start);
                                  startDate.setHours(...customTimeRange.start.split(":").map(Number));
                                  const endDate = new Date(customDateRange.end);
                                  endDate.setHours(...customTimeRange.end.split(":").map(Number));
                                  const startTimeInSeconds = (startDate - videoStart) / 1000;
                                  const endTimeInSeconds = (endDate - videoStart) / 1000;
                                  const res = await fetch(`/api/heatmap_jobs/${selectedJob.job_id}/custom_export/csv?start_time=${startTimeInSeconds}&end_time=${endTimeInSeconds}`);
                                  if (!res.ok) throw new Error('Failed to export CSV');
                                  const blob = await res.blob();
                                  const url = window.URL.createObjectURL(blob);
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
                              <Button variant="outline" className="flex-1 border-border bg-muted text-foreground hover:bg-primary/10 dark:bg-slate-900/60 dark:text-white dark:hover:bg-blue-900/40" onClick={async () => {
                                if (!selectedJob || !customDateRange || !customTimeRange) return;
                                try {
                                  const videoStart = new Date(selectedJob.start_datetime);
                                  const startDate = new Date(customDateRange.start);
                                  startDate.setHours(...customTimeRange.start.split(":").map(Number));
                                  const endDate = new Date(customDateRange.end);
                                  endDate.setHours(...customTimeRange.end.split(":").map(Number));
                                  const startTimeInSeconds = (startDate - videoStart) / 1000;
                                  const endTimeInSeconds = (endDate - videoStart) / 1000;
                                  const res = await fetch(`/api/heatmap_jobs/${selectedJob.job_id}/custom_export/pdf?start_time=${startTimeInSeconds}&end_time=${endTimeInSeconds}`);
                                  if (!res.ok) throw new Error('Failed to export PDF');
                                  const blob = await res.blob();
                                  const url = window.URL.createObjectURL(blob);
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
                              <Button variant="outline" className="flex-1 border-border bg-muted text-foreground hover:bg-primary/10 dark:bg-slate-900/60 dark:text-white dark:hover:bg-blue-900/40" onClick={async () => {
                                if (!selectedJob || !customDateRange || !customTimeRange) return;
                                try {
                                  const videoStart = new Date(selectedJob.start_datetime);
                                  const startDate = new Date(customDateRange.start);
                                  startDate.setHours(...customTimeRange.start.split(":").map(Number));
                                  const endDate = new Date(customDateRange.end);
                                  endDate.setHours(...customTimeRange.end.split(":").map(Number));
                                  const startTimeInSeconds = (startDate - videoStart) / 1000;
                                  const endTimeInSeconds = (endDate - videoStart) / 1000;
                                  const res = await fetch(`/api/heatmap_jobs/${selectedJob.job_id}/custom_export/png?start_time=${startTimeInSeconds}&end_time=${endTimeInSeconds}`);
                                  if (!res.ok) throw new Error('Failed to export PNG');
                                  const blob = await res.blob();
                                  const url = window.URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = `custom_heatmap_${selectedJob.job_id}.png`;
                                  document.body.appendChild(a);
                                  a.click();
                                  a.remove();
                                  window.URL.revokeObjectURL(url);
                                } catch (err) {
                                  toast.error('Failed to export PNG');
                                }
                              }}>
                                Export PNG
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
                                      (idx === 2 && !customGenerationComplete)
                                    ) return;
                                    setCustomStep(idx);
                                  }}
                                  disabled={
                                    (idx === 1 && (!customDateRange || !customTimeRange || !isValidDateTime)) ||
                                    (idx === 2 && !customGenerationComplete) ||
                                    (idx > customStep + 1) // Prevent skipping steps
                                  }
                                >
                                  {idx + 1}
                                </PaginationLink>
                              </PaginationItem>
                            ))}
                            <PaginationItem>
                              <PaginationNext href="#" onClick={() => setCustomStep(customStep + 1)} disabled={customStep === totalCustomSteps - 1} />
                            </PaginationItem>
                          </PaginationContent>
                        </Pagination>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
          {/* Row 2: Analytics Section */}
          <Card className="w-full h-full bg-gradient-to-br from-background/80 to-muted/90 dark:from-slate-900/80 dark:to-slate-950/90 border border-border shadow-2xl shadow-primary/10 backdrop-blur-xl rounded-xl p-8 flex flex-col">
            <div className="grid grid-cols-4 grid-rows-2 gap-6 h-full">
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
              <div className="col-span-1 row-span-1 h-full flex flex-col">
                <CardHeader className="flex flex-row items-center gap-2">
                  <Users className="text-blue-400 h-7 w-7 mb-2 drop-shadow" />
                  <CardTitle className="text-base font-semibold text-foreground whitespace-nowrap text-center">Total Visitors</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center flex-1">
                  {analysisLoading ? (
                    <p className="text-blue-400">Loading...</p>
                  ) : (
                    <p className="text-3xl font-bold text-blue-400">{analysis?.total_visitors ?? 0}</p>
                  )}
                </CardContent>
              </div>
              {/* Traffic Distribution: col 3-4, row 1 */}
              <div className="col-span-2 row-span-1 h-full flex flex-col">
                <CardHeader className="flex flex-row items-center gap-2">
                  <BarChart2 className="text-cyan-400 h-7 w-7 mb-2 drop-shadow" />
                  <CardTitle className="text-base font-semibold text-foreground whitespace-nowrap text-center">Traffic Distribution</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex items-center">
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
              </div>
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
                  <CardTitle className="text-base font-semibold text-foreground whitespace-nowrap text-center">{analysis?.peak_hour_label ? 'Peak Hour' : 'Peak Minute'}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center">
                  {analysisLoading ? (
                    <p className="text-purple-400">Loading...</p>
                  ) : analysis?.peak_hour_label ? (
                    <>
                      <span className="text-3xl font-bold text-purple-400 mb-1">{analysis.peak_hour_label}</span>
                      <span className="text-xs text-muted-foreground">Peak Hour</span>
                    </>
                  ) : (
                    <>
                      <span className="text-3xl font-bold text-purple-400 mb-1">{(analysis?.peak_minutes && analysis.peak_minutes.length > 0) ? `${analysis.peak_minutes[0].minute}` : 'N/A'}</span>
                      <span className="text-xs text-muted-foreground">Peak Minute</span>
                    </>
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