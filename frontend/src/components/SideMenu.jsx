"use client"

import { SidebarRail } from "@/components/ui/sidebar"
import { useState, useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { BarChart2, ChevronDown, Map, User } from "lucide-react"
import { toast } from "sonner"
import { authService } from "../services/api"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
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
    navigate("/?showAuth=true&tab=login")
  }

  // Check if a path is active
  const isActive = (path) => {
    return location.pathname === path
  }

  // Check if a path or any of its children are active
  const isActiveGroup = (paths) => {
    return paths.some((path) => location.pathname.startsWith(path))
  }

  // Get user initials for avatar fallback
  const getUserInitials = () => {
    if (!userInfo || !userInfo.username) return "U"
    return userInfo.username.charAt(0).toUpperCase()
  }

  return (
    <Sidebar className="bg-background dark:bg-gradient-to-b dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 border-r border-border">
      <SidebarHeader className="border-b border-border">
        <div className="flex h-16 items-center px-4 my-2">
          <div className="flex items-center justify-center h-10 w-10 bg-transparent rounded-full p-1 shadow-lg shadow-primary/10">
            <img src="/rs_logo.svg" alt="RetailSense Logo" className="h-7 w-7 object-contain" />
          </div>
          <div className="ml-3">
            <span className="text-lg font-bold bg-gradient-to-r from-primary to-cyan-400 text-transparent bg-clip-text">
              RetailSense
            </span>
            <div className="text-xs text-muted-foreground">Analytics Platform</div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 py-6">
        <SidebarMenu className="space-y-5">
          {/* Analytics Section */}
          <Collapsible defaultOpen={isActiveGroup(["/dashboard"])} className="group/collapsible">
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton
                  className="px-3 py-3 text-base rounded-lg hover:bg-muted group transition-all duration-200"
                  data-active={isActiveGroup(["/dashboard"])}
                >
                  <div className="rounded-lg w-9 h-9 flex items-center justify-center mr-3 transition-all duration-300
                    bg-gradient-to-br
                    from-red-500/20 to-orange-400/20
                    group-hover:from-red-500/30 group-hover:to-orange-400/30
                    group-data-[active=true]:from-red-500/40 group-data-[active=true]:to-orange-400/40">
                    <BarChart2 className="h-5 w-5 text-primary group-data-[active=true]:text-primary" />
                  </div>
                  <span className="ml-1 font-medium group-data-[active=true]:text-foreground text-foreground">Analytics</span>
                  <ChevronDown className="ml-auto h-5 w-5 transition-transform group-data-[state=open]/collapsible:rotate-180 text-muted-foreground" />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub className="ml-12 pl-4 space-y-1 mt-1 border-l border-border">
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton
                      onClick={() => navigate("/dashboard")}
                      isActive={isActive("/dashboard")}
                      className="py-2.5 text-sm rounded-md hover:bg-muted data-[active=true]:bg-gradient-to-r data-[active=true]:from-red-500/20 data-[active=true]:to-orange-400/20 data-[active=true]:text-foreground transition-all duration-200"
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
            defaultOpen={isActiveGroup(["/view-heatmap", "/video-processing"])}
            className="group/collapsible"
          >
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton
                  className="px-3 py-3 text-base rounded-lg hover:bg-muted group transition-all duration-200"
                  data-active={isActiveGroup(["/view-heatmap", "/video-processing"])}
                >
                  <div className="rounded-lg bg-gradient-to-br from-cyan-400/20 to-emerald-400/20 w-9 h-9 flex items-center justify-center mr-3 group-hover:from-cyan-400/30 group-hover:to-emerald-400/30 transition-all duration-300 group-data-[active=true]:from-cyan-400/40 group-data-[active=true]:to-emerald-400/40">
                    <Map className="h-5 w-5 text-primary group-data-[active=true]:text-primary" />
                  </div>
                  <span className="ml-1 font-medium group-data-[active=true]:text-foreground">Heatmap</span>
                  <ChevronDown className="ml-auto h-5 w-5 transition-transform group-data-[state=open]/collapsible:rotate-180 text-muted-foreground" />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub className="ml-12 pl-4 space-y-1 mt-1 border-l border-border">
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton
                      onClick={() => navigate("/view-heatmap")}
                      isActive={isActive("/view-heatmap")}
                      className="py-2.5 text-sm rounded-md hover:bg-muted data-[active=true]:bg-gradient-to-r data-[active=true]:from-cyan-400/20 data-[active=true]:to-emerald-400/20 data-[active=true]:text-foreground transition-all duration-200"
                    >
                      <span>View Heatmaps</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton
                      onClick={() => navigate("/video-processing")}
                      isActive={isActive("/video-processing")}
                      className="py-2.5 text-sm rounded-md hover:bg-muted data-[active=true]:bg-gradient-to-r data-[active=true]:from-cyan-400/20 data-[active=true]:to-emerald-400/20 data-[active=true]:text-foreground transition-all duration-200"
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
                <SidebarMenuButton
                  className="px-3 py-3 text-base rounded-lg hover:bg-muted group transition-all duration-200"
                  data-active={isActiveGroup(["/user-management"])}
                >
                  <div className="rounded-lg bg-gradient-to-br from-purple-400/20 to-pink-400/20 w-9 h-9 flex items-center justify-center mr-3 group-hover:from-purple-400/30 group-hover:to-pink-400/30 transition-all duration-300 group-data-[active=true]:from-purple-400/40 group-data-[active=true]:to-pink-400/40">
                    <User className="h-5 w-5 text-primary group-data-[active=true]:text-primary" />
                  </div>
                  <span className="ml-1 font-medium group-data-[active=true]:text-foreground">User</span>
                  <ChevronDown className="ml-auto h-5 w-5 transition-transform group-data-[state=open]/collapsible:rotate-180 text-muted-foreground" />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub className="ml-12 pl-4 space-y-1 mt-1 border-l border-border">
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton
                      onClick={() => navigate("/user-management")}
                      isActive={isActive("/user-management")}
                      className="py-2.5 text-sm rounded-md hover:bg-muted data-[active=true]:bg-gradient-to-r data-[active=true]:from-purple-400/20 data-[active=true]:to-pink-400/20 data-[active=true]:text-foreground transition-all duration-200"
                    >
                      <span>Account Management</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton
                      onClick={handleLogout}
                      className="py-2.5 text-sm rounded-md hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
                    >
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
          <div className="p-4 mt-auto border-t border-border bg-background dark:bg-gradient-to-r dark:from-slate-900 dark:to-slate-900/80 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12 ring-2 ring-border shadow-lg">
                <AvatarImage
                  src={userInfo?.profileImage || "https://github.com/shadcn.png"}
                  alt={userInfo?.username || "User"}
                />
                <AvatarFallback className="bg-gradient-to-br from-primary to-cyan-400 text-foreground font-medium">
                  {isLoading ? "..." : getUserInitials()}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="text-base font-semibold text-foreground">
                  {isLoading ? "Loading..." : userInfo?.username || "User"}
                </span>
                <span className="text-xs text-muted-foreground truncate max-w-[140px]">
                  {isLoading ? "" : userInfo?.email || ""}
                </span>
              </div>
            </div>
          </div>
        )}
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}

export default SideMenu
