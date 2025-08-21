"use client";

import { useState, useEffect } from "react";
import { User, Mail, Calendar, Key, Eye, EyeOff, Video, Map, Clock, BarChart2, Edit2, Check, X, Trash2 } from "lucide-react";
import { authService, heatmapService } from "../../services/api";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const UserManagement = () => {
  const [userInfo, setUserInfo] = useState({
    username: "",
    email: "",
    created_at: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
  const [deletingJobId, setDeletingJobId] = useState(null);
  const [deletingIndex, setDeletingIndex] = useState(null);

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
      console.log("Raw job history:", jobHistory);
      
      // Calculate statistics
      const totalVideos = jobHistory.filter(job => job.input_video_name).length;
      const totalHeatmaps = jobHistory.filter(job => job.status === "completed").length;
      const lastActivity = jobHistory.length > 0 ? new Date(jobHistory[0].created_at) : null;
      
      // Get recent activities (last 5)
      const recentActivities = jobHistory.slice(0, 5).map(job => ({
        job_id: job.job_id,
        type: job.input_video_name ? 'video' : 'heatmap',
        name: job.input_video_name || job.input_floorplan_name || 'Unknown',
        status: job.status,
        date: new Date(job.created_at),
        peopleCount: job.people_counted
      }));

      console.log("Processed recent activities:", recentActivities);

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
      const response = await authService.updatePassword(passwordForm.currentPassword, passwordForm.newPassword);
      if (response.message) {
        setPasswordForm({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
        // Immediately log out the user and redirect to login
        localStorage.removeItem("access_token");
        window.location.href = "/?showAuth=true&tab=login";
      } else {
        throw new Error(response.error || "Failed to update password");
      }
    } catch (error) {
      toast.error(error.message || error.error || "Failed to update password");
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
        window.dispatchEvent(new Event("user-info-updated"));
      } else {
        throw new Error("Failed to update username");
      }
    } catch (error) {
      toast.error(error.message || "Failed to update username");
    }
  };

  // Delete activity from backend and UI
  const handleDeleteActivity = async (jobId, index) => {
    try {
      const activity = activityStats.recentActivities[index];
      console.log("[UserManagement] Delete clicked:", { index, jobId, activity });
      
      // Confirm deletion
      if (!window.confirm(`Are you sure you want to delete this ${activity.type === 'video' ? 'video processing' : 'heatmap generation'} job? This action cannot be undone.`)) {
        return;
      }
      
      console.log("Starting delete for activity:", activity);
      console.log("Job ID to delete:", jobId);
      
      setDeletingJobId(jobId);
      setDeletingIndex(index);
      
      console.log("Calling heatmapService.deleteJob with:", jobId);
      const result = await heatmapService.deleteJob(jobId);
      console.log("Delete result:", result);
      
      toast.success("Job deleted successfully");
      
      // Remove from UI and refresh stats
      setActivityStats((prev) => ({
        ...prev,
        recentActivities: prev.recentActivities.filter((_, i) => i !== index)
      }));
      
      // Refresh the activity stats to get updated counts
      fetchUserActivity();
    } catch (error) {
      console.error("Failed to delete job:", error);
      console.error("Error details:", error.response || error);
      toast.error(error.error || "Failed to delete job");
    } finally {
      setDeletingJobId(null);
      setDeletingIndex(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px] text-slate-400 text-lg">Loading user information...</div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      {/* Profile Card */}
      <Card className="mb-8 bg-gradient-to-br from-background/80 to-muted/90 dark:from-slate-900/80 dark:to-slate-950/90 border border-border shadow-xl shadow-primary/10 backdrop-blur-xl">
        <CardHeader className="flex flex-row items-center gap-4">
          <Avatar className="w-16 h-16">
            <AvatarImage src="https://github.com/shadcn.png" alt={userInfo.username || "User"} />
            <AvatarFallback>
              {userInfo.username
                ? userInfo.username
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                : userInfo.email
                ? userInfo.email[0].toUpperCase()
                : "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            {isEditingUsername ? (
              <form onSubmit={handleUsernameUpdate} className="flex items-center gap-2 relative z-10">
                <Input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-40"
                  placeholder="Enter new username"
                  autoFocus
                />
                <Button type="submit" size="icon" variant="success"><Check size={16} /></Button>
                <Button type="button" size="icon" variant="destructive" onClick={handleUsernameCancel}><X size={16} /></Button>
              </form>
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold text-foreground">{userInfo.username}</h2>
                <Button onClick={handleUsernameEdit} size="icon" variant="ghost"><Edit2 size={16} /></Button>
              </div>
            )}
            <div className="flex gap-4 mt-2">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Mail className="h-4 w-4" /> {userInfo.email}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Calendar className="h-4 w-4" /> Member since {new Date(userInfo.created_at).toLocaleDateString()}
        </div>
            </div>
          </div>
        </CardHeader>
      </Card>
      {/* Activity Summary Card */}
      <Card className="mb-8 bg-gradient-to-br from-background/80 to-muted/90 dark:from-slate-900/80 dark:to-slate-950/90 border border-border shadow-xl shadow-primary/10 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-lg text-foreground">Activity Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-0 mb-6 text-center">
            <div className="flex flex-col items-center justify-center">
              <Video className="text-cyan-400 h-6 w-6 mb-1" />
              <span className="text-2xl font-bold text-foreground">{activityStats.totalVideos}</span>
              <span className="text-xs text-muted-foreground mt-1">Videos Processed</span>
            </div>
            <div className="flex flex-col items-center justify-center">
              <Map className="text-green-400 h-6 w-6 mb-1" />
              <span className="text-2xl font-bold text-foreground">{activityStats.totalHeatmaps}</span>
              <span className="text-xs text-muted-foreground mt-1">Heatmaps Generated</span>
            </div>
            <div className="flex flex-col items-center justify-center">
              <Clock className="text-yellow-400 h-6 w-6 mb-1" />
              <span className="text-2xl font-bold text-foreground">{activityStats.lastActivity ? new Date(activityStats.lastActivity).toLocaleDateString() : 'No activity'}</span>
              <span className="text-xs text-muted-foreground mt-1">Last Activity</span>
            </div>
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground mb-3">Recent Activities</h3>
            <div className="space-y-4">
              {activityStats.recentActivities.map((activity, index) => (
                <div key={index} className="flex items-center gap-4 bg-muted/60 dark:bg-slate-800/60 rounded-lg px-4 py-3">
                  <div className="rounded-full bg-muted dark:bg-slate-900 p-2 flex-shrink-0">
                    {activity.type === 'video' ? <Video className="h-5 w-5 text-cyan-400" /> : <Map className="h-5 w-5 text-green-400" />}
            </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{activity.type === 'video' ? 'Video Processing' : 'Heatmap Generation'}</span>
                      <span className="text-xs text-muted-foreground">{activity.date.toLocaleDateString()} {activity.date.toLocaleTimeString()}</span>
                    </div>
                    <div className="text-muted-foreground text-sm truncate max-w-[180px]">{activity.name}</div>
                    {activity.peopleCount && (
                      <div className="flex items-center gap-1 text-xs text-blue-300 mt-1">
                        <BarChart2 className="h-4 w-4" /> {activity.peopleCount} people detected
        </div>
                    )}
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs ${activity.status === 'completed' ? 'bg-green-700/40 text-green-300' : activity.status === 'error' ? 'bg-red-700/40 text-red-300' : 'bg-yellow-700/40 text-yellow-300'}`}>{activity.status}</span>
                  </div>
                  <button
                    type="button"
                    className="h-8 w-8 inline-flex items-center justify-center rounded-md text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                    title="Delete activity"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); console.log('[UserManagement] Delete icon clicked', { index, jobId: activity.job_id }); handleDeleteActivity(activity.job_id, index); }}
                    disabled={deletingIndex === index}
                    style={{ pointerEvents: 'auto' }}
                    aria-label="Delete activity"
                  >
                    {deletingIndex === index ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
              </div>
            ))}
          </div>
        </div>
        </CardContent>
      </Card>
      {/* Password Card */}
      <Card className="bg-gradient-to-br from-background/80 to-muted/90 dark:from-slate-900/80 dark:to-slate-950/90 border border-border shadow-xl shadow-primary/10 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-lg text-foreground">Change Password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordUpdate} className="space-y-4">
            <div className="relative">
              <Label htmlFor="currentPassword" className="text-muted-foreground mb-1 block">Current Password</Label>
              <Input
                id="currentPassword"
                name="currentPassword"
                type={showCurrentPassword ? "text" : "password"}
                required
                placeholder="Enter current password"
                value={passwordForm.currentPassword}
                onChange={handlePasswordChange}
                className="flex-1 pr-10"
              />
              <Button type="button" size="icon" variant="ghost" onClick={() => setShowCurrentPassword(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 mt-[10px] z-10 p-0 h-7 w-7">
                {showCurrentPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </Button>
            </div>
            <div className="relative">
              <Label htmlFor="newPassword" className="text-muted-foreground mb-1 block">New Password</Label>
              <Input
                id="newPassword"
                name="newPassword"
                type={showNewPassword ? "text" : "password"}
                required
                placeholder="Enter new password"
                value={passwordForm.newPassword}
                onChange={handlePasswordChange}
                className="flex-1 pr-10"
              />
              <Button type="button" size="icon" variant="ghost" onClick={() => setShowNewPassword(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 mt-[10px] z-10 p-0 h-7 w-7">
                {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </Button>
            </div>
            <div className="relative">
              <Label htmlFor="confirmPassword" className="text-muted-foreground mb-1 block">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                required
                placeholder="Confirm new password"
                value={passwordForm.confirmPassword}
                onChange={handlePasswordChange}
                className="flex-1 pr-10"
              />
              <Button type="button" size="icon" variant="ghost" onClick={() => setShowConfirmPassword(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 mt-[10px] z-10 p-0 h-7 w-7">
                {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </Button>
            </div>
            <Button type="submit" className="w-full bg-gradient-to-r from-white to-cyan-200 text-black font-semibold shadow-md border border-border py-2 text-sm hover:opacity-90 dark:from-blue-900 dark:to-cyan-800 dark:text-white">
              <Key className="mr-2 h-5 w-5" /> Update Password
            </Button>
        </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default UserManagement;
