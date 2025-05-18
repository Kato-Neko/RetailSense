"use client";

import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { 
  Menu, 
  X, 
  BarChart2, 
  Video, 
  Map, 
  LogOut, 
  User, 
  Settings,
  Sun,
  Moon
} from "lucide-react";
import toast from "react-hot-toast";
import { authService } from "../services/api";
import { useTheme } from "./ThemeContext";
import "../styles/Navbar.css";

const Navbar = ({ isAuthenticated, setIsAuthenticated }) => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const { isDarkMode, toggleTheme } = useTheme();

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
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-logo">
          <Link to="/" className="logo-text">
            RetailSense
          </Link>
        </div>
        <div className="navbar-links-desktop">
          {isAuthenticated && (
            <div className="nav-links">
              <Link to="/dashboard" className="nav-link">
                <BarChart2 className="nav-icon" /> Dashboard
              </Link>
              <Link to="/video-processing" className="nav-link">
                <Video className="nav-icon" /> Video Processing
              </Link>
              <Link to="/heatmap-generation" className="nav-link">
                <Map className="nav-icon" /> Heatmap Generation
              </Link>
            </div>
          )}
        </div>
        <div className="navbar-actions">
          {isAuthenticated && (
            <div className="profile-dropdown-wrapper">
              <button
                onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                className="profile-icon-btn"
              > 
                <User className="nav-icon" />
              </button>
              {showProfileDropdown && (
                <div className="profile-dropdown-card">
                  <p className="profile-name">{userInfo?.username || 'Loading...'}</p>
                  <Link to="/user-management" className="profile-link">
                    <Settings className="profile-icon" /> My Profile
                  </Link>
                  <button onClick={toggleTheme} className="theme-toggle-btn">
                    {isDarkMode ? (
                      <Sun className="profile-icon" />
                    ) : (
                      <Moon className="profile-icon" />
                    )}
                    {isDarkMode ? 'Light Mode' : 'Dark Mode'}
                  </button>
                  <button onClick={handleLogout} className="logout-btn">
                    <LogOut className="profile-icon" /> Logout
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="navbar-mobile-toggle">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="mobile-menu-btn"
          >
            <span className="sr-only">Open main menu</span>
            {isOpen ? (
              <X className="menu-icon" />
            ) : (
              <Menu className="menu-icon" />
            )}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="navbar-mobile-menu">
          {isAuthenticated ? (
            <div className="mobile-links">
              <Link
                to="/dashboard"
                className="mobile-link"
                onClick={() => setIsOpen(false)}
              >
                <BarChart2 className="nav-icon" /> Dashboard
              </Link>
              <Link
                to="/video-processing"
                className="mobile-link"
                onClick={() => setIsOpen(false)}
              >
                <Video className="nav-icon" /> Video Processing
              </Link>
              <Link
                to="/heatmap-generation"
                className="mobile-link"
                onClick={() => setIsOpen(false)}
              >
                <Map className="nav-icon" /> Heatmap Generation
              </Link>
              <button
                onClick={() => {
                  handleLogout();
                  setIsOpen(false);
                }}
                className="mobile-logout-btn"
              >
                <LogOut className="nav-icon" /> Logout
              </button>
            </div>
          ) : (
            <div className="mobile-links">
              <Link
                to="/"
                className="mobile-link"
                onClick={() => setIsOpen(false)}
              >
                Login
              </Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
