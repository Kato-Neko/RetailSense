"use client"

import { useState, useEffect, useMemo, Fragment } from "react"
import { Link } from "react-router-dom"
import { BarChart as ReBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceArea } from "recharts"
import { Video, Map, Users, Clock } from "lucide-react"
import { heatmapService } from "../services/api"
import toast from "react-hot-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart"
import { LineChart as ReLineChart, Line } from "recharts"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import jsPDF from 'jspdf';
import domtoimage from 'dom-to-image';

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalVisitors: 0,
    peakHour: "N/A",
    processedVideos: 0,
    generatedHeatmaps: 0,
  })

  const [trafficData, setTrafficData] = useState([])
  const [recentJobs, setRecentJobs] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeChart, setActiveChart] = useState("daily")
  const [weeklyData, setWeeklyData] = useState([])
  const [monthlyData, setMonthlyData] = useState([])

  // Turbo colormap-inspired gradient (24 colors, blue to red)
  const turboColors = [
    "#30123b", "#4146a1", "#2777b6", "#1ea2b8", "#2ccf8e", "#7be04a",
    "#d6e13b", "#ffe14b", "#ffb340", "#ff7a36", "#f43e2e", "#c51c27",
    "#8e0b25", "#5a0822", "#30123b", "#4146a1", "#2777b6", "#1ea2b8",
    "#2ccf8e", "#7be04a", "#d6e13b", "#ffe14b", "#ffb340", "#ff7a36"
  ];

  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true)
      try {
        // Fetch job history
        const jobHistory = await heatmapService.getJobHistory()

        // Set recent jobs (most recent 3)
        const recent = jobHistory.slice(0, 3).map((job) => ({
          id: job.job_id,
          type: job.input_video_name ? "video" : "heatmap",
          name: job.input_video_name || job.input_floorplan_name || "Job",
          status: job.status,
          time: new Date(job.created_at).toLocaleString(),
          startDatetime: new Date(job.start_datetime),
          endDatetime: new Date(job.end_datetime),
        }))
        setRecentJobs(recent)

        // Calculate stats from job history
        const completedJobs = jobHistory.filter((job) => job.status === "completed")
        // Only count completed video jobs for Processed Videos
        const processedVideos = jobHistory.filter(
          job => job.input_video_name && job.status === "completed"
        ).length;
        const heatmapCount = completedJobs.length

        // For this demo, we'll estimate visitor count based on completed jobs
        const estimatedVisitors = heatmapCount * 150 + Math.floor(Math.random() * 200)

        setStats({
          totalVisitors: estimatedVisitors,
          peakHour: "14:00-15:00", // This would ideally come from real analysis
          processedVideos: processedVideos,
          generatedHeatmaps: heatmapCount,
        })

        // Prepare traffic counts and unique visitor set
        const trafficCounts = {}
        let totalUniqueVisitors = new Set()
        let hourlyUniqueVisitors = Array.from({ length: 24 }, () => new Set())

        for (const job of completedJobs) {
          // Fetch detections from the new API endpoint
          try {
            const detectionsResponse = await heatmapService.getDetections(job.job_id)
            console.log("Detections Response:", detectionsResponse)

            if (detectionsResponse && detectionsResponse.detections) {
              const detections = detectionsResponse.detections
              const fps = detectionsResponse.fps
              const startDate = job.start_datetime ? new Date(job.start_datetime) : null

              detections.forEach((det) => {
                const trackId = det.track_id
                const timeInSeconds = det.timestamp || (det.frame / fps)
                const detectionTime = startDate ? new Date(startDate.getTime() + timeInSeconds * 1000) : null
                const hour = detectionTime ? detectionTime.getHours() : null

                if (trackId && hour !== null) {
                  totalUniqueVisitors.add(`${job.job_id}_${trackId}`) // Ensure uniqueness across jobs
                  hourlyUniqueVisitors[hour].add(`${job.job_id}_${trackId}`)
                }
              })
            } else {
              console.warn(`No detections found for job ${job.job_id}`)
              toast.warn(`No detections found for job ${job.job_id}`)
            }
          } catch (error) {
            console.error(`Error fetching detections for job ${job.job_id}:`, error)
            let errorMessage = `Failed to load detections for job ${job.job_id}`
            if (error.response && error.response.status) {
              errorMessage += ` (Status: ${error.response.status})`
            }
            toast.error(errorMessage)
          }
        }

        // Prepare data for the chart
        const visitorCounts = hourlyUniqueVisitors.map(set => set.size)
        const maxVisitors = Math.max(...visitorCounts)
        const minVisitors = Math.min(...visitorCounts)

        // Find peak hour
        let peakHourIdx = 0
        let peakHourValue = 0
        hourlyUniqueVisitors.forEach((set, idx) => {
          if (set.size > peakHourValue) {
            peakHourValue = set.size
            peakHourIdx = idx
          }
        })
        const peakHourLabel = `${peakHourIdx.toString().padStart(2, "0")}:00-${(peakHourIdx + 1).toString().padStart(2, "0")}:00`

        const trafficData = Array.from({ length: 24 }, (_, hour) => {
          const value = hourlyUniqueVisitors[hour].size
          // Normalize value to 0-1
          const t = maxVisitors === minVisitors ? 0 : (value - minVisitors) / (maxVisitors - minVisitors)
          // Map to turbo color index
          let colorIdx = Math.round(t * (turboColors.length - 2)) // -2 so peak can be last color
          // Peak hour gets the reddest color
          if (hour === peakHourIdx && value > 0) colorIdx = turboColors.length - 1
          return {
            hour: hour.toString().padStart(2, "0") + ":00",
            visitors: value,
            fill: turboColors[colorIdx]
          }
        })

        setTrafficData(trafficData)
        setStats((prev) => ({
          ...prev,
          totalVisitors: totalUniqueVisitors.size,
          peakHour: maxVisitors > 0 ? peakHourLabel : "N/A",
        }))

        // --- Weekly Data ---
        // Group detections by day of week (0=Sun, 6=Sat)
        let weeklyUniqueVisitors = Array.from({ length: 7 }, () => new Set())
        for (const job of completedJobs) {
          try {
            const detectionsResponse = await heatmapService.getDetections(job.job_id)
            if (detectionsResponse && detectionsResponse.detections) {
              const detections = detectionsResponse.detections
              const fps = detectionsResponse.fps
              const startDate = job.start_datetime ? new Date(job.start_datetime) : null
              detections.forEach((det) => {
                const trackId = det.track_id
                const timeInSeconds = det.timestamp || (det.frame / fps)
                const detectionTime = startDate ? new Date(startDate.getTime() + timeInSeconds * 1000) : null
                const day = detectionTime ? detectionTime.getDay() : null
                if (trackId && day !== null) {
                  weeklyUniqueVisitors[day].add(`${job.job_id}_${trackId}`)
                }
              })
            }
          } catch {}
        }
        const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
        const weeklyDataArr = weekDays.map((day, idx) => ({
          day,
          visitors: weeklyUniqueVisitors[idx].size,
        }))
        setWeeklyData(weeklyDataArr)

        // --- Monthly Data ---
        // Group detections by month (0=Jan, 11=Dec)
        let monthlyUniqueVisitors = Array.from({ length: 12 }, () => new Set())
        for (const job of completedJobs) {
          try {
            const detectionsResponse = await heatmapService.getDetections(job.job_id)
            if (detectionsResponse && detectionsResponse.detections) {
              const detections = detectionsResponse.detections
              const fps = detectionsResponse.fps
              const startDate = job.start_datetime ? new Date(job.start_datetime) : null
              detections.forEach((det) => {
                const trackId = det.track_id
                const timeInSeconds = det.timestamp || (det.frame / fps)
                const detectionTime = startDate ? new Date(startDate.getTime() + timeInSeconds * 1000) : null
                const month = detectionTime ? detectionTime.getMonth() : null
                if (trackId && month !== null) {
                  monthlyUniqueVisitors[month].add(`${job.job_id}_${trackId}`)
                }
              })
            }
          } catch {}
        }
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        const monthlyDataArr = monthNames.map((month, idx) => ({
          month,
          visitors: monthlyUniqueVisitors[idx].size,
        }))
        setMonthlyData(monthlyDataArr)
      } catch (error) {
        console.error("Error fetching dashboard data:", error)
        toast.error("Failed to load dashboard data")
      } finally {
        setIsLoading(false)
      }
    }

    fetchDashboardData()

    // Listen for custom dashboard-refresh event to trigger refresh
    const handleRefresh = () => {
      fetchDashboardData();
    };
    window.addEventListener('dashboard-refresh', handleRefresh);

    // Listen for jobDeleted event to refresh dashboard data
    const handleJobDeleted = () => {
      fetchDashboardData();
    };
    window.addEventListener('jobDeleted', handleJobDeleted);

    return () => {
      window.removeEventListener('dashboard-refresh', handleRefresh);
      window.removeEventListener('jobDeleted', handleJobDeleted);
    };
  }, [])

  // Compute turbo color for each point in daily and weekly chart
  const getTurboColor = (value, min, max) => {
    const t = max === min ? 0 : (value - min) / (max - min)
    let colorIdx = Math.round(t * (turboColors.length - 1))
    return turboColors[colorIdx]
  }

  const dailyLineData = useMemo(() => {
    if (!trafficData.length) return []
    const values = trafficData.map(d => d.visitors)
    const min = Math.min(...values)
    const max = Math.max(...values)
    return trafficData.map((d) => ({
      ...d,
      dotColor: getTurboColor(d.visitors, min, max),
    }))
  }, [trafficData, turboColors])

  const weeklyLineData = useMemo(() => {
    if (!weeklyData.length) return []
    const values = weeklyData.map(d => d.visitors)
    const min = Math.min(...values)
    const max = Math.max(...values)
    return weeklyData.map((d) => ({
      ...d,
      dotColor: getTurboColor(d.visitors, min, max),
    }))
  }, [weeklyData, turboColors])

  const monthlyBarData = useMemo(() => {
    if (!monthlyData.length) return []
    const values = monthlyData.map(d => d.visitors)
    const min = Math.min(...values)
    const max = Math.max(...values)
    return monthlyData.map((d) => ({
      ...d,
      fill: getTurboColor(d.visitors, min, max),
    }))
  }, [monthlyData, turboColors])

  // Helper to create a turbo-gradient SVG path for the line chart
  function TurboLinePath({ data, xAccessor, yAccessor, colorAccessor }) {
    if (!data || data.length < 2) return null
    let path = ""
    let prev = null
    const segments = []
    data.forEach((point, i) => {
      const x = xAccessor(point, i)
      const y = yAccessor(point, i)
      if (prev) {
        segments.push({
          x1: prev.x,
          y1: prev.y,
          x2: x,
          y2: y,
          color: colorAccessor(point, i)
        })
      }
      prev = { x, y }
    })
    return (
      <g>
        {segments.map((seg, i) => (
          <line
            key={"turbo-seg-" + i}
            x1={seg.x1}
            y1={seg.y1}
            x2={seg.x2}
            y2={seg.y2}
            stroke={seg.color}
            strokeWidth={2.5}
            fill="none"
          />
        ))}
      </g>
    )
  }

  // Function to cancel a job and refresh dashboard
  const handleCancelJob = async (jobId) => {
    try {
      await heatmapService.cancelJob(jobId);
      toast.success('Job cancelled!');
      // Immediately refresh dashboard data
      fetchDashboardData();
    } catch (err) {
      toast.error('Failed to cancel job.');
    }
  };

  // Placeholder values for store/project, user, and date range
  const storeName = 'N/A'; // Replace with actual value if available
  const userEmail = 'N/A'; // Replace with actual value if available
  const dateRange = 'N/A'; // Replace with actual value if available

  // Export chart data as CSV (summary stats + chart data, excluding 'fill' and 'dotColor')
  const exportCSV = () => {
    let data = [];
    if (activeChart === 'daily') data = dailyLineData;
    else if (activeChart === 'weekly') data = weeklyLineData;
    else if (activeChart === 'monthly') data = monthlyBarData;
    if (!data.length) return toast.error('No data to export.');
    // Exclude 'fill' and 'dotColor' fields
    const header = Object.keys(data[0]).filter(h => h !== 'fill' && h !== 'dotColor');
    const csvRows = [];
    // Add export date/time as first row
    const exportDate = new Date().toLocaleString();
    csvRows.push('Exported At,' + exportDate);
    // Add summary stats as next rows
    csvRows.push('Total Visitors,' + stats.totalVisitors);
    csvRows.push('Peak Hour,' + stats.peakHour);
    csvRows.push('Processed Videos,' + stats.processedVideos);
    csvRows.push('Generated Heatmaps,' + stats.generatedHeatmaps);
    csvRows.push(''); // Empty row
    csvRows.push(header.join(','));
    data.forEach(row => {
      csvRows.push(header.map(h => row[h]).join(','));
    });
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `foot_traffic_${activeChart}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export chart as PDF (summary stats + chart image, using dom-to-image to avoid color issues)
  const exportPDF = async () => {
    const chartCard = document.getElementById('foot-traffic-chart-card');
    if (!chartCard) return toast.error('Chart not found.');
    const chartArea = chartCard.querySelector('.ChartContainer') || chartCard;
    try {
      // Use dom-to-image to get a PNG of the chart
      const imgData = await domtoimage.toPng(chartArea, { bgcolor: '#fff' });
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      let y = 40;
      pdf.setFontSize(18);
      pdf.text('Foot Traffic Analytics', 40, y);
      // Add export date/time below the title
      pdf.setFontSize(11);
      const exportDate = new Date().toLocaleString();
      y += 18;
      pdf.text(`Exported At: ${exportDate}`, 40, y);
      pdf.setFontSize(12);
      y += 22;
      pdf.text(`Total Visitors: ${stats.totalVisitors}`, 40, y);
      y += 20;
      pdf.text(`Peak Hour: ${stats.peakHour}`, 40, y);
      y += 20;
      pdf.text(`Processed Videos: ${stats.processedVideos}`, 40, y);
      y += 20;
      pdf.text(`Generated Heatmaps: ${stats.generatedHeatmaps}`, 40, y);
      y += 20;
      // Add chart image
      const img = new window.Image();
      img.src = imgData;
      img.onload = () => {
        const imgWidth = pageWidth - 80;
        const imgHeight = (img.height * imgWidth) / img.width;
        pdf.addImage(img, 'PNG', 40, y, imgWidth, imgHeight);
        pdf.save(`foot_traffic_${activeChart}.pdf`);
      };
    } catch (err) {
      toast.error('Failed to export PDF');
      console.error(err);
    }
  };

  return (
    <div className="relative h-[800px] w-full bg-background dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 py-7 px-1 md:px-0 overflow-x-hidden">
      {/* Soft background blur and gradient effects */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-32 -left-32 w-80 h-80 bg-blue-400/20 dark:bg-blue-700/20 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 right-0 w-64 h-64 bg-cyan-300/20 dark:bg-cyan-500/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-1/2 w-80 h-80 bg-fuchsia-300/10 dark:bg-fuchsia-700/10 rounded-full blur-3xl"></div>
      </div>
      <div className="container relative z-10 mx-auto max-w-6xl h-[400px]">
      {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-8">
          <Card className="bg-gradient-to-br from-primary/30 to-background/80 border-none shadow-xl shadow-primary/20 backdrop-blur-md flex flex-col items-center py-5 rounded-xl transition-transform hover:scale-[1.02] hover:shadow-primary/30">
            <Users className="text-primary h-7 w-7 mb-2 drop-shadow" />
            <span className="text-2xl font-extrabold text-foreground drop-shadow-lg">{isLoading ? "..." : stats.totalVisitors}</span>
            <span className="text-xs text-muted-foreground mt-1 tracking-wide">Total Visitors</span>
        </Card>
          <Card className="bg-gradient-to-br from-yellow-400/30 to-background/80 border-none shadow-xl shadow-yellow-400/20 backdrop-blur-md flex flex-col items-center py-5 rounded-xl transition-transform hover:scale-[1.02] hover:shadow-yellow-400/30">
            <Clock className="text-yellow-400 h-7 w-7 mb-2 drop-shadow" />
            <span className="text-2xl font-extrabold text-foreground drop-shadow-lg">{isLoading ? "..." : stats.peakHour}</span>
            <span className="text-xs text-muted-foreground mt-1 tracking-wide">Peak Hour</span>
        </Card>
          <Card className="bg-gradient-to-br from-cyan-400/30 to-background/80 border-none shadow-xl shadow-cyan-400/20 backdrop-blur-md flex flex-col items-center py-5 rounded-xl transition-transform hover:scale-[1.02] hover:shadow-cyan-400/30">
            <Video className="text-cyan-400 h-7 w-7 mb-2 drop-shadow" />
            <span className="text-2xl font-extrabold text-foreground drop-shadow-lg">{isLoading ? "..." : stats.processedVideos}</span>
            <span className="text-xs text-muted-foreground mt-1 tracking-wide">Processed Videos</span>
        </Card>
          <Card className="bg-gradient-to-br from-green-400/30 to-background/80 border-none shadow-xl shadow-green-400/20 backdrop-blur-md flex flex-col items-center py-5 rounded-xl transition-transform hover:scale-[1.02] hover:shadow-green-400/30">
            <Map className="text-green-400 h-7 w-7 mb-2 drop-shadow" />
            <span className="text-2xl font-extrabold text-foreground drop-shadow-lg">{isLoading ? "..." : stats.generatedHeatmaps}</span>
            <span className="text-xs text-muted-foreground mt-1 tracking-wide">Generated Heatmaps</span>
        </Card>
      </div>
        {/* Section Divider */}
        <div className="w-full h-px bg-border bg-gradient-to-r from-primary/20 via-muted/10 to-cyan-400/20 mb-7" />
      {/* Main Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-7 h-[400px]">
        {/* Chart Card */}
          <Card id="foot-traffic-chart-card" className="col-span-2 bg-gradient-to-br from-background/80 to-muted/90 dark:from-slate-900/80 dark:to-slate-950/90 border border-border shadow-2xl shadow-primary/10 backdrop-blur-xl rounded-xl">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold text-foreground tracking-tight drop-shadow mb-2 inline-block">Foot Traffic Analytics</CardTitle>
                {/* Always show the filter (ToggleGroup) inline with the title */}
                <div className="mt-2 flex justify-center">
                  <ToggleGroup
                    type="single"
                    value={activeChart}
                    onValueChange={val => val && setActiveChart(val)}
                    variant="outline"
                    size="default"
                    className="bg-muted/60 border border-border rounded-lg overflow-hidden shadow-md"
                  >
                    <ToggleGroupItem value="daily" className={"px-4 py-1 text-xs font-semibold transition-all rounded-md " + (activeChart === "daily"
                      ? "bg-gradient-to-r from-white to-cyan-100 text-black border border-border dark:from-blue-900 dark:to-cyan-800 dark:text-white"
                      : "text-black bg-transparent hover:bg-muted/60 border border-transparent dark:text-white dark:bg-white/10 dark:hover:bg-white/20")}>Daily</ToggleGroupItem>
                    <ToggleGroupItem value="weekly" className={"px-4 py-1 text-xs font-semibold transition-all rounded-md " + (activeChart === "weekly"
                      ? "bg-gradient-to-r from-white to-cyan-100 text-black border border-border dark:from-blue-900 dark:to-cyan-800 dark:text-white"
                      : "text-black bg-transparent hover:bg-muted/60 border border-transparent dark:text-white dark:bg-white/10 dark:hover:bg-white/20")}>Weekly</ToggleGroupItem>
                    <ToggleGroupItem value="monthly" className={"px-4 py-1 text-xs font-semibold transition-all rounded-md " + (activeChart === "monthly"
                      ? "bg-gradient-to-r from-white to-cyan-100 text-black border border-border dark:from-blue-900 dark:to-cyan-800 dark:text-white"
                      : "text-black bg-transparent hover:bg-muted/60 border border-transparent dark:text-white dark:bg-white/10 dark:hover:bg-white/20")}>Monthly</ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </div>
              <div className="flex gap-2 items-center ml-auto">
                <Button size="sm" variant="outline" className="text-xs" onClick={exportCSV}>Export CSV</Button>
                <Button size="sm" variant="outline" className="text-xs" onClick={exportPDF}>Export PDF</Button>
              </div>
            </CardHeader>
            <CardContent className="h-85 flex items-center justify-center">
            {isLoading ? (
              <div className="text-muted-foreground">Loading chart data...</div>
            ) : (
                <ChartContainer
                  className="w-full h-full bg-gradient-to-br from-background/80 to-muted/80 dark:from-slate-950/80 dark:to-slate-900/80 rounded-xl border border-border shadow-xl p-2 backdrop-blur-md"
                  config={{
                    visitors: {
                      color: turboColors[turboColors.length - 1],
                      label: "Visitors",
                    },
                  }}
                >
                  {activeChart === "daily" && (
                    <ReLineChart data={dailyLineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="turbo-gradient-daily" x1="0" y1="0" x2="1" y2="0">
                          {dailyLineData.map((d, i) => (
                            <stop
                              key={i}
                              offset={`${(i / (dailyLineData.length - 1)) * 100}%`}
                              stopColor={d.dotColor}
                            />
                          ))}
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                      <XAxis dataKey="hour" stroke="#ffb300" tick={{ fontSize: 12, fill: '#ffb300' }} />
                      <YAxis stroke="#ffb300" tick={{ fontSize: 12, fill: '#ffb300' }} label={{ value: 'Visitors', angle: -90, position: 'insideLeft', fill: '#ffb300', fontSize: 14, dy: -10 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                <Line 
                  type="monotone" 
                  dataKey="visitors" 
                        stroke="url(#turbo-gradient-daily)"
                        strokeWidth={2.5}
                  dot={false}
                        activeDot={({ cx, cy, payload, index }) => (
                          <circle key={"dot-active-" + index} cx={cx} cy={cy} r={7} fill={payload.dotColor} stroke="#fff" strokeWidth={2} />
                        )}
                        isAnimationActive={true}
                        connectNulls
                      />
                      <ChartLegend content={<ChartLegendContent />} />
                    </ReLineChart>
                  )}
                  {activeChart === "weekly" && (
                    <ReLineChart data={weeklyLineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="turbo-gradient-weekly" x1="0" y1="0" x2="1" y2="0">
                          {weeklyLineData.map((d, i) => (
                            <stop
                              key={i}
                              offset={`${(i / (weeklyLineData.length - 1)) * 100}%`}
                              stopColor={d.dotColor}
                            />
                          ))}
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                      <XAxis dataKey="day" stroke="#3b82f6" tick={{ fontSize: 12, fill: '#3b82f6' }} />
                      <YAxis stroke="#3b82f6" tick={{ fontSize: 12, fill: '#3b82f6' }} label={{ value: 'Visitors', angle: -90, position: 'insideLeft', fill: '#3b82f6', fontSize: 14, dy: -10 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line
                        type="monotone" 
                        dataKey="visitors" 
                        stroke="url(#turbo-gradient-weekly)"
                        strokeWidth={2.5}
                        dot={false}
                        activeDot={({ cx, cy, payload, index }) => (
                          <circle key={"dot-active-" + index} cx={cx} cy={cy} r={7} fill={payload.dotColor} stroke="#fff" strokeWidth={2} />
                        )}
                        isAnimationActive={true}
                        connectNulls
                      />
                      <ChartLegend content={<ChartLegendContent />} />
                    </ReLineChart>
                  )}
                  {activeChart === "monthly" && (
                    <ReBarChart data={monthlyBarData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                      <XAxis dataKey="month" stroke="#ff6f00" tick={{ fontSize: 12, fill: '#ff6f00' }} />
                      <YAxis stroke="#ff6f00" tick={{ fontSize: 12, fill: '#ff6f00' }} label={{ value: 'Visitors', angle: -90, position: 'insideLeft', fill: '#ff6f00', fontSize: 14, dy: -10 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="visitors" radius={[6, 6, 0, 0]}>
                        {monthlyBarData.map((entry, idx) => (
                          <Cell key={idx} fill={entry.fill} />
                        ))}
                      </Bar>
                      <ChartLegend content={<ChartLegendContent />} />
                </ReBarChart>
                  )}
                </ChartContainer>
                )}
              </CardContent>
            </Card>
        {/* Actions & Recent Activity Card */}
          <Card className="bg-gradient-to-br from-background/80 to-muted/90 dark:from-slate-900/80 dark:to-slate-950/90 border border-border shadow-xl shadow-primary/10 backdrop-blur-xl rounded-xl flex flex-col">
        <CardHeader>
              <CardTitle className="text-base font-bold text-foreground tracking-tight drop-shadow mb-2">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
              <div className="flex flex-col gap-3 mb-6">
                <Button
                  asChild
                  className="w-full bg-gradient-to-r from-white to-cyan-200 text-black font-semibold shadow-md border border-border py-2 text-sm hover:opacity-90 dark:from-white/10 dark:to-cyan-400/30 dark:text-white"
                >
              <Link to="/video-processing">
                <Video className="mr-2 h-5 w-5" /> Process New Video
              </Link>
            </Button>
                <Button
                  asChild
                  className="w-full bg-gradient-to-r from-cyan-100 to-green-200 text-black font-semibold shadow-md border border-border py-2 text-sm hover:opacity-90 dark:from-cyan-400/30 dark:to-green-400/30 dark:text-white"
                >
              <Link to="/heatmap-generation">
                <Map className="mr-2 h-5 w-5" /> Generate Heatmap
              </Link>
            </Button>
          </div>
          <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">Recent Activity</h3>
            {isLoading ? (
                <div className="text-muted-foreground">Loading recent activity...</div>
            ) : recentJobs.length > 0 ? (
                  <div className="space-y-2">
                {recentJobs.map((job) => (
                      <div key={job.id} className="flex items-center gap-3 bg-muted/70 rounded-lg px-3 py-2 shadow-sm hover:shadow-lg transition-shadow">
                        <div
                          className={`w-2 h-2 rounded-full mt-1 ${job.status === "completed" ? "bg-green-400" : job.status === "error" ? "bg-red-400" : job.status === "cancelled" ? "bg-yellow-400" : "bg-blue-400"}`}
                        ></div>
                    <div className="flex-1 min-w-0">
                          <div className="text-xs text-foreground truncate max-w-[140px]">
                        {job.status === "completed"
                          ? `Completed "${job.name}"`
                          : job.status === "error"
                          ? `Error processing "${job.name}"`
                          : job.status === "cancelled"
                          ? `Cancelled "${job.name}"`
                          : `Processing "${job.name}"`}
                      </div>
                        <div className="text-xs text-muted-foreground">{job.time}</div>
                    </div>
                    {/* Show Cancel button only for processing jobs */}
                    {job.status === "processing" && (
                      <Button
                        size="sm"
                        variant="destructive"
                        className="ml-2 px-2 py-1 text-xs"
                        onClick={() => handleCancelJob(job.id)}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
                  <p className="text-muted-foreground text-xs">
                    No recent activity found. Start by processing a video or generating a heatmap.
                  </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
    </div>
    </div>
  )
}

export default Dashboard
