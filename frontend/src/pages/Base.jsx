"use client"

import { useState, useEffect } from "react"
import { Outlet, useLocation } from "react-router-dom"
import SideMenu from "../components/SideMenu"
import NavigationProgress from "../components/NavigationProgress"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTheme } from "../components/ThemeContext"

const Base = () => {
  // Control the sidebar open/closed state
  const [open, setOpen] = useState(true)
  const location = useLocation()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Set mounted to true on client side
  useEffect(() => {
    setMounted(true)
  }, [])

  // Close sidebar on mobile when navigating
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setOpen(false)
      } else {
        setOpen(true)
      }
    }

    handleResize()
    window.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("resize", handleResize)
    }
  }, [location.pathname])

  return (
    <SidebarProvider open={open} onOpenChange={setOpen}>
      <div className="flex h-screen w-full overflow-hidden bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900">
        <SideMenu
          isAuthenticated={true} // Pass actual authentication state
          setIsAuthenticated={() => {}} // Pass actual set function
        />

        {/* Main content area that expands to fill available space */}
        <main className="flex flex-col flex-1 h-screen w-full min-h-screen">
          <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-800/50 px-4 bg-slate-900/80 backdrop-blur-sm z-10">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="text-slate-400 hover:text-white" />
              <NavigationProgress />
            </div>

            <div className="flex items-center">
              {mounted && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  className="text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                </Button>
              )}
            </div>
          </header>

          {/* Content area with transparent background */}
          <div className="flex-1 w-full h-full overflow-auto p-6 bg-transparent">
            <div className="relative">
              {/* Background gradient effects */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-600 rounded-full opacity-5 blur-3xl"></div>
                <div className="absolute top-40 -left-20 w-60 h-60 bg-cyan-600 rounded-full opacity-5 blur-3xl"></div>
              </div>

              {/* Actual content */}
              <div className="relative z-10">
                <Outlet />
              </div>
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  )
}

export default Base
