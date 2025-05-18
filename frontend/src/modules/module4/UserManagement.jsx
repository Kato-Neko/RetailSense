"use client";

import { useState, useEffect } from "react";
import { User, Mail, Calendar, Key, Eye, EyeOff, Video, Map, Clock, BarChart2, Edit2, Check, X } from "lucide-react";
import { authService, heatmapService } from "../../services/api";
import toast from "react-hot-toast";
import "../../styles/UserManagement.css";

const UserManagement = () => {
  const [userInfo, setUserInfo] = useState({
    username: "",
    email: "",
    created_at: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [activityStats, setActivityStats] = useState({
    totalVideos: 0,
    totalHeatmaps: 0,
    lastActivity: null,
    recentActivities: []
  });
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState("");

  useEffect(() => {
    fetchUserInfo();
    fetchUserActivity();
  }, []);

  const fetchUserInfo = async () => {
    try {
      const response = await authService.getUserInfo();
      setUserInfo(response);
      setIsLoading(false);
    } catch (error) {
      toast.error("Failed to fetch user information");
      setIsLoading(false);
    }
  };

  const fetchUserActivity = async () => {
    try {
      const jobHistory = await heatmapService.getJobHistory();
      
      // Calculate statistics
      const totalVideos = jobHistory.filter(job => job.input_video_name).length;
      const totalHeatmaps = jobHistory.filter(job => job.status === "completed").length;
      const lastActivity = jobHistory.length > 0 ? new Date(jobHistory[0].created_at) : null;
      
      // Get recent activities (last 5)
      const recentActivities = jobHistory.slice(0, 5).map(job => ({
        type: job.input_video_name ? 'video' : 'heatmap',
        name: job.input_video_name || job.input_floorplan_name || 'Unknown',
        status: job.status,
        date: new Date(job.created_at),
        peopleCount: job.people_counted
      }));

      setActivityStats({
        totalVideos,
        totalHeatmaps,
        lastActivity,
        recentActivities
      });
    } catch (error) {
      console.error("Failed to fetch activity:", error);
    }
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();

    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      toast.error("Please fill in all password fields");
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      toast.error("New password must be at least 6 characters long");
      return;
    }

    try {
      // TODO: Implement password update API call
      toast.success("Password updated successfully");
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error) {
      toast.error(error.message || "Failed to update password");
    }
  };

  const handleUsernameEdit = () => {
    setNewUsername(userInfo.username);
    setIsEditingUsername(true);
  };

  const handleUsernameCancel = () => {
    setIsEditingUsername(false);
    setNewUsername("");
  };

  const handleUsernameUpdate = async (e) => {
    e.preventDefault();
    
    if (!newUsername.trim()) {
      toast.error("Username cannot be empty");
      return;
    }

    if (newUsername === userInfo.username) {
      setIsEditingUsername(false);
      return;
    }

    try {
      const response = await authService.updateUsername(newUsername);
      if (response.message) {
        setUserInfo(prev => ({ ...prev, username: newUsername }));
        setIsEditingUsername(false);
        toast.success("Username updated successfully");
      } else {
        throw new Error("Failed to update username");
      }
    } catch (error) {
      toast.error(error.message || "Failed to update username");
    }
  };

  if (isLoading) {
    return (
      <div className="user-management-container">
        <div className="loading-message">Loading user information...</div>
      </div>
    );
  }

  return (
    <div className="user-management-container">
      <h1 className="page-title">User Profile</h1>

      <div className="profile-card">
        <div className="profile-header">
          <div className="profile-avatar">
            <User className="avatar-icon" />
          </div>
          <div className="username-section">
            {isEditingUsername ? (
              <form onSubmit={handleUsernameUpdate} className="username-edit-form">
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="username-input"
                  placeholder="Enter new username"
                  autoFocus
                />
                <div className="username-edit-actions">
                  <button type="submit" className="edit-btn save">
                    <Check size={16} />
                  </button>
                  <button type="button" className="edit-btn cancel" onClick={handleUsernameCancel}>
                    <X size={16} />
                  </button>
                </div>
              </form>
            ) : (
              <div className="username-display">
                <h2 className="profile-name">{userInfo.username}</h2>
                <button onClick={handleUsernameEdit} className="edit-username-btn">
                  <Edit2 size={16} />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="profile-info">
          <div className="info-item">
            <Mail className="info-icon" />
            <div className="info-content">
              <label className="info-label">Email Address</label>
              <p className="info-value">{userInfo.email}</p>
            </div>
          </div>

          <div className="info-item">
            <Calendar className="info-icon" />
            <div className="info-content">
              <label className="info-label">Member Since</label>
              <p className="info-value">
                {new Date(userInfo.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Activity Summary Section */}
      <div className="activity-card">
        <h2 className="section-title">Activity Summary</h2>
        
        <div className="activity-stats">
          <div className="stat-item">
            <Video className="stat-icon" />
            <div className="stat-content">
              <span className="stat-value">{activityStats.totalVideos}</span>
              <span className="stat-label">Videos Processed</span>
            </div>
          </div>
          
          <div className="stat-item">
            <Map className="stat-icon" />
            <div className="stat-content">
              <span className="stat-value">{activityStats.totalHeatmaps}</span>
              <span className="stat-label">Heatmaps Generated</span>
            </div>
          </div>
          
          <div className="stat-item">
            <Clock className="stat-icon" />
            <div className="stat-content">
              <span className="stat-value">
                {activityStats.lastActivity 
                  ? new Date(activityStats.lastActivity).toLocaleDateString()
                  : 'No activity'}
              </span>
              <span className="stat-label">Last Activity</span>
            </div>
          </div>
        </div>

        <div className="recent-activity">
          <h3 className="subsection-title">Recent Activities</h3>
          <div className="activity-timeline">
            {activityStats.recentActivities.map((activity, index) => (
              <div key={index} className="timeline-item">
                <div className="timeline-icon">
                  {activity.type === 'video' ? <Video size={16} /> : <Map size={16} />}
                </div>
                <div className="timeline-content">
                  <div className="timeline-header">
                    <span className="activity-type">
                      {activity.type === 'video' ? 'Video Processing' : 'Heatmap Generation'}
                    </span>
                    <span className="activity-date">
                      {activity.date.toLocaleDateString()} {activity.date.toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="activity-name">{activity.name}</p>
                  {activity.peopleCount && (
                    <span className="people-count">
                      <BarChart2 size={14} /> {activity.peopleCount} people detected
                    </span>
                  )}
                  <span className={`activity-status ${activity.status}`}>
                    {activity.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="password-card">
        <h2 className="section-title">Change Password</h2>
        <form onSubmit={handlePasswordUpdate} className="password-form">
          <div className="form-group">
            <label htmlFor="currentPassword" className="form-label">
              Current Password
            </label>
            <div className="password-input-container">
              <input
                id="currentPassword"
                name="currentPassword"
                type={showPassword ? "text" : "password"}
                required
                className="form-input"
                placeholder="Enter current password"
                value={passwordForm.currentPassword}
                onChange={handlePasswordChange}
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="password-icon" />
                ) : (
                  <Eye className="password-icon" />
                )}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="newPassword" className="form-label">
              New Password
            </label>
            <div className="password-input-container">
              <input
                id="newPassword"
                name="newPassword"
                type={showPassword ? "text" : "password"}
                required
                className="form-input"
                placeholder="Enter new password"
                value={passwordForm.newPassword}
                onChange={handlePasswordChange}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword" className="form-label">
              Confirm New Password
            </label>
            <div className="password-input-container">
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showPassword ? "text" : "password"}
                required
                className="form-input"
                placeholder="Confirm new password"
                value={passwordForm.confirmPassword}
                onChange={handlePasswordChange}
              />
            </div>
          </div>

          <button type="submit" className="update-password-btn">
            <Key className="button-icon" /> Update Password
          </button>
        </form>
      </div>
    </div>
  );
};

export default UserManagement;
