"use client";

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  BarChart as ReBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Video, Map, Users, Clock } from "lucide-react";
import { heatmapService } from "../services/api";
import toast from "react-hot-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalVisitors: 0,
    peakHour: "N/A",
    processedVideos: 0,
    generatedHeatmaps: 0,
  });

  const [trafficData, setTrafficData] = useState([]);
  const [recentJobs, setRecentJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      try {
        // Fetch job history
        const jobHistory = await heatmapService.getJobHistory();

        // Set recent jobs (most recent 3)
        const recent = jobHistory.slice(0, 3).map((job) => ({
          id: job.job_id,
          type: job.input_video_name ? "video" : "heatmap",
          name: job.input_video_name || job.input_floorplan_name || "Job",
          status: job.status,
          time: new Date(job.created_at).toLocaleString(),
        }));
        setRecentJobs(recent);

        // Calculate stats from job history
        const completedJobs = jobHistory.filter(
          (job) => job.status === "completed"
        );
        const videoCount = new Set(
          jobHistory.map((job) => job.input_video_name)
        ).size;
        const heatmapCount = completedJobs.length;

        // For this demo, we'll estimate visitor count based on completed jobs
        // In a real app, this would come from actual detection counts
        const estimatedVisitors =
          heatmapCount * 150 + Math.floor(Math.random() * 200);

        setStats({
          totalVisitors: estimatedVisitors,
          peakHour: "14:00-15:00", // This would ideally come from real analysis
          processedVideos: videoCount,
          generatedHeatmaps: heatmapCount,
        });

        // Generate traffic data based on time of day
        // In a real app, this would come from actual detection counts by hour
        const hours = [
          "9AM",
          "10AM",
          "11AM",
          "12PM",
          "1PM",
          "2PM",
          "3PM",
          "4PM",
          "5PM",
          "6PM",
          "7PM",
          "8PM",
        ];
        const peakHourIndex = 5; // 2PM

        const trafficByHour = hours.map((hour, index) => {
          // Create a bell curve centered around peak hour
          const distanceFromPeak = Math.abs(index - peakHourIndex);
          const baseVisitors = 100;
          const peakVisitors = 180;
          const falloff = 25;

          const visitors = Math.max(
            baseVisitors,
            peakVisitors - distanceFromPeak * falloff
          );

          return { hour, visitors };
        });

        setTrafficData(trafficByHour);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
        toast.error("Failed to load dashboard data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-3xl font-bold text-white mb-8">Dashboard</h1>
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
        <Card className="bg-slate-900/80 border-slate-800 flex flex-col items-center py-6">
          <Users className="text-blue-400 h-8 w-8 mb-2" />
          <span className="text-2xl font-bold text-white">{isLoading ? "..." : stats.totalVisitors}</span>
          <span className="text-xs text-slate-400 mt-1">Total Visitors</span>
        </Card>
        <Card className="bg-slate-900/80 border-slate-800 flex flex-col items-center py-6">
          <Clock className="text-yellow-400 h-8 w-8 mb-2" />
          <span className="text-2xl font-bold text-white">{isLoading ? "..." : stats.peakHour}</span>
          <span className="text-xs text-slate-400 mt-1">Peak Hour</span>
        </Card>
        <Card className="bg-slate-900/80 border-slate-800 flex flex-col items-center py-6">
          <Video className="text-cyan-400 h-8 w-8 mb-2" />
          <span className="text-2xl font-bold text-white">{isLoading ? "..." : stats.processedVideos}</span>
          <span className="text-xs text-slate-400 mt-1">Processed Videos</span>
        </Card>
        <Card className="bg-slate-900/80 border-slate-800 flex flex-col items-center py-6">
          <Map className="text-green-400 h-8 w-8 mb-2" />
          <span className="text-2xl font-bold text-white">{isLoading ? "..." : stats.generatedHeatmaps}</span>
          <span className="text-xs text-slate-400 mt-1">Generated Heatmaps</span>
        </Card>
      </div>
      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Chart Card */}
        <Card className="col-span-2 bg-slate-900/80 border-slate-800">
          <CardHeader>
            <CardTitle className="text-lg text-white">Hourly Foot Traffic</CardTitle>
          </CardHeader>
          <CardContent className="h-72 flex items-center justify-center">
            {isLoading ? (
              <div className="text-slate-400">Loading chart data...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ReBarChart data={trafficData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="visitors" fill="#3f51b5" />
                </ReBarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        {/* Actions & Recent Activity Card */}
        <Card className="bg-slate-900/80 border-slate-800 flex flex-col">
          <CardHeader>
            <CardTitle className="text-lg text-white">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 mb-6">
              <Button asChild className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-semibold">
                <Link to="/video-processing">
                  <Video className="mr-2 h-5 w-5" /> Process New Video
            </Link>
              </Button>
              <Button asChild className="w-full bg-gradient-to-r from-cyan-600 to-green-500 hover:from-cyan-700 hover:to-green-600 text-white font-semibold">
                <Link to="/heatmap-generation">
                  <Map className="mr-2 h-5 w-5" /> Generate Heatmap
            </Link>
              </Button>
          </div>
            <div>
              <h3 className="text-base font-semibold text-white mb-3">Recent Activity</h3>
            {isLoading ? (
                <div className="text-slate-400">Loading recent activity...</div>
            ) : recentJobs.length > 0 ? (
                <div className="space-y-3">
                {recentJobs.map((job) => (
                    <div key={job.id} className="flex items-center gap-3 bg-slate-800/60 rounded-lg px-3 py-2">
                      <div className={`w-2 h-2 rounded-full mt-1 ${job.status === "completed" ? "bg-green-400" : job.status === "error" ? "bg-red-400" : "bg-blue-400"}`}></div>
                      <div className="flex-1 min-w-0">
                        <div className="text-slate-200 text-sm truncate max-w-[180px]">
                      {job.status === "completed"
                        ? `Completed "${job.name}"`
                        : job.status === "error"
                        ? `Error processing "${job.name}"`
                        : `Processing "${job.name}"`}
                        </div>
                        <div className="text-xs text-slate-400">{job.time}</div>
                      </div>
                  </div>
                ))}
              </div>
            ) : (
                <p className="text-slate-400">No recent activity found. Start by processing a video or generating a heatmap.</p>
            )}
          </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
