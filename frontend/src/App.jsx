"use client"

import { useState, useEffect } from "react"
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import { Toaster } from "sonner"
import LandingPage from "./pages/LandingPage"
import Dashboard from "./pages/Dashboard"
import CreateHeatmap from "./pages/CreateHeatmap"
import HeatmapGeneration from "./modules/module2/HeatmapGeneration"
import UserManagement from "./modules/module4/UserManagement"
import { authService } from "./services/api"
import "./App.css"
import { ThemeProvider } from "./components/ThemeContext"
import Base from "./pages/Base"
import { UserProvider } from "./contexts/UserContext"

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkToken = async () => {
      const token = localStorage.getItem("access_token")
      if (token) {
        try {
          await authService.getUserInfo()
          setIsAuthenticated(true)
        } catch (err) {
          localStorage.removeItem("access_token")
          setIsAuthenticated(false)
        }
      }
      setLoading(false)
    }
    checkToken()

    // Listen for job completion/cancellation in any tab (storage event)
    const handleStorage = (e) => {
      if (e.key === 'jobCompleted' && e.newValue) {
        const { jobName } = JSON.parse(e.newValue)
        window?.toast?.success?.(`Processing complete for "${jobName}"`) || window.dispatchEvent(new CustomEvent('show-toast', { detail: { type: 'success', message: `Processing complete for "${jobName}"` } }))
        window.dispatchEvent(new Event('dashboard-refresh'))
      }
      if (e.key === 'jobCancelled' && e.newValue) {
        const { jobName } = JSON.parse(e.newValue)
        window?.toast?.info?.(`Processing cancelled for "${jobName}"`) || window.dispatchEvent(new CustomEvent('show-toast', { detail: { type: 'info', message: `Processing cancelled for "${jobName}"` } }))
        window.dispatchEvent(new Event('dashboard-refresh'))
      }
    }
    window.addEventListener('storage', handleStorage)

    // Listen for custom events in the same tab
    const handleJobCompleted = (e) => {
      const { jobName } = e.detail || {}
      window?.toast?.success?.(`Processing complete for "${jobName}"`) || window.dispatchEvent(new CustomEvent('show-toast', { detail: { type: 'success', message: `Processing complete for "${jobName}"` } }))
      window.dispatchEvent(new Event('dashboard-refresh'))
    }
    const handleJobCancelled = (e) => {
      const { jobName } = e.detail || {}
      window?.toast?.info?.(`Processing cancelled for "${jobName}"`) || window.dispatchEvent(new CustomEvent('show-toast', { detail: { type: 'info', message: `Processing cancelled for "${jobName}"` } }))
      window.dispatchEvent(new Event('dashboard-refresh'))
    }
    window.addEventListener('job-completed', handleJobCompleted)
    window.addEventListener('job-cancelled', handleJobCancelled)

    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('job-completed', handleJobCompleted)
      window.removeEventListener('job-cancelled', handleJobCancelled)
    }
  }, [])

  if (loading) return <div>Loading...</div>

  return (
    <ThemeProvider>
      <UserProvider>
        <Router>
          <div className="app">
            <Toaster position="top-right" />
            <Routes>
              <Route
                path="/"
                element={
                  isAuthenticated ? <Navigate to="/dashboard" /> : <LandingPage setIsAuthenticated={setIsAuthenticated} />
                }
              />
              <Route path="/login" element={<Navigate to="/?showAuth=true" replace />} />
              <Route path="/register" element={<Navigate to="/?showAuth=true&tab=register" replace />} />
              <Route path="/" element={<Base />}>
                <Route path="/dashboard" element={isAuthenticated ? <Dashboard /> : <Navigate to="/" />} />
                <Route path="/video-processing" element={isAuthenticated ? <CreateHeatmap /> : <Navigate to="/" />} />
                <Route
                  path="/heatmap-generation"
                  element={isAuthenticated ? <HeatmapGeneration /> : <Navigate to="/" />}
                />
                <Route path="/user-management" element={isAuthenticated ? <UserManagement /> : <Navigate to="/" />} />
              </Route>
            </Routes>
          </div>
        </Router>
      </UserProvider>
    </ThemeProvider>
  )
}

export default App
