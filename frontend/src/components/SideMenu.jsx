"use client"

import { useState, useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { BarChart2, ChevronDown, Map, User, Moon, Sun } from "lucide-react"
import toast from "react-hot-toast"
import { authService } from "../services/api"
import { useTheme } from "../contexts/ThemeContext"

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar"

const SideMenu = ({ isAuthenticated, setIsAuthenticated }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const [userInfo, setUserInfo] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const { isDarkMode, toggleTheme } = useTheme()

  useEffect(() => {
    if (isAuthenticated) {
      fetchUserInfo()
    }
  }, [isAuthenticated])

  const fetchUserInfo = async () => {
    try {
      const response = await authService.getUserInfo()
      setUserInfo(response)
      setIsLoading(false)
    } catch (error) {
      console.error("Failed to fetch user info:", error)
      setIsLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem("access_token")
    setIsAuthenticated(false)
    toast.success("Logged out successfully")
    navigate("/")
  }

  // Check if a path is active
  const isActive = (path) => {
    return location.pathname === path
  }

  // Check if a path or any of its children are active
  const isActiveGroup = (paths) => {
    return paths.some((path) => location.pathname.startsWith(path))
  }

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex h-16 items-center px-3 my-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sidebar-primary text-sidebar-primary-foreground">
            <span className="text-base font-bold">RS</span>
          </div>
          <span className="ml-3 text-lg font-semibold">RetailSense</span>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarMenu className="space-y-3">
          {/* Analytics Section */}
          <Collapsible defaultOpen={isActiveGroup(["/dashboard"])} className="group/collapsible">
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton className="px-3 py-3 text-base">
                  <BarChart2 className="h-5 w-5" />
                  <span className="ml-1">Analytics</span>
                  <ChevronDown className="ml-auto h-5 w-5 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub className="ml-10 pl-4 space-y-2 mt-1">
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton
                      onClick={() => navigate("/dashboard")}
                      isActive={isActive("/dashboard")}
                      className="py-2.5 text-sm"
                    >
                      <span>Dashboard</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>

          {/* Heatmap Section */}
          <Collapsible
            defaultOpen={isActiveGroup(["/heatmap-generation", "/video-processing"])}
            className="group/collapsible"
          >
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton className="px-3 py-3 text-base">
                  <Map className="h-5 w-5" />
                  <span className="ml-1">Heatmap</span>
                  <ChevronDown className="ml-auto h-5 w-5 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub className="ml-10 pl-4 space-y-2 mt-1">
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton
                      onClick={() => navigate("/heatmap-generation")}
                      isActive={isActive("/heatmap-generation")}
                      className="py-2.5 text-sm"
                    >
                      <span>View Heatmaps</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton
                      onClick={() => navigate("/video-processing")}
                      isActive={isActive("/video-processing")}
                      className="py-2.5 text-sm"
                    >
                      <span>Create Heatmaps</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>

          {/* User Section */}
          <Collapsible defaultOpen={isActiveGroup(["/user-management"])} className="group/collapsible">
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton className="px-3 py-3 text-base">
                  <User className="h-5 w-5" />
                  <span className="ml-1">User</span>
                  <ChevronDown className="ml-auto h-5 w-5 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub className="ml-10 pl-4 space-y-2 mt-1">
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton
                      onClick={() => navigate("/user-management")}
                      isActive={isActive("/user-management")}
                      className="py-2.5 text-sm"
                    >
                      <span>Account Management</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton onClick={handleLogout} className="py-2.5 text-sm">
                      <span>Logout</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center justify-center p-2 border-t border-sidebar-border">
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-sidebar-ring focus:ring-offset-2"
              style={{
                backgroundColor: isDarkMode ? '#4a90e2' : '#e5e7eb'
              }}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isDarkMode ? 'translate-x-4' : 'translate-x-1'
                }`}
              />
            </button>
            <span className="text-sm text-sidebar-foreground/70">
              {isDarkMode ? 'Dark Mode' : 'Light Mode'}
            </span>
          </div>
        </div>
        {isAuthenticated && (
          <>
            <div className="flex items-center p-4 mt-4 border-t border-sidebar-border">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sidebar-primary text-sidebar-primary-foreground">
                <User className="h-5 w-5" />
              </div>
              <div className="ml-3 flex flex-col">
                <span className="text-base font-semibold">{isLoading ? "Loading..." : userInfo?.username || "User"}</span>
                <span className="text-sm text-sidebar-foreground/70">{isLoading ? "" : userInfo?.email || ""}</span>
              </div>
            </div>
            
          </>
        )}
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}

export default SideMenu
