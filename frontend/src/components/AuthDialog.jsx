"use client"

import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { authService } from "../services/api"

import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"

// Update the component to accept and use the defaultTab prop
const AuthDialog = ({ isOpen, onOpenChange, setIsAuthenticated, defaultTab = "login" }) => {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState(defaultTab)
  const [showPassword, setShowPassword] = useState(false)
  const [showRegisterPassword, setShowRegisterPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Login form
  const loginFormSchema = z.object({
    email: z.string().email("Invalid email address").min(1, "Email is required"),
    password: z.string().min(1, "Password is required"),
    rememberMe: z.boolean().optional(),
  })

  const loginForm = useForm({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { email: "", password: "", rememberMe: false },
  })

  // Register form
  const registerFormSchema = z
    .object({
      username: z.string().min(1, "Username is required"),
      email: z.string().email("Invalid email address").min(1, "Email is required"),
      password: z.string().min(6, "Password must be at least 6 characters long"),
      confirmPassword: z.string().min(1, "Confirm your password"),
      terms: z.boolean().refine((val) => val === true, {
        message: "You must accept the terms and conditions",
      }),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: "Passwords don't match",
      path: ["confirmPassword"],
    })

  const registerForm = useForm({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
      terms: false,
    },
  })

  const onLoginSubmit = async (data) => {
    try {
      localStorage.removeItem("access_token") // Clear any old token
      const response = await authService.login(data.email, data.password)

      if (response.success && response.access_token) {
        localStorage.setItem("access_token", response.access_token)
        setIsAuthenticated(true)
        toast.success("Login successful")
        navigate("/dashboard")
      } else {
        toast.error(response.message || "Login failed")
      }
    } catch (error) {
      console.error("Login error:", error)
      toast.error(error.message || "Login failed")
    }
  }

  const onRegisterSubmit = async (data) => {
    try {
      const response = await authService.register(data.username, data.email, data.password)
      toast.success("Registration successful! Please login.")
      setActiveTab("login")
      registerForm.reset()
    } catch (error) {
      toast.error(error.message || "Registration failed")
    }
  }

  return (
    // Fix the X button by ensuring the onOpenChange prop is properly handled
    // Update the Dialog component to properly handle the close action
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 p-0 overflow-hidden">
        <div className="relative overflow-hidden">
          {/* Background effects */}
          <div className="absolute inset-0 z-0">
            <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-600 rounded-full opacity-10 blur-3xl"></div>
            <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-cyan-600 rounded-full opacity-10 blur-3xl"></div>
          </div>

          {/* Content */}
          <div className="relative z-10 p-6">
            <div className="flex items-center gap-2 mb-6">
              <div className="flex items-center justify-center h-8 w-8 bg-transparent rounded-full p-1">
                <img src="/rs_logo.svg" alt="RetailSense Logo" className="h-5 w-5 object-contain" />
              </div>
              <span className="text-lg font-bold bg-gradient-to-r from-blue-400 to-cyan-400 text-transparent bg-clip-text">
                RetailSense
              </span>
            </div>

            <Tabs defaultValue="login" className="w-full" value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2 mb-6 bg-slate-800/50 backdrop-blur-sm">
                <TabsTrigger value="login" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                  Login
                </TabsTrigger>
                <TabsTrigger
                  value="register"
                  className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                >
                  Register
                </TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <div className="text-center mb-6">
                  <h3 className="text-xl font-semibold text-white">Welcome back</h3>
                  <p className="text-slate-400 text-sm mt-1">Sign in to your account to continue</p>
                </div>

                <Form {...loginForm}>
                  <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                    <FormField
                      control={loginForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-200">Email</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="name@company.com"
                              className="bg-slate-800/50 backdrop-blur-sm border-slate-700 text-slate-200 focus-visible:ring-blue-500"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={loginForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center justify-between">
                            <FormLabel className="text-slate-200">Password</FormLabel>
                            <Button
                              variant="link"
                              className="h-auto p-0 text-xs text-slate-400 hover:text-blue-400"
                              type="button"
                            >
                              Forgot password?
                            </Button>
                          </div>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type={showPassword ? "text" : "password"}
                                placeholder="••••••••"
                                className="bg-slate-800/50 backdrop-blur-sm border-slate-700 text-slate-200 focus-visible:ring-blue-500"
                                {...field}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-slate-400 hover:text-slate-300"
                                onClick={() => setShowPassword(!showPassword)}
                              >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </Button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={loginForm.control}
                      name="rememberMe"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              className="border-slate-700 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                            />
                          </FormControl>
                          <FormLabel className="text-sm font-normal text-slate-300">Remember me for 30 days</FormLabel>
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 mt-2"
                    >
                      Sign in
                    </Button>
                  </form>
                </Form>

                <div className="mt-6 text-center">
                  <p className="text-sm text-slate-400">
                    Don't have an account?{" "}
                    <Button
                      variant="link"
                      className="p-0 h-auto text-blue-400 hover:text-blue-300"
                      onClick={() => setActiveTab("register")}
                    >
                      Create one
                    </Button>
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="register">
                <div className="text-center mb-6">
                  <h3 className="text-xl font-semibold text-white">Create an account</h3>
                  <p className="text-slate-400 text-sm mt-1">Join RetailSense to get started</p>
                </div>

                <Form {...registerForm}>
                  <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
                    <FormField
                      control={registerForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-200">Username</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="johndoe"
                              className="bg-slate-800/50 backdrop-blur-sm border-slate-700 text-slate-200 focus-visible:ring-blue-500"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={registerForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-200">Email</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="name@company.com"
                              type="email"
                              className="bg-slate-800/50 backdrop-blur-sm border-slate-700 text-slate-200 focus-visible:ring-blue-500"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={registerForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-200">Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type={showRegisterPassword ? "text" : "password"}
                                placeholder="••••••••"
                                className="bg-slate-800/50 backdrop-blur-sm border-slate-700 text-slate-200 focus-visible:ring-blue-500"
                                {...field}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-slate-400 hover:text-slate-300"
                                onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                              >
                                {showRegisterPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </Button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={registerForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-200">Confirm Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type={showConfirmPassword ? "text" : "password"}
                                placeholder="••••••••"
                                className="bg-slate-800/50 backdrop-blur-sm border-slate-700 text-slate-200 focus-visible:ring-blue-500"
                                {...field}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-slate-400 hover:text-slate-300"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              >
                                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </Button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={registerForm.control}
                      name="terms"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-2 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              className="border-slate-700 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 mt-1"
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel className="text-sm font-normal text-slate-300">
                              I agree to the{" "}
                              <a href="#" className="text-blue-400 hover:text-blue-300 underline">
                                terms of service
                              </a>{" "}
                              and{" "}
                              <a href="#" className="text-blue-400 hover:text-blue-300 underline">
                                privacy policy
                              </a>
                            </FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 mt-2"
                    >
                      Create account
                    </Button>
                  </form>
                </Form>

                <div className="mt-6 text-center">
                  <p className="text-sm text-slate-400">
                    Already have an account?{" "}
                    <Button
                      variant="link"
                      className="p-0 h-auto text-blue-400 hover:text-blue-300"
                      onClick={() => setActiveTab("login")}
                    >
                      Sign in
                    </Button>
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default AuthDialog
