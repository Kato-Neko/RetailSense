"use client"

import { useLocation } from "react-router-dom"
import { ChevronRight, Home } from "lucide-react"

const NavigationProgress = () => {
  const location = useLocation()

  // Map routes to their actual titles from the sidebar menu
  const routeTitles = {
    "/": "Dashboard",
    "/dashboard": "Dashboard",
    "/view-heatmap": "View Heatmaps",
    "/video-processing": "Create Heatmaps",
    "/user-management": "Account Management",
  }

  // Get the parent section based on the current route
  const getSection = (path) => {
    if (path === "/" || path === "/dashboard") {
      return { name: "Analytics", color: "text-orange-500 dark:text-orange-400" }
    } else if (path === "/view-heatmap" || path === "/video-processing") {
      return { name: "Heatmap", color: "text-cyan-500 dark:text-cyan-400" }
    } else if (path === "/user-management") {
      return { name: "User", color: "text-purple-500 dark:text-purple-400" }
    }
    return { name: "", color: "" }
  }

  const currentTitle = routeTitles[location.pathname] || "Not Found"
  const currentSection = getSection(location.pathname)

  return (
    <div className="flex items-center w-full">
      <div className="flex items-center flex-1 min-w-0">
        <Home className="h-4 w-4 text-muted-foreground" />
        <ChevronRight className="mx-1 h-4 w-4 text-muted-foreground" />
        {currentSection.name && (
          <>
            <span className={`text-sm font-medium ${currentSection.color}`}>{currentSection.name}</span>
            <ChevronRight className="mx-1 h-4 w-4 text-muted-foreground" />
          </>
        )}
        {currentTitle && (
          <div className="flex items-center">
            <span className="text-sm font-medium text-foreground">{currentTitle}</span>
            <div className="ml-2 px-1.5 py-0.5 rounded-full bg-muted border border-border">
              <span className="text-xs text-muted-foreground">v1.0</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default NavigationProgress
