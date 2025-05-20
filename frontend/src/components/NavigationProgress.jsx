"use client"

import { useLocation } from "react-router-dom"
import { ChevronRight } from "lucide-react"

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
      return "Analytics"
    } else if (path === "/heatmap-generation" || path === "/video-processing") {
      return "Heatmap"
    } else if (path === "/user-management") {
      return "User"
    }
    return ""
  }

  const currentTitle = routeTitles[location.pathname] || "Not Found"
  const currentSection = getSection(location.pathname)

  return (
    <div className="flex items-center">
      <h1 className="text-xl font-semibold">RetailSense</h1>
      {currentSection && (
        <>
          <ChevronRight className="mx-2 h-5 w-5 text-muted-foreground" />
          <span className="font-semibold">{currentSection}</span>
        </>
      )}
      {currentTitle && (
        <>
          <ChevronRight className="mx-2 h-5 w-5 text-muted-foreground" />
          <span className="font-semibold">{currentTitle}</span>
        </>
      )}
    </div>
  )
}

export default NavigationProgress
