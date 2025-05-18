"use client";

import { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { Toaster } from "react-hot-toast";
import Navbar from "./components/Navbar";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Register from "./pages/Register";
import VideoProcessing from "./modules/module1/VideoProcessing";
import HeatmapGeneration from "./modules/module2/HeatmapGeneration";
import UserManagement from "./modules/module4/UserManagement";
import apiClient, { authService } from "./services/api";
import "./App.css";
import { ThemeProvider } from "./components/ThemeContext";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkToken = async () => {
      const token = localStorage.getItem("access_token");
      if (token) {
        try {
          await authService.getUserInfo();
          setIsAuthenticated(true);
        } catch (err) {
          localStorage.removeItem("access_token");
          setIsAuthenticated(false);
        }
      }
      setLoading(false);
    };
    checkToken();
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <ThemeProvider>
      <Router>
        <div className="app">
          <Toaster position="top-right" />
          <Navbar
            isAuthenticated={isAuthenticated}
            setIsAuthenticated={setIsAuthenticated}
          />
          <div className="content">
            <Routes>
              <Route
                path="/"
                element={
                  isAuthenticated ? (
                    <Navigate to="/dashboard" />
                  ) : (
                    <Login setIsAuthenticated={setIsAuthenticated} />
                  )
                }
              />
              <Route
                path="/register"
                element={
                  isAuthenticated ? (
                    <Navigate to="/dashboard" />
                  ) : (
                    <Register />
                  )
                }
              />
              <Route
                path="/dashboard"
                element={isAuthenticated ? <Dashboard /> : <Navigate to="/" />}
              />
              <Route
                path="/video-processing"
                element={
                  isAuthenticated ? <VideoProcessing /> : <Navigate to="/" />
                }
              />
              <Route
                path="/heatmap-generation"
                element={
                  isAuthenticated ? <HeatmapGeneration /> : <Navigate to="/" />
                }
              />
              <Route
                path="/user-management"
                element={
                  isAuthenticated ? <UserManagement /> : <Navigate to="/" />
                }
              />
            </Routes>
          </div>
        </div>
      </Router>
    </ThemeProvider>
  );
}

export default App;
