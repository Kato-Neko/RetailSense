"use client"

import { useState, useEffect, useMemo, Fragment } from "react"
import { Link, useLocation } from "react-router-dom"
import { BarChart as ReBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceArea } from "recharts"
import { Video, Map, Users, Clock, Download, Check } from "lucide-react"
import { heatmapService } from "../services/api"
import toast from "react-hot-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart"
import { LineChart as ReLineChart, Line } from "recharts"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import jsPDF from 'jspdf';
import domtoimage from 'dom-to-image';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

const Dashboard = () => {
  const location = useLocation()
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
  const [exportOpen, setExportOpen] = useState(false)
  const [exportValue, setExportValue] = useState("")
  const [comparisonMode, setComparisonMode] = useState(false)
  const [comparisonStats, setComparisonStats] = useState({ totalVisitors: 0, peakHour: "N/A" })
  const [comparisonData, setComparisonData] = useState({ daily: [], weekly: [], monthly: [] })

  // Turbo colormap-inspired gradient (24 colors, blue to red)
  const turboColors = [
    "#30123b", "#4146a1", "#2777b6", "#1ea2b8", "#2ccf8e", "#7be04a",
    "#d6e13b", "#ffe14b", "#ffb340", "#ff7a36", "#f43e2e", "#c51c27",
    "#8e0b25", "#5a0822", "#30123b", "#4146a1", "#2777b6", "#1ea2b8",
    "#2ccf8e", "#7be04a", "#d6e13b", "#ffe14b", "#ffb340", "#ff7a36"
  ];

  const exportOptions = [
    {
      value: "csv",
      label: "Export as CSV",
    },
    {
      value: "pdf",
      label: "Export as PDF",
    },
  ]

  const handleExport = (value) => {
    if (value === "csv") {
      exportCSV();
    } else if (value === "pdf") {
      exportPDF();
    }
    setExportOpen(false);
  };

  // Helper function to get date ranges for current and previous periods
  const getDateRanges = () => {
    const now = new Date()
    
    if (activeChart === "daily") {
      // Today vs yesterday (same hours of day)
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const currentStart = today
      const currentEnd = now
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
      const yesterdayEnd = new Date(yesterday.getTime() + (now.getTime() - today.getTime()))
      const comparisonStart = yesterday
      const comparisonEnd = yesterdayEnd
      return { currentStart, currentEnd, comparisonStart, comparisonEnd }
    } else if (activeChart === "weekly") {
      // Last 7 days vs previous 7 days
      const currentStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      const currentEnd = now
      const comparisonStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
      const comparisonEnd = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      return { currentStart, currentEnd, comparisonStart, comparisonEnd }
    } else if (activeChart === "monthly") {
      // This month vs last month
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const currentStart = new Date(today.getFullYear(), today.getMonth(), 1)
      const currentEnd = now
      const comparisonStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const comparisonEnd = new Date(today.getFullYear(), today.getMonth(), 0)
      return { currentStart, currentEnd, comparisonStart, comparisonEnd }
    }
    return { currentStart: now, currentEnd: now, comparisonStart: now, comparisonEnd: now }
  }

  const processJobHistory = async (jobHistory, comparisonMode, getDateRanges) => {
    const recent = jobHistory.slice(0, 3).map((job) => ({
      id: job.job_id,
      type: job.input_video_name ? "video" : "heatmap",
      name: job.input_video_name || job.input_floorplan_name || "Job",
      status: job.status,
      time: new Date(job.created_at).toLocaleString(),
      startDatetime: new Date(job.start_datetime),
      endDatetime: new Date(job.end_datetime),
    }));

    let allCompletedJobs = jobHistory.filter((job) => job.status === "completed");
    
    let completedJobs = allCompletedJobs;
    if (comparisonMode) {
      const { currentStart, currentEnd } = getDateRanges();
      completedJobs = allCompletedJobs.filter(job => {
        const jobStartDateTime = job.start_datetime ? new Date(job.start_datetime) : new Date(job.created_at);
        return jobStartDateTime >= currentStart && jobStartDateTime < currentEnd;
      });
    }
    
    const processedVideos = jobHistory.filter(
      job => job.input_video_name && job.status === "completed"
    ).length;
    const heatmapCount = allCompletedJobs.length;

    const initialStats = {
      totalVisitors: 0,
      peakHour: "14:00-15:00",
      processedVideos: processedVideos,
      generatedHeatmaps: heatmapCount,
    };

    let totalUniqueVisitors = new Set();
    let hourlyUniqueVisitors = Array.from({ length: 24 }, () => new Set());
    let weeklyUniqueVisitors = Array.from({ length: 7 }, () => new Set());
    let monthlyUniqueVisitors = Array.from({ length: 12 }, () => new Set());

    for (const job of completedJobs) {
      try {
        const detectionsResponse = await heatmapService.getDetections(job.job_id);
        if (detectionsResponse && detectionsResponse.detections && detectionsResponse.detections.length > 0) {
          const detections = detectionsResponse.detections;
          const fps = detectionsResponse.fps;
          const startDate = job.start_datetime ? new Date(job.start_datetime) : null;

          detections.forEach((det) => {
            const trackId = det.track_id;
            const timeInSeconds = det.timestamp || (det.frame / fps);
            const detectionTime = startDate ? new Date(startDate.getTime() + timeInSeconds * 1000) : null;
            const hour = detectionTime ? detectionTime.getHours() : null;
            const day = detectionTime ? detectionTime.getDay() : null;
            const month = detectionTime ? detectionTime.getMonth() : null;

            if (trackId && hour !== null) {
              totalUniqueVisitors.add(`${job.job_id}_${trackId}`);
              hourlyUniqueVisitors[hour].add(`${job.job_id}_${trackId}`);
            }
            if (trackId && day !== null) {
              weeklyUniqueVisitors[day].add(`${job.job_id}_${trackId}`);
            }
            if (trackId && month !== null) {
              monthlyUniqueVisitors[month].add(`${job.job_id}_${trackId}`);
            }
          });
        }
      } catch (error) {
        if (error.response && error.response.status !== 404) {
          console.error(`Error fetching detections for job ${job.job_id}:`, error);
        }
      }
    }

    const visitorCounts = hourlyUniqueVisitors.map(set => set.size);
    const maxVisitors = Math.max(...visitorCounts);
    const minVisitors = Math.min(...visitorCounts);

    let peakHourIdx = 0;
    let peakHourValue = 0;
    hourlyUniqueVisitors.forEach((set, idx) => {
      if (set.size > peakHourValue) {
        peakHourValue = set.size;
        peakHourIdx = idx;
      }
    });
    const peakHourLabel = `${peakHourIdx.toString().padStart(2, "0")}:00-${(peakHourIdx + 1).toString().padStart(2, "0")}:00`;

    const trafficData = Array.from({ length: 24 }, (_, hour) => {
      const value = hourlyUniqueVisitors[hour].size;
      const t = maxVisitors === minVisitors ? 0 : (value - minVisitors) / (maxVisitors - minVisitors);
      let colorIdx = Math.round(t * (turboColors.length - 2));
      if (hour === peakHourIdx && value > 0) colorIdx = turboColors.length - 1;
      return {
        hour: hour.toString().padStart(2, "0") + ":00",
        visitors: value,
        fill: turboColors[colorIdx]
      };
    });

    const finalStats = {
      ...initialStats,
      totalVisitors: totalUniqueVisitors.size,
      peakHour: maxVisitors > 0 ? peakHourLabel : "N/A",
    };

    const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const weeklyDataArr = weekDays.map((day, idx) => ({
      day,
      visitors: weeklyUniqueVisitors[idx].size,
    }));

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthlyDataArr = monthNames.map((month, idx) => ({
      month,
      visitors: monthlyUniqueVisitors[idx].size,
    }));

    return { recent, stats: finalStats, trafficData, weeklyData: weeklyDataArr, monthlyData: monthlyDataArr };
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      try {
        const jobHistory = await heatmapService.getJobHistory();
        const { recent, stats, trafficData, weeklyData, monthlyData } = await processJobHistory(jobHistory, comparisonMode, getDateRanges);

        setRecentJobs(recent);
        setStats(stats);
        setTrafficData(trafficData);
        setWeeklyData(weeklyData);
        setMonthlyData(monthlyData);

        // Clear comparison data if comparison mode is off
        if (!comparisonMode) {
          setComparisonData({ daily: [], weekly: [], monthly: [] });
          setComparisonStats({ totalVisitors: 0, peakHour: "N/A" });
        } else {
          try {
            const { comparisonStart, comparisonEnd } = getDateRanges();
            const comparisonJobs = jobHistory.filter(job => {
              const jobStartDateTime = job.start_datetime ? new Date(job.start_datetime) : new Date(job.created_at);
              return jobStartDateTime >= comparisonStart && jobStartDateTime < comparisonEnd;
            });

            if (comparisonJobs.length > 0) {
              const { stats: compStats, trafficData: compDaily, weeklyData: compWeekly, monthlyData: compMonthly } = await processJobHistory(comparisonJobs, false, getDateRanges);
              // Ensure all comparison data arrays are valid
              const safeCompDaily = Array.isArray(compDaily) && compDaily.length > 0 ? compDaily : [];
              const safeCompWeekly = Array.isArray(compWeekly) && compWeekly.length > 0 ? compWeekly : [];
              const safeCompMonthly = Array.isArray(compMonthly) && compMonthly.length > 0 ? compMonthly : [];
              setComparisonStats(compStats);
              setComparisonData({ daily: safeCompDaily, weekly: safeCompWeekly, monthly: safeCompMonthly });
            } else {
              setComparisonData({ daily: [], weekly: [], monthly: [] });
              setComparisonStats({ totalVisitors: 0, peakHour: "N/A" });
            }
          } catch (compError) {
            console.error("Error processing comparison data:", compError);
            // Set empty comparison data on error to prevent UI issues
            setComparisonData({ daily: [], weekly: [], monthly: [] });
            setComparisonStats({ totalVisitors: 0, peakHour: "N/A" });
          }
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
        toast.error("Failed to load dashboard data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();

    const handleRefresh = () => {
      fetchDashboardData();
    };
    window.addEventListener('dashboard-refresh', handleRefresh);
    return () => {
      window.removeEventListener('dashboard-refresh', handleRefresh);
    };
  }, [comparisonMode, activeChart, location.pathname]);

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

  const monthlyLineData = useMemo(() => {
    if (!monthlyData.length) return []
    const values = monthlyData.map(d => d.visitors)
    const min = Math.min(...values)
    const max = Math.max(...values)
    return monthlyData.map((d) => ({
      ...d,
      dotColor: getTurboColor(d.visitors, min, max),
    }))
  }, [monthlyData, turboColors])

  // Merge current and comparison data for chart rendering
  const mergedData = useMemo(() => {
    if (!comparisonMode) {
      if (activeChart === "daily") return dailyLineData
      if (activeChart === "weekly") return weeklyLineData
      if (activeChart === "monthly") return monthlyLineData
      return []
    }

    // Merge data for comparison mode
    const currentData = activeChart === "daily" ? dailyLineData : activeChart === "weekly" ? weeklyLineData : monthlyLineData
    let compData = activeChart === "daily" ? comparisonData.daily : activeChart === "weekly" ? comparisonData.weekly : comparisonData.monthly
    
    // Ensure compData is an array with correct length
    if (!Array.isArray(compData) || compData.length === 0) {
      // Create empty comparison data with correct structure
      if (activeChart === "daily") {
        compData = Array.from({ length: 24 }, (_, hour) => ({
          hour: hour.toString().padStart(2, "0") + ":00",
          visitors: 0,
          fill: turboColors[0]
        }))
      } else if (activeChart === "weekly") {
        const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
        compData = weekDays.map(day => ({ day, visitors: 0 }))
      } else {
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        compData = monthNames.map(month => ({ month, visitors: 0 }))
      }
    }
    
    // Ensure compData length matches currentData length
    const expectedLength = currentData.length
    if (compData.length !== expectedLength) {
      // Pad or trim compData to match currentData length
      if (compData.length < expectedLength) {
        const padding = Array.from({ length: expectedLength - compData.length }, (_, i) => {
          const idx = compData.length + i
          if (activeChart === "daily") {
            return { hour: idx.toString().padStart(2, "0") + ":00", visitors: 0, fill: turboColors[0] }
          } else if (activeChart === "weekly") {
            const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
            return { day: weekDays[idx % 7], visitors: 0 }
          } else {
            const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
            return { month: monthNames[idx % 12], visitors: 0 }
          }
        })
        compData = [...compData, ...padding]
      } else {
        compData = compData.slice(0, expectedLength)
      }
    }
    
    // Merge by index
    const merged = currentData.map((item, idx) => {
      const comparison = compData[idx]
      return {
        ...item,
        comparison: comparison && typeof comparison.visitors === 'number' ? comparison.visitors : 0,
        current: item.visitors || 0
      }
    })
    
    return merged
  }, [comparisonMode, activeChart, dailyLineData, weeklyLineData, monthlyLineData, comparisonData, turboColors])

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
    const toastId = toast.loading('Cancelling job...');
    try {
      await heatmapService.cancelJob(jobId);
      toast.success('Job cancelled!', { id: toastId });
      // Immediately refresh dashboard data
      fetchDashboardData();
    } catch (err) {
      toast.error('Failed to cancel job.', { id: toastId });
    }
  };

  // Placeholder values for store/project, user, and date range
  const storeName = 'N/A'; // Replace with actual value if available
  const userEmail = 'N/A'; // Replace with actual value if available
  const dateRange = 'N/A'; // Replace with actual value if available

  // Helper function to format date range
  const formatDateRange = (start, end) => {
    const formatDate = (date) => {
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }
    return `${formatDate(start)} - ${formatDate(end)}`
  }

  // Helper functions for statistical calculations
  const calculateStats = (data, visitorKey = 'visitors') => {
    if (!data || data.length === 0) {
      return {
        average: 0,
        min: 0,
        max: 0,
        median: 0,
        sum: 0,
        count: 0
      }
    }
    
    const values = data.map(d => d[visitorKey] || 0).filter(v => typeof v === 'number')
    if (values.length === 0) {
      return { average: 0, min: 0, max: 0, median: 0, sum: 0, count: 0 }
    }
    
    const sorted = [...values].sort((a, b) => a - b)
    const sum = values.reduce((acc, val) => acc + val, 0)
    const average = sum / values.length
    const min = sorted[0]
    const max = sorted[sorted.length - 1]
    const median = sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)]
    
    return { average, min, max, median, sum, count: values.length }
  }

  // Helper function to find busiest and quietest periods
  const findPeriods = (data, visitorKey = 'visitors', labelKey) => {
    if (!data || data.length === 0) {
      return { busiest: null, quietest: null }
    }
    
    let busiest = data[0]
    let quietest = data[0]
    
    data.forEach(item => {
      const value = item[visitorKey] || 0
      if (value > (busiest[visitorKey] || 0)) busiest = item
      if (value < (quietest[visitorKey] || 0)) quietest = item
    })
    
    const busiestLabel = labelKey ? busiest[labelKey] : (busiest.hour || busiest.day || busiest.month || 'N/A')
    const quietestLabel = labelKey ? quietest[labelKey] : (quietest.hour || quietest.day || quietest.month || 'N/A')
    
    return {
      busiest: { label: busiestLabel, value: busiest[visitorKey] || 0 },
      quietest: { label: quietestLabel, value: quietest[visitorKey] || 0 }
    }
  }

  // Helper function to calculate trend
  const calculateTrend = (data, visitorKey = 'visitors') => {
    if (!data || data.length < 2) return 'Insufficient data'
    
    const values = data.map(d => d[visitorKey] || 0)
    const firstHalf = values.slice(0, Math.floor(values.length / 2))
    const secondHalf = values.slice(Math.floor(values.length / 2))
    
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length
    
    const change = ((secondAvg - firstAvg) / (firstAvg || 1)) * 100
    
    if (change > 5) return `Increasing (+${change.toFixed(1)}%)`
    if (change < -5) return `Decreasing (${change.toFixed(1)}%)`
    return `Stable (${change.toFixed(1)}%)`
  }

  // Helper function to get chart period label
  const getChartPeriodLabel = () => {
    const now = new Date()
    if (activeChart === "daily") {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      return formatDateRange(today, now)
    } else if (activeChart === "weekly") {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      return formatDateRange(weekAgo, now)
    } else if (activeChart === "monthly") {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      return formatDateRange(monthStart, now)
    }
    return 'N/A'
  }

  // Export chart data as CSV (Option 2: Statistical Analysis Export)
  const exportCSV = () => {
    let data = [];
    let labelKey = '';
    if (activeChart === 'daily') {
      data = dailyLineData;
      labelKey = 'hour';
    } else if (activeChart === 'weekly') {
      data = weeklyLineData;
      labelKey = 'day';
    } else if (activeChart === 'monthly') {
      data = monthlyLineData;
      labelKey = 'month';
    }
    if (!data.length) return toast.error('No data to export.');
    
    // Calculate statistics
    const stats_calc = calculateStats(data);
    const periods = findPeriods(data, 'visitors', labelKey);
    const trend = calculateTrend(data);
    const periodLabel = getChartPeriodLabel();
    const { currentStart, currentEnd } = getDateRanges();
    
    // Exclude 'fill' and 'dotColor' fields
    const header = Object.keys(data[0]).filter(h => h !== 'fill' && h !== 'dotColor');
    const csvRows = [];
    
    // === SECTION 1: REPORT HEADER ===
    csvRows.push('='.repeat(50));
    csvRows.push('FOOT TRAFFIC ANALYTICS REPORT');
    csvRows.push('='.repeat(50));
    csvRows.push('');
    csvRows.push('Report Generated,' + new Date().toLocaleString());
    csvRows.push('Chart Type,' + activeChart.charAt(0).toUpperCase() + activeChart.slice(1));
    csvRows.push('Comparison Mode,' + (comparisonMode ? 'Enabled' : 'Disabled'));
    csvRows.push('Data Period,' + periodLabel);
    csvRows.push('');
    
    // === SECTION 2: SUMMARY STATISTICS ===
    csvRows.push('='.repeat(50));
    csvRows.push('SUMMARY STATISTICS');
    csvRows.push('='.repeat(50));
    csvRows.push('Total Visitors,' + stats.totalVisitors);
    csvRows.push('Peak Period,' + stats.peakHour);
    csvRows.push('Processed Videos,' + stats.processedVideos);
    csvRows.push('Generated Heatmaps,' + stats.generatedHeatmaps);
    csvRows.push('');
    
    // === SECTION 3: COMPARISON ANALYSIS (if enabled) ===
    if (comparisonMode) {
      csvRows.push('='.repeat(50));
      csvRows.push('COMPARISON ANALYSIS');
      csvRows.push('='.repeat(50));
      const visitorChange = stats.totalVisitors - comparisonStats.totalVisitors;
      const growthRate = comparisonStats.totalVisitors > 0 
        ? ((stats.totalVisitors - comparisonStats.totalVisitors) / comparisonStats.totalVisitors * 100).toFixed(1)
        : 'N/A';
      csvRows.push('Visitor Change,' + (visitorChange > 0 ? '+' : '') + visitorChange);
      csvRows.push('Growth Rate,' + (growthRate === 'N/A' ? 'N/A' : growthRate + '%'));
      csvRows.push('Previous Peak Hour,' + comparisonStats.peakHour);
      csvRows.push('Previous Total Visitors,' + comparisonStats.totalVisitors);
      const comparisonRange = formatDateRange(getDateRanges().comparisonStart, getDateRanges().comparisonEnd);
      csvRows.push('Comparison Period,' + comparisonRange);
      csvRows.push('');
    }
    
    // === SECTION 4: STATISTICAL ANALYSIS ===
    csvRows.push('='.repeat(50));
    csvRows.push('STATISTICAL ANALYSIS');
    csvRows.push('='.repeat(50));
    csvRows.push('Average Visitors,' + stats_calc.average.toFixed(2));
    csvRows.push('Minimum Visitors,' + stats_calc.min);
    csvRows.push('Maximum Visitors,' + stats_calc.max);
    csvRows.push('Median Visitors,' + stats_calc.median.toFixed(2));
    csvRows.push('Total Visitor Count,' + stats_calc.sum);
    csvRows.push('Data Points,' + stats_calc.count);
    csvRows.push('');
    
    // === SECTION 5: TIME ANALYSIS ===
    csvRows.push('='.repeat(50));
    csvRows.push('TIME ANALYSIS');
    csvRows.push('='.repeat(50));
    if (periods.busiest) {
      csvRows.push('Busiest Period,' + periods.busiest.label + ' (' + periods.busiest.value + ' visitors)');
    }
    if (periods.quietest) {
      csvRows.push('Quietest Period,' + periods.quietest.label + ' (' + periods.quietest.value + ' visitors)');
    }
    csvRows.push('Trend Indicator,' + trend);
    csvRows.push('');
    
    // === SECTION 6: RAW CHART DATA ===
    csvRows.push('='.repeat(50));
    csvRows.push('RAW CHART DATA');
    csvRows.push('='.repeat(50));
    csvRows.push(header.join(','));
    data.forEach(row => {
      csvRows.push(header.map(h => row[h]).join(','));
    });
    
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `foot_traffic_${activeChart}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported successfully!');
  };

  // Helper function to draw a card/box in PDF
  const drawCard = (pdf, x, y, width, height, fillColor = null, strokeColor = [200, 200, 200]) => {
    if (fillColor) {
      pdf.setFillColor(fillColor[0], fillColor[1], fillColor[2]);
      pdf.rect(x, y, width, height, 'F');
    }
    pdf.setDrawColor(strokeColor[0], strokeColor[1], strokeColor[2]);
    pdf.setLineWidth(0.5);
    pdf.rect(x, y, width, height, 'S');
  }

  // Helper function to draw a simple bar chart in PDF
  const drawBarChart = (pdf, x, y, width, height, data, xKey, yKey, title) => {
    if (!data || data.length === 0) return;
    
    // Draw title with wrapping to prevent overflow
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    const maxTitleWidth = width - 20; // Leave 10pt margin on each side
    const titleLines = pdf.splitTextToSize(title, maxTitleWidth);
    let titleY = y + 12;
    titleLines.forEach((line, idx) => {
      pdf.text(line, x + 10, titleY + (idx * 12));
    });
    
    const chartPadding = 40;
    const chartX = x + chartPadding;
    const chartY = y + 25 + (titleLines.length - 1) * 12; // Adjust based on number of title lines
    const chartWidth = width - (chartPadding * 2);
    const chartHeight = height - chartPadding - 25 - (titleLines.length - 1) * 12; // Adjust for title
    
    // Calculate max value for scaling
    const maxValue = Math.max(...data.map(d => d[yKey] || 0), 1);
    const barWidth = chartWidth / data.length;
    const barSpacing = barWidth * 0.1;
    const actualBarWidth = barWidth - barSpacing;
    
    // Draw bars
    data.forEach((item, idx) => {
      const barHeight = ((item[yKey] || 0) / maxValue) * chartHeight;
      const barX = chartX + (idx * barWidth) + barSpacing / 2;
      const barY = chartY + chartHeight - barHeight;
      
      // Bar color based on value
      const intensity = (item[yKey] || 0) / maxValue;
      const blue = Math.round(25 + (230 - 25) * intensity);
      pdf.setFillColor(25, 118, 210);
      pdf.rect(barX, barY, actualBarWidth, barHeight, 'F');
    });
    
    // Draw axes
    pdf.setDrawColor(100, 100, 100);
    pdf.setLineWidth(0.5);
    // X-axis
    pdf.line(chartX, chartY + chartHeight, chartX + chartWidth, chartY + chartHeight);
    // Y-axis
    pdf.line(chartX, chartY, chartX, chartY + chartHeight);
    
    // Draw labels
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(100, 100, 100);
    data.forEach((item, idx) => {
      const labelX = chartX + (idx * barWidth) + (barWidth / 2);
      pdf.text(item[xKey], labelX, chartY + chartHeight + 8, { align: 'center' });
    });
    
    // Y-axis labels
    const numTicks = 5;
    for (let i = 0; i <= numTicks; i++) {
      const tickValue = (maxValue / numTicks) * i;
      const tickY = chartY + chartHeight - ((i / numTicks) * chartHeight);
      pdf.text(Math.round(tickValue).toString(), chartX - 5, tickY, { align: 'right' });
      pdf.line(chartX - 3, tickY, chartX, tickY);
    }
    
    pdf.setTextColor(0, 0, 0);
  }

  // Helper function to draw a simple line chart in PDF
  const drawLineChart = (pdf, x, y, width, height, data, xKey, yKey, title) => {
    if (!data || data.length < 2) return;
    
    // Draw title with wrapping to prevent overflow
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    const maxTitleWidth = width - 20; // Leave 10pt margin on each side
    const titleLines = pdf.splitTextToSize(title, maxTitleWidth);
    let titleY = y + 12;
    titleLines.forEach((line, idx) => {
      pdf.text(line, x + 10, titleY + (idx * 12));
    });
    
    const chartPadding = 40;
    const chartX = x + chartPadding;
    const chartY = y + 25 + (titleLines.length - 1) * 12; // Adjust based on number of title lines
    const chartWidth = width - (chartPadding * 2);
    const chartHeight = height - chartPadding - 25 - (titleLines.length - 1) * 12; // Adjust for title
    
    // Calculate max value for scaling
    const maxValue = Math.max(...data.map(d => d[yKey] || 0), 1);
    const pointSpacing = chartWidth / (data.length - 1);
    
    // Draw line
    pdf.setDrawColor(25, 118, 210);
    pdf.setLineWidth(2);
    const points = data.map((item, idx) => {
      const pointX = chartX + (idx * pointSpacing);
      const pointY = chartY + chartHeight - ((item[yKey] || 0) / maxValue) * chartHeight;
      return { x: pointX, y: pointY };
    });
    
    for (let i = 0; i < points.length - 1; i++) {
      pdf.line(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
    }
    
    // Draw points
    pdf.setFillColor(25, 118, 210);
    points.forEach((point) => {
      pdf.circle(point.x, point.y, 2, 'F');
    });
    
    // Draw axes
    pdf.setDrawColor(100, 100, 100);
    pdf.setLineWidth(0.5);
    // X-axis
    pdf.line(chartX, chartY + chartHeight, chartX + chartWidth, chartY + chartHeight);
    // Y-axis
    pdf.line(chartX, chartY, chartX, chartY + chartHeight);
    
    // Draw labels
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(100, 100, 100);
    
    // Show every Nth label to avoid crowding
    const labelInterval = Math.ceil(data.length / 6);
    data.forEach((item, idx) => {
      if (idx % labelInterval === 0 || idx === data.length - 1) {
        const labelX = chartX + (idx * pointSpacing);
        pdf.text(item[xKey], labelX, chartY + chartHeight + 8, { align: 'center' });
      }
    });
    
    // Y-axis labels
    const numTicks = 5;
    for (let i = 0; i <= numTicks; i++) {
      const tickValue = (maxValue / numTicks) * i;
      const tickY = chartY + chartHeight - ((i / numTicks) * chartHeight);
      pdf.text(Math.round(tickValue).toString(), chartX - 5, tickY, { align: 'right' });
      pdf.line(chartX - 3, tickY, chartX, tickY);
    }
    
    pdf.setTextColor(0, 0, 0);
  }

  // Export chart as PDF (Professional Report Layout - Vertical/Portrait Layout)
  const exportPDF = async () => {
    try {
      // Get data and calculate statistics
      let data = [];
      let labelKey = '';
      if (activeChart === 'daily') {
        data = dailyLineData;
        labelKey = 'hour';
      } else if (activeChart === 'weekly') {
        data = weeklyLineData;
        labelKey = 'day';
      } else if (activeChart === 'monthly') {
        data = monthlyLineData;
        labelKey = 'month';
      }
      if (!data.length) return toast.error('No data to export.');
      
      const stats_calc = calculateStats(data);
      const periods = findPeriods(data, 'visitors', labelKey);
      const trend = calculateTrend(data);
      const periodLabel = getChartPeriodLabel();
      const standardDev = (() => {
        const variance = data.reduce((acc, d) => {
          const diff = (d.visitors || 0) - stats_calc.average;
          return acc + (diff * diff);
        }, 0) / data.length;
        return Math.sqrt(variance).toFixed(2);
      })();
      
      // Calculate comparison metrics
      const visitorChange = comparisonMode ? stats.totalVisitors - comparisonStats.totalVisitors : 0;
      const growthRate = comparisonMode && comparisonStats.totalVisitors > 0 
        ? ((stats.totalVisitors - comparisonStats.totalVisitors) / comparisonStats.totalVisitors * 100).toFixed(1)
        : 'N/A';
      
      // Create PDF in portrait orientation
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      const margin = 40;
      let y = 30;
      const cardHeight = 70;
      const cardSpacing = 12;
      const sectionSpacing = 22;
      const lineHeight = 13;
      
      // === HEADER ===
      pdf.setFontSize(22);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Foot Traffic Analytics Report', pageWidth / 2, y, { align: 'center' });
      
      y += 22;
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 100, 100);
      const exportDate = new Date().toLocaleString();
      pdf.text(`Report Generated: ${exportDate}`, margin, y);
      y += lineHeight * 0.8;
      pdf.text(`Chart Type: ${activeChart.charAt(0).toUpperCase() + activeChart.slice(1)} | Comparison Mode: ${comparisonMode ? 'Enabled' : 'Disabled'}`, margin, y);
      y += lineHeight * 0.8;
      pdf.text(`Data Period: ${periodLabel}`, margin, y, { maxWidth: pageWidth - (margin * 2) });
      pdf.setTextColor(0, 0, 0);
      
      y += sectionSpacing + 5;
      
      // === EXECUTIVE SUMMARY - 4 Cards in a row ===
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Executive Summary', margin, y);
      y += 18;
      
      const cardWidth = (pageWidth - (margin * 2) - (cardSpacing * 3)) / 4;
      
      // Card 1: Total Visitors
      drawCard(pdf, margin, y, cardWidth, cardHeight, [250, 250, 255], [210, 213, 220]);
      pdf.setFontSize(24);
      pdf.setFont('helvetica', 'bold');
      pdf.text(String(stats.totalVisitors), margin + cardWidth / 2, y + 32, { align: 'center' });
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 100, 100);
      pdf.text('Current period', margin + cardWidth / 2, y + 50, { align: 'center' });
      pdf.setTextColor(0, 0, 0);
      
      // Card 2: Peak Period
      drawCard(pdf, margin + cardWidth + cardSpacing, y, cardWidth, cardHeight, [250, 250, 255], [210, 213, 220]);
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.text(stats.peakHour, margin + cardWidth + cardSpacing + cardWidth / 2, y + 32, { align: 'center' });
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 100, 100);
      pdf.text('Highest traffic window', margin + cardWidth + cardSpacing + cardWidth / 2, y + 50, { align: 'center' });
      pdf.setTextColor(0, 0, 0);
      
      // Card 3: Visitor Change (only if comparison mode)
      if (comparisonMode) {
        const isNegative = visitorChange < 0;
        drawCard(pdf, margin + (cardWidth + cardSpacing) * 2, y, cardWidth, cardHeight, 
          isNegative ? [254, 242, 242] : [220, 252, 231], 
          isNegative ? [248, 113, 113] : [160, 220, 180]);
        pdf.setFontSize(24);
        pdf.setFont('helvetica', 'bold');
        if (isNegative) {
          pdf.setTextColor(239, 68, 68); // Red for negative
        } else {
          pdf.setTextColor(34, 197, 94); // Green for positive
        }
        pdf.text(`${visitorChange > 0 ? '+' : ''}${visitorChange}`, margin + (cardWidth + cardSpacing) * 2 + cardWidth / 2, y + 32, { align: 'center' });
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(100, 100, 100);
        pdf.text('vs previous period', margin + (cardWidth + cardSpacing) * 2 + cardWidth / 2, y + 50, { align: 'center' });
        pdf.setTextColor(0, 0, 0);
      }
      
      // Card 4: Growth Rate (only if comparison mode)
      if (comparisonMode) {
        const isNA = growthRate === 'N/A';
        const growthRateNum = isNA ? 0 : parseFloat(growthRate);
        const isNegative = !isNA && growthRateNum < 0;
        drawCard(pdf, margin + (cardWidth + cardSpacing) * 3, y, cardWidth, cardHeight, 
          isNA ? [240, 240, 240] : (isNegative ? [254, 242, 242] : [220, 252, 231]), 
          isNA ? [200, 200, 200] : (isNegative ? [248, 113, 113] : [160, 220, 180]));
        pdf.setFontSize(22);
        pdf.setFont('helvetica', 'bold');
        if (isNA) {
          pdf.setTextColor(100, 100, 100); // Gray for N/A
        } else if (isNegative) {
          pdf.setTextColor(239, 68, 68); // Red for negative
        } else {
          pdf.setTextColor(34, 197, 94); // Green for positive
        }
        pdf.text(isNA ? 'N/A' : `${growthRate}%`, margin + (cardWidth + cardSpacing) * 3 + cardWidth / 2, y + 32, { align: 'center' });
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(100, 100, 100);
        pdf.text('Period over period', margin + (cardWidth + cardSpacing) * 3 + cardWidth / 2, y + 50, { align: 'center' });
        pdf.setTextColor(0, 0, 0);
      }
      
      y += cardHeight + sectionSpacing;
      
      // === KEY STATISTICS - 3 Columns with improved spacing ===
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Key Statistics', margin, y);
      y += 18;
      
      const colWidth = (pageWidth - (margin * 2) - (cardSpacing * 2)) / 3;
      const col1X = margin;
      const col2X = margin + colWidth + cardSpacing;
      const col3X = margin + (colWidth + cardSpacing) * 2;
      const boxHeight = 140; // Increased height for better spacing
      
      // Column 1: Distribution
      drawCard(pdf, col1X, y, colWidth, boxHeight, [250, 250, 255], [210, 213, 220]);
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Distribution', col1X + 12, y + 18);
      pdf.setFontSize(9.5);
      pdf.setFont('helvetica', 'normal');
      let colY = y + 38;
      const itemSpacing = 16; // Better spacing between items
      pdf.text(`Average: ${stats_calc.average.toFixed(2)}`, col1X + 12, colY);
      colY += itemSpacing;
      pdf.text(`Median: ${stats_calc.median.toFixed(2)}`, col1X + 12, colY);
      colY += itemSpacing;
      pdf.text(`Minimum: ${stats_calc.min}`, col1X + 12, colY);
      colY += itemSpacing;
      pdf.text(`Maximum: ${stats_calc.max}`, col1X + 12, colY);
      
      // Column 2: Peak Activity
      drawCard(pdf, col2X, y, colWidth, boxHeight, [250, 250, 255], [210, 213, 220]);
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Peak Activity', col2X + 12, y + 18);
      pdf.setFontSize(9.5);
      pdf.setFont('helvetica', 'normal');
      colY = y + 38;
      if (periods.busiest) {
        pdf.text(`Busiest Day: ${periods.busiest.label}`, col2X + 12, colY);
        colY += itemSpacing;
        pdf.text(`Peak Visitors: ${periods.busiest.value}`, col2X + 12, colY);
        colY += itemSpacing + 4;
      }
      if (periods.quietest) {
        pdf.text(`Quietest Day: ${periods.quietest.label}`, col2X + 12, colY);
        colY += itemSpacing;
        pdf.text(`Low Visitors: ${periods.quietest.value}`, col2X + 12, colY);
      }
      
      // Column 3: Statistical Metrics
      drawCard(pdf, col3X, y, colWidth, boxHeight, [250, 250, 255], [210, 213, 220]);
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Statistical Metrics', col3X + 12, y + 18);
      pdf.setFontSize(9.5);
      pdf.setFont('helvetica', 'normal');
      colY = y + 38;
      pdf.text(`Std. Deviation: ${standardDev}`, col3X + 12, colY);
      colY += itemSpacing;
      pdf.text(`Data Points: ${stats_calc.count}`, col3X + 12, colY);
      colY += itemSpacing + 4;
      // Check if trend is negative (Decreasing or contains negative percentage)
      const trendMatch1 = trend.match(/\(([-+]?\d+\.?\d*)%\)/);
      const trendValue1 = trendMatch1 ? parseFloat(trendMatch1[1]) : 0;
      const isTrendNegative1 = trend.includes('Decreasing') || trendValue1 < 0;
      if (isTrendNegative1) {
        pdf.setTextColor(239, 68, 68); // Red for negative
      } else {
        pdf.setTextColor(34, 197, 94); // Green for positive
      }
      pdf.setFont('helvetica', 'bold');
      pdf.text(`Trend: ${trend}`, col3X + 12, colY);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(0, 0, 0);
      
      y += boxHeight + sectionSpacing;
      
      // === CHARTS - Two side by side ===
      const chartWidth = (pageWidth - (margin * 2) - cardSpacing) / 2;
      const chartHeight = 160;
      
      // Calculate data for chart titles
      // Total visitors for weekly chart
      const weeklyTotalVisitors = weeklyData.reduce((sum, d) => sum + (d.visitors || 0), 0);
      
      // Find peak hour window for time period chart
      const peakHourIdx = trafficData.reduce((maxIdx, curr, idx) => 
        (curr.visitors || 0) > (trafficData[maxIdx].visitors || 0) ? idx : maxIdx, 0
      );
      const peakHourWindow = `${peakHourIdx.toString().padStart(2, "0")}:00 - ${(peakHourIdx + 1).toString().padStart(2, "0")}:00`;
      
      // Chart 1: Weekly Foot Traffic (Bar Chart)
      drawCard(pdf, margin, y, chartWidth, chartHeight, [255, 255, 255], [210, 213, 220]);
      const weeklyTitle = `Current Weekly Foot Traffic (Visitor distribution by day of week): ${weeklyTotalVisitors} total visitors`;
      drawBarChart(pdf, margin, y, chartWidth, chartHeight, weeklyData, 'day', 'visitors', weeklyTitle);
      
      // Chart 2: Traffic by Time Period (Line Chart)
      drawCard(pdf, margin + chartWidth + cardSpacing, y, chartWidth, chartHeight, [255, 255, 255], [210, 213, 220]);
      // Use trafficData for hourly line chart (sample every 4 hours to reduce clutter)
      const hourlyDataSample = trafficData.filter((_, idx) => idx % 2 === 0 || idx === trafficData.length - 1);
      const timeTitle = `Current Traffic by Time Period (Visitor count across different hours): ${peakHourWindow}`;
      drawLineChart(pdf, margin + chartWidth + cardSpacing, y, chartWidth, chartHeight, hourlyDataSample, 'hour', 'visitors', timeTitle);
      
      y += chartHeight + sectionSpacing;
      
      // === DETAILED ANALYSIS - 3 Columns ===
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Detailed Analysis', margin, y);
      y += 18;
      
      const detailBoxHeight = 110;
      
      // Column 1: Statistical Breakdown
      drawCard(pdf, col1X, y, colWidth, detailBoxHeight, [250, 250, 255], [210, 213, 220]);
      pdf.setFontSize(10.5);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Statistical Breakdown', col1X + 12, y + 18);
      pdf.setFontSize(9.5);
      pdf.setFont('helvetica', 'normal');
      colY = y + 36;
      pdf.text(`Total Visitor Count: ${stats_calc.sum}`, col1X + 12, colY);
      colY += itemSpacing;
      pdf.text(`Number of Data Points: ${stats_calc.count}`, col1X + 12, colY);
      colY += itemSpacing;
      pdf.text(`Standard Deviation: ${standardDev}`, col1X + 12, colY);
      
      // Column 2: Time Analysis
      drawCard(pdf, col2X, y, colWidth, detailBoxHeight, [250, 250, 255], [210, 213, 220]);
      pdf.setFontSize(10.5);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Time Analysis', col2X + 12, y + 18);
      pdf.setFontSize(9.5);
      pdf.setFont('helvetica', 'normal');
      colY = y + 36;
      if (periods.busiest) {
        pdf.text(`Peak Traffic Time: ${periods.busiest.label}`, col2X + 12, colY);
        colY += itemSpacing;
        pdf.text(`  - Visitor Count: ${periods.busiest.value}`, col2X + 15, colY);
        colY += itemSpacing;
      }
      if (periods.quietest) {
        pdf.text(`Lowest Traffic Time: ${periods.quietest.label}`, col2X + 12, colY);
        colY += itemSpacing;
        pdf.text(`  - Visitor Count: ${periods.quietest.value}`, col2X + 15, colY);
        colY += itemSpacing;
      }
      // Check if trend is negative (Decreasing or contains negative percentage)
      const trendMatch2 = trend.match(/\(([-+]?\d+\.?\d*)%\)/);
      const trendValue2 = trendMatch2 ? parseFloat(trendMatch2[1]) : 0;
      const isTrendNegative2 = trend.includes('Decreasing') || trendValue2 < 0;
      if (isTrendNegative2) {
        pdf.setTextColor(239, 68, 68); // Red for negative
      } else {
        pdf.setTextColor(34, 197, 94); // Green for positive
      }
      pdf.setFont('helvetica', 'bold');
      pdf.text(`Overall Trend: ${trend}`, col2X + 12, colY);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(0, 0, 0);
      
      // Column 3: Period Comparison (only if comparison mode)
      if (comparisonMode) {
        drawCard(pdf, col3X, y, colWidth, detailBoxHeight, [250, 250, 255], [210, 213, 220]);
        pdf.setFontSize(10.5);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Period Comparison', col3X + 12, y + 18);
        pdf.setFontSize(9.5);
        pdf.setFont('helvetica', 'normal');
        colY = y + 36;
        pdf.text(`Current Period Total: ${stats.totalVisitors} visitors`, col3X + 12, colY);
        colY += itemSpacing;
        pdf.text(`Previous Period Total: ${comparisonStats.totalVisitors} visitors`, col3X + 12, colY);
        colY += itemSpacing;
        const isNegativeChange = visitorChange < 0;
        if (isNegativeChange) {
          pdf.setTextColor(239, 68, 68); // Red for negative
        } else {
          pdf.setTextColor(34, 197, 94); // Green for positive
        }
        pdf.setFont('helvetica', 'bold');
        pdf.text(`Change: ${visitorChange > 0 ? '+' : ''}${visitorChange} (${growthRate === 'N/A' ? 'N/A' : growthRate + '%'})`, col3X + 12, colY);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(0, 0, 0);
      }
      
      y += detailBoxHeight + 15;
      
      // === FOOTER ===
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'italic');
      pdf.setTextColor(128, 128, 128);
      pdf.text('Report includes comprehensive foot traffic analysis with trend indicators and comparative metrics.', margin, y, { maxWidth: pageWidth - (margin * 2) });
      y += lineHeight;
      pdf.text(`Generated on ${exportDate}`, margin, y);
      
      pdf.save(`foot_traffic_${activeChart}_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('PDF exported successfully!');
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
        {/* Comparison Stats Banner */}
        {comparisonMode && (
          <Card className="bg-gradient-to-br from-slate-800/80 to-slate-900/90 dark:from-slate-800/80 dark:to-slate-900/90 border border-slate-600 mb-4 p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                {(() => {
                  const visitorChange = stats.totalVisitors - comparisonStats.totalVisitors;
                  const isNegative = visitorChange < 0;
                  return (
                    <div className={`text-2xl font-bold ${isNegative ? 'text-red-400' : 'text-cyan-400'}`}>
                      {(visitorChange > 0 ? '+' : '')}
                      {visitorChange}
                </div>
                  );
                })()}
                <div className="text-xs text-muted-foreground">Visitor Change</div>
              </div>
              <div className="text-center">
                {(() => {
                  const growthRate = comparisonStats.totalVisitors > 0 
                    ? ((stats.totalVisitors - comparisonStats.totalVisitors) / comparisonStats.totalVisitors * 100)
                    : null;
                  const isNegative = growthRate !== null && growthRate < 0;
                  return (
                    <div className={`text-2xl font-bold ${isNegative ? 'text-red-400' : 'text-yellow-400'}`}>
                      {growthRate !== null ? `${growthRate.toFixed(1)}%` : 'N/A'}
                </div>
                  );
                })()}
                <div className="text-xs text-muted-foreground">Growth Rate</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-slate-400">{comparisonStats.peakHour}</div>
                <div className="text-xs text-muted-foreground">Previous Peak Hour</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-slate-400">{comparisonStats.totalVisitors}</div>
                <div className="text-xs text-muted-foreground">Previous Total Visitors</div>
              </div>
            </div>
          </Card>
        )}
        {/* Section Divider */}
        <div className="w-full h-px bg-border bg-gradient-to-r from-primary/20 via-muted/10 to-cyan-400/20 mb-7" />
      {/* Main Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-7 h-[400px]">
        {/* Chart Card */}
          <Card id="foot-traffic-chart-card" className="col-span-2 bg-gradient-to-br from-background/80 to-muted/90 dark:from-slate-900/80 dark:to-slate-950/90 border border-border shadow-2xl shadow-primary/10 backdrop-blur-xl rounded-xl">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-lg font-bold text-foreground tracking-tight drop-shadow">Foot Traffic Analytics</CardTitle>
                  <Button
                    variant={comparisonMode ? "default" : "outline"}
                    size="sm"
                    onClick={() => setComparisonMode(!comparisonMode)}
                    className="text-xs"
                  >
                    {comparisonMode ? "✓ Compare" : "Compare"}
                  </Button>
                </div>
                <Popover open={exportOpen} onOpenChange={setExportOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      size="icon"
                      variant="outline"
                      role="combobox"
                      aria-expanded={exportOpen}
                      className="w-9 h-9"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[140px] p-0" align="end" sideOffset={5}>
                    <Command>
                      <CommandList>
                        <CommandGroup>
                          {exportOptions.map((option) => (
                            <CommandItem
                              key={option.value}
                              value={option.value}
                              onSelect={(currentValue) => {
                                handleExport(currentValue);
                                setExportOpen(false);
                              }}
                            >
                              {option.label}
                              <Check
                                className={cn(
                                  "ml-auto h-4 w-4",
                                  exportValue === option.value ? "opacity-100" : "opacity-0"
                                )}
                              />
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex justify-center">
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
                    current: {
                      color: "#ff7a36",
                      label: "Current",
                    },
                    comparison: {
                      color: "#94a3b8",
                      label: "Previous Period",
                    },
                  }}
                >
                  {activeChart === "daily" && (
                    <ReLineChart data={mergedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                  dataKey={comparisonMode ? "current" : "visitors"} 
                        stroke="url(#turbo-gradient-daily)"
                        strokeWidth={2.5}
                  dot={false}
                        activeDot={({ cx, cy, payload, index }) => (
                          <circle key={"dot-active-" + index} cx={cx} cy={cy} r={7} fill={payload.dotColor} stroke="#fff" strokeWidth={2} />
                        )}
                        isAnimationActive={true}
                        connectNulls
                      />
                      {comparisonMode && (
                        <Line 
                          type="monotone" 
                          dataKey="comparison" 
                          stroke="#94a3b8"
                          strokeWidth={2}
                          strokeDasharray="5 5"
                          dot={false}
                          activeDot={{ r: 6, fill: "#94a3b8", stroke: "#fff", strokeWidth: 2 }}
                          name="Previous Period"
                        />
                      )}
                      <ChartLegend content={<ChartLegendContent />} />
                    </ReLineChart>
                  )}
                  {activeChart === "weekly" && (
                    <ReLineChart data={mergedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                        dataKey={comparisonMode ? "current" : "visitors"} 
                        stroke="url(#turbo-gradient-weekly)"
                        strokeWidth={2.5}
                        dot={false}
                        activeDot={({ cx, cy, payload, index }) => (
                          <circle key={"dot-active-" + index} cx={cx} cy={cy} r={7} fill={payload.dotColor} stroke="#fff" strokeWidth={2} />
                        )}
                        isAnimationActive={true}
                        connectNulls
                      />
                      {comparisonMode && (
                        <Line 
                          type="monotone" 
                          dataKey="comparison" 
                          stroke="#94a3b8"
                          strokeWidth={2}
                          strokeDasharray="5 5"
                          dot={false}
                          activeDot={{ r: 6, fill: "#94a3b8", stroke: "#fff", strokeWidth: 2 }}
                          name="Previous Period"
                        />
                      )}
                      <ChartLegend content={<ChartLegendContent />} />
                    </ReLineChart>
                  )}
                  {activeChart === "monthly" && (
                    <ReLineChart data={mergedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="turbo-gradient-monthly" x1="0" y1="0" x2="1" y2="0">
                          {monthlyLineData.map((d, i) => (
                            <stop
                              key={i}
                              offset={`${(i / (monthlyLineData.length - 1)) * 100}%`}
                              stopColor={d.dotColor}
                            />
                          ))}
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                      <XAxis dataKey="month" stroke="#ff6f00" tick={{ fontSize: 12, fill: '#ff6f00' }} />
                      <YAxis stroke="#ff6f00" tick={{ fontSize: 12, fill: '#ff6f00' }} label={{ value: 'Visitors', angle: -90, position: 'insideLeft', fill: '#ff6f00', fontSize: 14, dy: -10 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line
                        type="monotone" 
                        dataKey={comparisonMode ? "current" : "visitors"} 
                        stroke="url(#turbo-gradient-monthly)"
                        strokeWidth={2.5}
                        dot={false}
                        activeDot={({ cx, cy, payload, index }) => (
                          <circle key={"dot-active-" + index} cx={cx} cy={cy} r={7} fill={payload.dotColor} stroke="#fff" strokeWidth={2} />
                        )}
                        isAnimationActive={true}
                        connectNulls
                      />
                      {comparisonMode && (
                        <Line 
                          type="monotone" 
                          dataKey="comparison" 
                          stroke="#94a3b8"
                          strokeWidth={2}
                          strokeDasharray="5 5"
                          dot={false}
                          activeDot={{ r: 6, fill: "#94a3b8", stroke: "#fff", strokeWidth: 2 }}
                          name="Previous Period"
                        />
                      )}
                      <ChartLegend content={<ChartLegendContent />} />
                    </ReLineChart>
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
                <Video className="mr-2 h-5 w-5" /> Upload New Video
              </Link>
            </Button>
                <Button
                  asChild
                  className="w-full bg-gradient-to-r from-cyan-100 to-green-200 text-black font-semibold shadow-md border border-border py-2 text-sm hover:opacity-90 dark:from-cyan-400/30 dark:to-green-400/30 dark:text-white"
                >
              <Link to="/view-heatmap">
                <Map className="mr-2 h-5 w-5" /> Customize a Heatmap
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
