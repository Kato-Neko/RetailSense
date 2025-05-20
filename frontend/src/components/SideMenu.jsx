"use client"

import { useState, useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { BarChart2, ChevronDown, Map, User } from "lucide-react"
import toast from "react-hot-toast"
import { authService } from "../services/api"

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
        <div className="flex h-14 items-center px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sidebar-primary text-sidebar-primary-foreground">
            <span className="text-xs font-bold">RS</span>
          </div>
          <span className="ml-2 text-sm font-semibold">RetailSense</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarMenu>
          {/* Analytics Section */}
          <Collapsible defaultOpen={isActiveGroup(["/dashboard"])} className="group/collapsible">
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton>
                  <BarChart2 className="h-4 w-4" />
                  <span>Analytics</span>
                  <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton onClick={() => navigate("/dashboard")} isActive={isActive("/dashboard")}>
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
                <SidebarMenuButton>
                  <Map className="h-4 w-4" />
                  <span>Heatmap</span>
                  <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton
                      onClick={() => navigate("/heatmap-generation")}
                      isActive={isActive("/heatmap-generation")}
                    >
                      <span>View Heatmaps</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton
                      onClick={() => navigate("/video-processing")}
                      isActive={isActive("/video-processing")}
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
                <SidebarMenuButton>
                  <User className="h-4 w-4" />
                  <span>User</span>
                  <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton
                      onClick={() => navigate("/user-management")}
                      isActive={isActive("/user-management")}
                    >
                      <span>Account Management</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton onClick={handleLogout}>
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
        {isAuthenticated && (
          <div className="flex items-center p-2 border-t border-sidebar-border">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-primary text-sidebar-primary-foreground">
              <User className="h-4 w-4" />
            </div>
            <div className="ml-2 flex flex-col">
              <span className="text-sm font-semibold">{isLoading ? "Loading..." : userInfo?.username || "User"}</span>
              <span className="text-xs text-sidebar-foreground/70">{isLoading ? "" : userInfo?.email || ""}</span>
            </div>
          </div>
        )}
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}

export default SideMenu
