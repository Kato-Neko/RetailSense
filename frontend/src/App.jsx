"use client"

import { useState, useEffect } from "react"
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import { Toaster } from "@/components/ui/sonner"
import LandingPage from "./pages/LandingPage"
import Dashboard from "./pages/Dashboard"
import CreateHeatmap from "./pages/CreateHeatmap"
import ViewHeatmap from "./pages/ViewHeatmap"
import UserManagement from "./modules/module4/UserManagement"
import AboutPage from "./pages/AboutPage"
import RRLPage from "./pages/RRLPage"
import FeaturesPage from "./pages/FeaturesPage"
import ContactPage from "./pages/ContactPage"
import PrivacyPolicy from "./pages/PrivacyPolicy"
import TermsOfService from "./pages/TermsOfService"
import CookiePolicy from "./pages/CookiePolicy"
import DPA from "./pages/DPA"
import { authService } from "./services/api"
import "./App.css"
import { ThemeProvider } from "./components/ThemeContext"
import Base from "./pages/Base"

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
            <Route path="/about" element={<AboutPage />} />
            <Route path="/rrl" element={<RRLPage />} />
            <Route path="/features" element={<FeaturesPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="/cookie-policy" element={<CookiePolicy />} />
            <Route path="/dpa" element={<DPA />} />
            <Route path="/" element={<Base />}>
              <Route path="/dashboard" element={isAuthenticated ? <Dashboard /> : <Navigate to="/" />} />
              <Route path="/video-processing" element={isAuthenticated ? <CreateHeatmap /> : <Navigate to="/" />} />
              <Route
                path="/view-heatmap"
                element={isAuthenticated ? (
                  <ViewHeatmap />
                ) : <Navigate to="/" />}
              />
              <Route path="/user-management" element={isAuthenticated ? <UserManagement /> : <Navigate to="/" />} />
            </Route>
          </Routes>
        </div>
      </Router>
    </ThemeProvider>
  )
}

export default App