"use client";

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  BarChart,
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
import "../styles/Dashboard.css";

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
    <div className="dashboard-container">
      <h1 className="dashboard-title">Dashboard</h1>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-content">
            <div className="stat-icon-container users-icon">
              <Users className="stat-icon" />
            </div>
            <div className="stat-info">
              <p className="stat-label">Total Visitors</p>
              <p className="stat-value">
                {isLoading ? "Loading..." : stats.totalVisitors}
              </p>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-content">
            <div className="stat-icon-container clock-icon">
              <Clock className="stat-icon" />
            </div>
            <div className="stat-info">
              <p className="stat-label">Peak Hour</p>
              <p className="stat-value">
                {isLoading ? "Loading..." : stats.peakHour}
              </p>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-content">
            <div className="stat-icon-container video-icon">
              <Video className="stat-icon" />
            </div>
            <div className="stat-info">
              <p className="stat-label">Processed Videos</p>
              <p className="stat-value">
                {isLoading ? "Loading..." : stats.processedVideos}
              </p>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-content">
            <div className="stat-icon-container map-icon">
              <Map className="stat-icon" />
            </div>
            <div className="stat-info">
              <p className="stat-label">Generated Heatmaps</p>
              <p className="stat-value">
                {isLoading ? "Loading..." : stats.generatedHeatmaps}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="chart-card">
          <h2 className="chart-title">Hourly Foot Traffic</h2>
          <div className="chart-container">
            {isLoading ? (
              <div className="loading-indicator">Loading chart data...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trafficData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="visitors" fill="#3f51b5" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="actions-card">
          <h2 className="actions-title">Quick Actions</h2>
          <div className="actions-buttons">
            <Link to="/video-processing" className="action-btn video-btn">
              <Video className="action-icon" /> Process New Video
            </Link>
            <Link to="/heatmap-generation" className="action-btn heatmap-btn">
              <Map className="action-icon" /> Generate Heatmap
            </Link>
          </div>

          <div className="recent-activity">
            <h3 className="activity-title">Recent Activity</h3>
            {isLoading ? (
              <div className="loading-indicator">
                Loading recent activity...
              </div>
            ) : recentJobs.length > 0 ? (
              <div className="activity-list">
                {recentJobs.map((job) => (
                  <div className="activity-item" key={job.id}>
                    <div
                      className={`activity-indicator ${
                        job.status === "completed"
                          ? "green"
                          : job.status === "error"
                          ? "red"
                          : "blue"
                      }`}
                    ></div>
                    <p className="activity-text">
                      {job.status === "completed"
                        ? `Completed "${job.name}"`
                        : job.status === "error"
                        ? `Error processing "${job.name}"`
                        : `Processing "${job.name}"`}
                    </p>
                    <span className="activity-time">{job.time}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="no-activity">
                No recent activity found. Start by processing a video or
                generating a heatmap.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
