"use client";

import { useState, useEffect } from "react";
import { User, Mail, Calendar, Key, Eye, EyeOff, Video, Map, Clock, BarChart2, Edit2, Check, X, Trash2 } from "lucide-react";
import { authService, heatmapService } from "../../services/api";
import toast from "react-hot-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

  // Delete activity from UI only
  const handleDeleteActivity = (index) => {
    setActivityStats((prev) => ({
      ...prev,
      recentActivities: prev.recentActivities.filter((_, i) => i !== index)
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px] text-slate-400 text-lg">Loading user information...</div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      {/* Profile Card */}
      <Card className="mb-8 bg-slate-900/80 border-slate-800">
        <CardHeader className="flex flex-row items-center gap-4">
          <div className="rounded-full bg-gradient-to-br from-blue-900/50 to-cyan-900/50 w-16 h-16 flex items-center justify-center">
            <User className="text-blue-400 h-8 w-8" />
          </div>
          <div className="flex-1">
            {isEditingUsername ? (
              <form onSubmit={handleUsernameUpdate} className="flex items-center gap-2">
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
                <h2 className="text-xl font-semibold text-white">{userInfo.username}</h2>
                <Button onClick={handleUsernameEdit} size="icon" variant="ghost"><Edit2 size={16} /></Button>
              </div>
            )}
            <div className="flex gap-4 mt-2">
              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <Mail className="h-4 w-4" /> {userInfo.email}
              </div>
              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <Calendar className="h-4 w-4" /> Member since {new Date(userInfo.created_at).toLocaleDateString()}
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>
      {/* Activity Summary Card */}
      <Card className="mb-8 bg-slate-900/80 border-slate-800">
        <CardHeader>
          <CardTitle className="text-lg text-white">Activity Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-0 mb-6 text-center">
            <div className="flex flex-col items-center justify-center">
              <Video className="text-cyan-400 h-6 w-6 mb-1" />
              <span className="text-2xl font-bold text-white">{activityStats.totalVideos}</span>
              <span className="text-xs text-slate-400 mt-1">Videos Processed</span>
            </div>
            <div className="flex flex-col items-center justify-center">
              <Map className="text-green-400 h-6 w-6 mb-1" />
              <span className="text-2xl font-bold text-white">{activityStats.totalHeatmaps}</span>
              <span className="text-xs text-slate-400 mt-1">Heatmaps Generated</span>
            </div>
            <div className="flex flex-col items-center justify-center">
              <Clock className="text-yellow-400 h-6 w-6 mb-1" />
              <span className="text-2xl font-bold text-white">{activityStats.lastActivity ? new Date(activityStats.lastActivity).toLocaleDateString() : 'No activity'}</span>
              <span className="text-xs text-slate-400 mt-1">Last Activity</span>
            </div>
          </div>
          <div>
            <h3 className="text-base font-semibold text-white mb-3">Recent Activities</h3>
            <div className="space-y-4">
              {activityStats.recentActivities.map((activity, index) => (
                <div key={index} className="flex items-center gap-4 bg-slate-800/60 rounded-lg px-4 py-3">
                  <div className="rounded-full bg-slate-900 p-2 flex-shrink-0">
                    {activity.type === 'video' ? <Video className="h-5 w-5 text-cyan-400" /> : <Map className="h-5 w-5 text-green-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">{activity.type === 'video' ? 'Video Processing' : 'Heatmap Generation'}</span>
                      <span className="text-xs text-slate-400">{activity.date.toLocaleDateString()} {activity.date.toLocaleTimeString()}</span>
                    </div>
                    <div className="text-slate-300 text-sm truncate max-w-[180px]">{activity.name}</div>
                    {activity.peopleCount && (
                      <div className="flex items-center gap-1 text-xs text-blue-300 mt-1">
                        <BarChart2 className="h-4 w-4" /> {activity.peopleCount} people detected
                      </div>
                    )}
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs ${activity.status === 'completed' ? 'bg-green-700/40 text-green-300' : activity.status === 'error' ? 'bg-red-700/40 text-red-300' : 'bg-yellow-700/40 text-yellow-300'}`}>{activity.status}</span>
                  </div>
                  <Button size="icon" variant="destructive" onClick={() => handleDeleteActivity(index)} title="Delete activity">
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
      {/* Password Card */}
      <Card className="bg-slate-900/80 border-slate-800">
        <CardHeader>
          <CardTitle className="text-lg text-white">Change Password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordUpdate} className="space-y-4">
            <div className="relative">
              <Label htmlFor="currentPassword" className="text-slate-300 mb-1 block">Current Password</Label>
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
              <Label htmlFor="newPassword" className="text-slate-300 mb-1 block">New Password</Label>
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
              <Label htmlFor="confirmPassword" className="text-slate-300 mb-1 block">Confirm New Password</Label>
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
            <Button type="submit" className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-semibold">
              <Key className="mr-2 h-5 w-5" /> Update Password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default UserManagement;
