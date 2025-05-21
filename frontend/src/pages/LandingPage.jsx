"use client"

import { useState, useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { ArrowRight, BarChart2, Map, Users, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import AuthDialog from "../components/AuthDialog"
import HeatmapVisualizer from "../components/HeatmapVisualizer"
import AnalyticsChart from "../components/AnalyticsChart"

const LandingPage = ({ setIsAuthenticated }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const [isAuthOpen, setIsAuthOpen] = useState(false)

  // Add state for active auth tab
  const [activeAuthTab, setActiveAuthTab] = useState("login")

  // Check if we should show the auth dialog based on URL parameters
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search)
    if (searchParams.get("showAuth") === "true") {
      setIsAuthOpen(true)

      // If tab parameter is present, set the active tab
      const tab = searchParams.get("tab")
      if (tab === "register") {
        // We need to pass this to the AuthDialog component
        setActiveAuthTab("register")
      }
    }
  }, [location.search])

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Auth Dialog */}
      <AuthDialog
        isOpen={isAuthOpen}
        onOpenChange={setIsAuthOpen}
        setIsAuthenticated={setIsAuthenticated}
        defaultTab={activeAuthTab}
      />

      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/95 backdrop-blur supports-[backdrop-filter]:bg-slate-950/60 sticky top-0 z-50">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center h-10 w-10 bg-transparent rounded-full p-1">
              <img src="/rs_logo.svg" alt="RetailSense Logo" className="h-7 w-7 object-contain" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 text-transparent bg-clip-text">
              RetailSense
            </span>
          </div>
          <div className="hidden md:flex gap-6 items-center">
            <Button variant="ghost" className="text-sm text-slate-300 hover:text-white hover:bg-slate-800">
              Features
            </Button>
            <Button variant="ghost" className="text-sm text-slate-300 hover:text-white hover:bg-slate-800">
              Pricing
            </Button>
            <Button variant="ghost" className="text-sm text-slate-300 hover:text-white hover:bg-slate-800">
              About
            </Button>
            <Button variant="ghost" className="text-sm text-slate-300 hover:text-white hover:bg-slate-800">
              Contact
            </Button>
            <Button
              variant="outline"
              className="ml-4 border-slate-700 bg-slate-800/50 text-white hover:bg-slate-700 hover:text-white"
              onClick={() => setIsAuthOpen(true)}
            >
              Sign In
            </Button>
          </div>
          <div className="md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-slate-700 bg-slate-800/50 text-white hover:bg-slate-700"
                >
                  Menu
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="border-slate-800 bg-slate-900">
                <div className="flex items-center gap-2 mb-8">
                  <div className="flex items-center justify-center h-8 w-8 bg-transparent rounded-full p-1">
                    <img src="/rs_logo.svg" alt="RetailSense Logo" className="h-5 w-5 object-contain" />
                  </div>
                  <span className="text-lg font-bold bg-gradient-to-r from-blue-400 to-cyan-400 text-transparent bg-clip-text">
                    RetailSense
                  </span>
                </div>
                <div className="flex flex-col gap-4 mt-8">
                  <Button variant="ghost" className="justify-start text-slate-300 hover:text-white hover:bg-slate-800">
                    Features
                  </Button>
                  <Button variant="ghost" className="justify-start text-slate-300 hover:text-white hover:bg-slate-800">
                    Pricing
                  </Button>
                  <Button variant="ghost" className="justify-start text-slate-300 hover:text-white hover:bg-slate-800">
                    About
                  </Button>
                  <Button variant="ghost" className="justify-start text-slate-300 hover:text-white hover:bg-slate-800">
                    Contact
                  </Button>
                  <Separator className="bg-slate-800" />
                  <Button
                    onClick={() => {
                      setIsAuthOpen(true)
                    }}
                    className="justify-start bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
                  >
                    Sign In
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-20 overflow-hidden">
        {/* Background gradient effects */}
        <div className="absolute inset-0 bg-slate-950 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-600 rounded-full opacity-20 blur-3xl"></div>
          <div className="absolute top-40 -left-20 w-60 h-60 bg-cyan-600 rounded-full opacity-20 blur-3xl"></div>
        </div>

        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="flex flex-col justify-center space-y-6">
            <div className="inline-block rounded-full bg-slate-800/50 px-3 py-1 text-sm text-cyan-400 backdrop-blur border border-slate-700">
              Retail Analytics Reimagined
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white leading-tight">
              Transform Your{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
                Retail Space
              </span>{" "}
              with AI-Powered Insights
            </h1>
            <p className="text-slate-300 text-lg max-w-xl">
              RetailSense helps you understand customer behavior through advanced foot traffic analysis, turning your
              surveillance footage into actionable business intelligence.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 mt-4">
              <Button
                size="lg"
                className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 gap-2"
                onClick={() => setIsAuthOpen(true)}
              >
                Get Started <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="border-slate-700 bg-slate-800/50 text-white hover:bg-slate-700 hover:text-white"
              >
                Watch Demo
              </Button>
            </div>
          </div>
          <div className="hidden lg:block relative">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-cyan-600/10 rounded-xl"></div>
            <div className="relative bg-slate-900/80 backdrop-blur-sm rounded-xl border border-slate-800 p-6 shadow-2xl">
              <h3 className="text-lg font-medium text-white mb-4">Foot Traffic Heatmap</h3>
              <HeatmapVisualizer />
            </div>
            <div className="absolute -bottom-6 -right-6 w-64 h-64 bg-blue-600/20 rounded-full blur-3xl"></div>
          </div>
        </div>
      </section>

      {/* Analytics Section */}
      <section className="relative py-16">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1 hidden lg:block relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-cyan-600/10 rounded-xl"></div>
              <div className="relative bg-slate-900/80 backdrop-blur-sm rounded-xl border border-slate-800 p-6 shadow-2xl">
                <h3 className="text-lg font-medium text-white mb-4">Weekly Visitor Analytics</h3>
                <AnalyticsChart />
              </div>
            </div>
            <div className="order-1 lg:order-2 flex flex-col justify-center space-y-6">
              <div className="inline-block rounded-full bg-slate-800/50 px-3 py-1 text-sm text-cyan-400 backdrop-blur border border-slate-700">
                Data-Driven Decisions
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white leading-tight">
                Gain{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
                  Actionable Insights
                </span>{" "}
                from Your Retail Space
              </h2>
              <p className="text-slate-300 text-lg max-w-xl">
                Our advanced analytics platform transforms raw foot traffic data into clear, actionable insights that
                help you optimize store layouts, product placements, and staffing decisions.
              </p>
              <ul className="space-y-3">
                {[
                  "Identify high-traffic areas and optimize product placement",
                  "Understand customer flow patterns throughout your store",
                  "Measure the impact of layout changes with before/after comparisons",
                  "Optimize staffing based on customer traffic patterns",
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <div className="rounded-full bg-gradient-to-r from-blue-600 to-cyan-600 p-1 mt-1">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-white"
                      >
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    </div>
                    <span className="text-slate-300">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative py-20 bg-slate-900/50">
        <div className="absolute inset-0 bg-slate-950 overflow-hidden">
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-600 rounded-full opacity-10 blur-3xl"></div>
          <div className="absolute -top-20 right-20 w-60 h-60 bg-cyan-600 rounded-full opacity-10 blur-3xl"></div>
        </div>
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Key Features</h2>
            <p className="text-slate-300 max-w-2xl mx-auto">
              RetailSense provides a comprehensive suite of tools to help you understand and optimize your retail space.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: <Map className="h-6 w-6 text-cyan-400" />,
                title: "Foot Traffic Heatmaps",
                description:
                  "Visualize customer movement patterns with advanced AI-powered heatmaps to identify high-traffic areas.",
              },
              {
                icon: <BarChart2 className="h-6 w-6 text-cyan-400" />,
                title: "Analytics Dashboard",
                description:
                  "Gain actionable insights with comprehensive analytics and reporting tools that make data interpretation simple.",
              },
              {
                icon: <Users className="h-6 w-6 text-cyan-400" />,
                title: "Customer Behavior Analysis",
                description:
                  "Understand customer behavior to optimize store layouts and product placement for maximum engagement.",
              },
            ].map((feature, index) => (
              <Card
                key={index}
                className="bg-slate-900/80 backdrop-blur-sm border-slate-800 hover:border-slate-700 transition-all duration-300 hover:shadow-lg hover:shadow-blue-900/20 group"
              >
                <CardContent className="p-6">
                  <div className="rounded-full bg-gradient-to-br from-blue-900/50 to-cyan-900/50 w-12 h-12 flex items-center justify-center mb-4 group-hover:from-blue-800/50 group-hover:to-cyan-800/50 transition-all duration-300">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">{feature.title}</h3>
                  <p className="text-slate-300">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-20">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-8 md:p-12 shadow-2xl border border-slate-700 overflow-hidden relative">
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-600 rounded-full opacity-20 blur-3xl"></div>
              <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-cyan-600"></div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center relative">
              <div>
                <h2 className="text-3xl font-bold text-white mb-4">Ready to optimize your retail space?</h2>
                <p className="text-slate-300 mb-6">
                  Join retailers who have increased sales by up to 25% through optimized store layouts and product
                  placements.
                </p>
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 gap-2"
                  onClick={() => setIsAuthOpen(true)}
                >
                  Start Free Trial <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="hidden lg:block">
                <div className="bg-slate-800/80 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
                  <div className="text-white font-medium mb-4">What our customers say</div>
                  <blockquote className="text-slate-300 italic">
                    "RetailSense has completely transformed how we approach store layouts. The insights we've gained
                    have directly contributed to a 20% increase in sales."
                  </blockquote>
                  <div className="mt-4 text-slate-400 text-sm flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-white">
                      SJ
                    </div>
                    <div>
                      <div className="text-slate-200">Sarah Johnson</div>
                      <div className="text-slate-400 text-xs">Retail Operations Manager</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 py-12">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center h-8 w-8 bg-transparent rounded-full p-1">
                  <img src="/rs_logo.svg" alt="RetailSense Logo" className="h-5 w-5 object-contain" />
                </div>
                <span className="text-lg font-bold bg-gradient-to-r from-blue-400 to-cyan-400 text-transparent bg-clip-text">
                  RetailSense
                </span>
              </div>
              <p className="text-slate-400 text-sm">
                Advanced AI-powered retail analytics to optimize your store layout and increase sales.
              </p>
            </div>
            <div>
              <h4 className="text-white font-medium mb-4">Product</h4>
              <ul className="space-y-2">
                {["Features", "Pricing", "Case Studies", "Documentation"].map((item, index) => (
                  <li key={index}>
                    <a href="#" className="text-slate-400 hover:text-white text-sm">
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-white font-medium mb-4">Company</h4>
              <ul className="space-y-2">
                {["About", "Careers", "Blog", "Contact"].map((item, index) => (
                  <li key={index}>
                    <a href="#" className="text-slate-400 hover:text-white text-sm">
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-white font-medium mb-4">Legal</h4>
              <ul className="space-y-2">
                {["Privacy Policy", "Terms of Service", "Cookie Policy", "GDPR"].map((item, index) => (
                  <li key={index}>
                    <a href="#" className="text-slate-400 hover:text-white text-sm">
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center">
            <div className="text-sm text-slate-400">© 2025 RetailSense. All rights reserved.</div>
            <div className="flex gap-4 mt-4 md:mt-0">
              {["Twitter", "LinkedIn", "GitHub", "YouTube"].map((item, index) => (
                <a key={index} href="#" className="text-slate-400 hover:text-white text-sm">
                  {item}
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage
