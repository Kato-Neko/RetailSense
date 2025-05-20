import React, { useEffect, useState } from "react";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar"; // Adjust the import based on your sidebar structure
import { useNavigate } from "react-router-dom";
import { authService } from "../services/api"; // Import authService for user info
import { LogOut, User, Settings, BarChart2, Video, Map } from "lucide-react"; // Import icons
import toast from "react-hot-toast";
import "../styles/SideMenu.css";

const SideMenu = ({ isAuthenticated, setIsAuthenticated }) => {
  const navigate = useNavigate();
  const [userInfo, setUserInfo] = useState(null);

  useEffect(() => {
    const fetchUserInfo = async () => {
      if (isAuthenticated) {
        try {
          const response = await authService.getUserInfo();
          setUserInfo(response);
        } catch (error) {
          console.error("Failed to fetch user info:", error);
        }
      }
    };

    fetchUserInfo();
  }, [isAuthenticated]);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    setIsAuthenticated(false);
    toast.success("Logged out successfully");
    navigate("/");
  };

  return (
    <SidebarMenu className="sidebar-menu">
      <SidebarHeader>
        <div className="logo-container">
          <div className="logo-placeholder">RetailSense</div>
        </div>
      </SidebarHeader>
      <SidebarMenuItem>
        <SidebarMenuButton className="sidebar-menu-button" onClick={() => navigate("/dashboard")}>
          <BarChart2 />
          <span className="menu-text">Dashboard</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton className="sidebar-menu-button" onClick={() => navigate("/video-processing")}>
          <Video />
          <span className="menu-text">Video Processing</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton className="sidebar-menu-button" onClick={() => navigate("/heatmap-generation")}>
          <Map />
          <span className="menu-text">Heatmap Generation</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton className="sidebar-menu-button" onClick={() => navigate("/user-management")}>
          <User />
          <span className="menu-text">User Management</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
      {isAuthenticated && (
        <SidebarMenuItem>
          <SidebarMenuButton className="sidebar-menu-button" onClick={handleLogout}>
            <LogOut />
            <span className="menu-text">Logout</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      )}
      <SidebarFooter>
        <div className="user-info">
          {isAuthenticated && (
            <>
              <User /> {userInfo?.username || "Loading..."}
            </>
          )}
        </div>
      </SidebarFooter>
    </SidebarMenu>
  );
};

export default SideMenu;
