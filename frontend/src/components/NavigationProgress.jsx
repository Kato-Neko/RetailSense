"use client"

import { useLocation } from "react-router-dom"
import { ChevronRight, Home } from "lucide-react"

const NavigationProgress = () => {
  const location = useLocation()

  // Map routes to their actual titles from the sidebar menu
  const routeTitles = {
    "/": "Dashboard",
    "/dashboard": "Dashboard",
    "/heatmap-generation": "View Heatmaps",
    "/video-processing": "Create Heatmaps",
    "/user-management": "Account Management",
  }

  // Get the parent section based on the current route
  const getSection = (path) => {
    if (path === "/" || path === "/dashboard") {
      return { name: "Analytics", color: "text-blue-400" }
    } else if (path === "/heatmap-generation" || path === "/video-processing") {
      return { name: "Heatmap", color: "text-cyan-400" }
    } else if (path === "/user-management") {
      return { name: "User", color: "text-purple-400" }
    }
    return { name: "", color: "" }
  }

  const currentTitle = routeTitles[location.pathname] || "Not Found"
  const currentSection = getSection(location.pathname)

  return (
    <div className="flex items-center">
      <div className="flex items-center">
        <Home className="h-4 w-4 text-slate-500" />
        <ChevronRight className="mx-1 h-4 w-4 text-slate-600" />
      </div>

      {currentSection.name && (
        <>
          <span className={`text-sm font-medium ${currentSection.color}`}>{currentSection.name}</span>
          <ChevronRight className="mx-1 h-4 w-4 text-slate-600" />
        </>
      )}

      {currentTitle && (
        <div className="flex items-center">
          <span className="text-sm font-medium text-white">{currentTitle}</span>
          <div className="ml-2 px-1.5 py-0.5 rounded-full bg-slate-800 border border-slate-700">
            <span className="text-xs text-slate-400">v1.0</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default NavigationProgress
