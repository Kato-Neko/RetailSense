"use client"

import { useState, useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { useTheme } from "./ThemeContext"

const navLinks = [
  { label: "Features", to: "/features" },
  { label: "About", to: "/about" },
  { label: "Contact", to: "/contact" },
]

const PublicHeader = ({ onSignIn }) => {
  const { isDarkMode, toggleTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex h-16 items-center justify-between">
        <div className="flex items-center gap-2 cursor-pointer select-none" onClick={() => navigate("/") }>
          <div className="flex items-center justify-center h-10 w-10 bg-transparent rounded-full p-1">
            <img src="/rs_logo.svg" alt="RetailSense Logo" className="h-7 w-7 object-contain" />
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-primary to-cyan-400 text-transparent bg-clip-text">
            RetailSense
          </span>
        </div>
        <div className="hidden md:flex gap-6 items-center ml-auto">
          {navLinks.map(link => {
            const isActive = location.pathname === link.to || (link.to !== "/" && location.pathname.startsWith(link.to));
            return (
              <Button
                key={link.label}
                variant="ghost"
                className={`text-sm hover:text-foreground hover:bg-muted ${isActive ? "font-bold text-foreground" : "text-muted-foreground"}`}
                onClick={() => navigate(link.to)}
              >
                {link.label}
              </Button>
            );
          })}
        </div>
        <div className="hidden md:flex items-center ml-8">
          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
          )}
        </div>
        <div className="md:hidden flex items-center gap-2">
          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
          )}
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="border-border bg-muted/50 text-foreground hover:bg-muted"
              >
                Menu
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="border-border bg-background">
              <div className="flex items-center gap-2 mb-8">
                <div className="flex items-center justify-center h-8 w-8 bg-transparent rounded-full p-1">
                  <img src="/rs_logo.svg" alt="RetailSense Logo" className="h-5 w-5 object-contain" />
                </div>
                <span className="text-lg font-bold bg-gradient-to-r from-primary to-cyan-400 text-transparent bg-clip-text">
                  RetailSense
                </span>
              </div>
              <div className="flex flex-col gap-4 mt-8">
                {navLinks.map(link => {
                  const isActive = location.pathname === link.to || (link.to !== "/" && location.pathname.startsWith(link.to));
                  return (
                    <Button
                      key={link.label}
                      variant="ghost"
                      className={`justify-start hover:text-foreground hover:bg-muted ${isActive ? "font-bold text-foreground" : "text-muted-foreground"}`}
                      onClick={() => navigate(link.to)}
                    >
                      {link.label}
                    </Button>
                  );
                })}
                <Button
                  onClick={onSignIn ? onSignIn : () => navigate('/?showAuth=true')}
                  className="justify-start bg-gradient-to-r from-primary to-cyan-400 hover:from-primary/90 hover:to-cyan-400/90 text-white mt-4"
                >
                  Sign In
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}

export default PublicHeader 