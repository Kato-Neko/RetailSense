"use client"

import { useState } from "react"
import { Outlet } from "react-router-dom"
import SideMenu from "../components/SideMenu"
import NavigationProgress from "../components/NavigationProgress"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"

const Base = () => {
  // Control the sidebar open/closed state
  const [open, setOpen] = useState(false)

  return (
    <SidebarProvider open={open} onOpenChange={setOpen}>
      <div className="flex h-screen w-full overflow-hidden bg-background">
        <SideMenu
          isAuthenticated={true} // Pass actual authentication state
          setIsAuthenticated={() => {}} // Pass actual set function
        />

        {/* Main content area that expands to fill available space */}
        <main className="flex flex-col flex-1 h-screen w-full min-h-screen">
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="mr-2" />
            <NavigationProgress />
          </header>

          {/* Content area that fills remaining space */}
          <div className="flex-1 w-full h-full overflow-auto p-4 bg-background">
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  )
}

export default Base
