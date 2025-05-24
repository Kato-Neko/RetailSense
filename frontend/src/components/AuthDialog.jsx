"use client"

import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { authService } from "../services/api"

import { Dialog, DialogContent, DialogClose, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { X as XIcon } from "lucide-react"
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/ui/input-otp"

// Update the component to accept and use the defaultTab prop
const AuthDialog = ({ isOpen, onOpenChange, setIsAuthenticated, defaultTab = "login" }) => {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState(defaultTab)
  const [showPassword, setShowPassword] = useState(false)
  const [showRegisterPassword, setShowRegisterPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [forgotOpen, setForgotOpen] = useState(false)
  const [forgotEmail, setForgotEmail] = useState("")
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotSuccess, setForgotSuccess] = useState("")
  const [forgotError, setForgotError] = useState("")
  const [otpStep, setOtpStep] = useState(1)
  const [otp, setOtp] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [forgotStep, setForgotStep] = useState(1)
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [resetPassword, setResetPassword] = useState("")
  const [resetConfirmPassword, setResetConfirmPassword] = useState("")
  const [showResetPasswords, setShowResetPasswords] = useState(false)

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

  const handleForgotEmailSubmit = async (e) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotSuccess("");
    setForgotError("");
    try {
      const response = await authService.requestOtp(forgotEmail);
      setForgotSuccess(response.message || "OTP sent to your email.");
      setForgotStep(2);
    } catch (err) {
      setForgotError(err.error || err.message || "Failed to send reset email. Try again later.");
      toast.error(err.error || err.message || "Failed to send reset email. Try again later.");
    } finally {
      setForgotLoading(false);
    }
  }

  const handleOtpVerify = async (e) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotSuccess("");
    setForgotError("");
    try {
      await authService.verifyOtpOnly(forgotEmail, otp);
      setForgotStep(3); // Only advance if no error
    } catch (err) {
      const errorMsg = (err.error || err.message || "").toLowerCase();
      if (errorMsg.includes("expired")) {
        setForgotError("OTP has expired. Please request a new one.");
      } else if (errorMsg.includes("invalid")) {
        setForgotError("The OTP you entered is incorrect.");
      } else {
        setForgotError(err.error || err.message || "Invalid or expired OTP. Try again.");
      }
      toast.error(err.error || err.message || "Invalid or expired OTP. Try again.");
    } finally {
      setForgotLoading(false);
    }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotSuccess("");
    setForgotError("");
    if (resetPassword !== resetConfirmPassword) {
      setForgotError("Passwords do not match.");
      setForgotLoading(false);
      return;
    }
    try {
      await authService.verifyOtp(forgotEmail, otp, resetPassword);
      setForgotSuccess("Password updated successfully.");
      setForgotStep(4);
      // Clear sensitive fields after success
      setForgotEmail("");
      setOtp("");
      setResetPassword("");
      setResetConfirmPassword("");
    } catch (err) {
      const errorMsg = (err.error || err.message || "").toLowerCase();
      if (errorMsg.includes("expired")) {
        setForgotError("OTP has expired. Please request a new one.");
        setTimeout(() => setForgotStep(1), 2000);
      } else if (errorMsg.includes("invalid")) {
        setForgotError("The OTP you entered is incorrect or has already been used.");
        setTimeout(() => setForgotStep(1), 2000);
      } else {
        setForgotError(err.error || err.message || "Failed to reset password. Try again later.");
      }
      toast.error(err.error || err.message || "Failed to reset password. Try again later.");
      // Clear sensitive fields after failure
      setForgotEmail("");
      setOtp("");
      setResetPassword("");
      setResetConfirmPassword("");
    } finally {
      setForgotLoading(false);
    }
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md border-border bg-gradient-to-b from-background to-muted p-0 overflow-hidden dark:from-slate-900 dark:to-slate-950">
          <DialogTitle style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>
            Authentication Dialog
          </DialogTitle>
          <DialogDescription style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>
            Please sign in or register to access RetailSense.
          </DialogDescription>
          <DialogClose asChild>
            <button
              aria-label="Close"
              className="absolute top-3 right-3 z-20 rounded-full p-2 bg-muted/70 hover:bg-muted/90 text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              onClick={() => onOpenChange(false)}
            >
              <XIcon className="h-5 w-5" />
            </button>
          </DialogClose>
          <div className="relative overflow-hidden">
            {/* Background effects */}
            <div className="absolute inset-0 z-0">
              <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-400 dark:bg-blue-600 rounded-full opacity-10 blur-3xl"></div>
              <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-cyan-400 dark:bg-cyan-600 rounded-full opacity-10 blur-3xl"></div>
            </div>

            {/* Content */}
            <div className="relative z-10 p-6">
              <div className="flex items-center gap-2 mb-6">
                <div className="flex items-center justify-center h-8 w-8 bg-transparent rounded-full p-1">
                  <img src="/rs_logo.svg" alt="RetailSense Logo" className="h-5 w-5 object-contain" />
                </div>
                <span className="text-lg font-bold bg-gradient-to-r from-primary to-cyan-400 text-transparent bg-clip-text">
                  RetailSense
                </span>
              </div>

              <Tabs defaultValue="login" className="w-full" value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-2 bg-transparent mb-6 gap-2">
                  <div className="h-12 flex items-center justify-center rounded-xl transition-all p-[2px]"
                    style={{
                      background: activeTab === 'login' ? 'linear-gradient(to right, #3b82f6, #06b6d4)' : 'transparent',
                    }}
                  >
                    <div className="flex-1 h-11 flex items-center justify-center rounded-[10px] bg-white dark:bg-slate-950">
                      <TabsTrigger
                        value="login"
                        className="w-full h-full flex items-center justify-center rounded-[10px] font-semibold transition-all text-muted-foreground data-[state=active]:text-black dark:data-[state=active]:text-white data-[state=active]:font-bold bg-transparent border-none shadow-none"
                      >
                        Login
                      </TabsTrigger>
                    </div>
                  </div>
                  <div className="h-12 flex items-center justify-center rounded-xl transition-all p-[2px]"
                    style={{
                      background: activeTab === 'register' ? 'linear-gradient(to right, #3b82f6, #06b6d4)' : 'transparent',
                    }}
                  >
                    <div className="flex-1 h-11 flex items-center justify-center rounded-[10px] bg-white dark:bg-slate-950">
                      <TabsTrigger
                        value="register"
                        className="w-full h-full flex items-center justify-center rounded-[10px] font-semibold transition-all text-muted-foreground data-[state=active]:text-black dark:data-[state=active]:text-white data-[state=active]:font-bold bg-transparent border-none shadow-none"
                      >
                        Register
                      </TabsTrigger>
                    </div>
                  </div>
                </TabsList>

                <TabsContent value="login">
                  <div className="text-center mb-6">
                    <h3 className="text-xl font-semibold text-foreground">Welcome back</h3>
                    <p className="text-muted-foreground text-sm mt-1">Sign in to your account to continue</p>
                  </div>

                  <Form {...loginForm}>
                    <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                      <FormField
                        control={loginForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-foreground">Email</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="name@company.com"
                                className="bg-muted/60 border-border text-foreground focus-visible:ring-primary"
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
                              <FormLabel className="text-foreground">Password</FormLabel>
                              <Button
                                variant="link"
                                className="h-auto p-0 text-xs text-muted-foreground hover:text-primary"
                                type="button"
                                onClick={() => setForgotOpen(true)}
                              >
                                Forgot password?
                              </Button>
                            </div>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  type={showPassword ? "text" : "password"}
                                  placeholder="••••••••"
                                  className="bg-muted/60 border-border text-foreground focus-visible:ring-primary"
                                  {...field}
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-muted-foreground hover:text-foreground"
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
                                className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                              />
                            </FormControl>
                            <FormLabel className="text-sm font-normal text-muted-foreground">Remember me for 30 days</FormLabel>
                          </FormItem>
                        )}
                      />

                      <Button
                        type="submit"
                        className="w-full bg-gradient-to-r from-blue-500 to-cyan-400 text-black dark:from-blue-900 dark:to-cyan-600 dark:text-white hover:from-blue-600 hover:to-cyan-500 dark:hover:from-blue-800 dark:hover:to-cyan-700 mt-2"
                      >
                        Sign in
                      </Button>
                    </form>
                  </Form>

                  <div className="mt-6 text-center">
                    <p className="text-sm text-muted-foreground">
                      Don't have an account?{" "}
                      <Button
                        variant="link"
                        className="p-0 h-auto text-primary hover:text-primary/80"
                        onClick={() => setActiveTab("register")}
                      >
                        Create one
                      </Button>
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="register">
                  <div className="text-center mb-6">
                    <h3 className="text-xl font-semibold text-foreground">Create an account</h3>
                    <p className="text-muted-foreground text-sm mt-1">Join RetailSense to get started</p>
                  </div>

                  <Form {...registerForm}>
                    <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
                      <FormField
                        control={registerForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-foreground">Username</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="johndoe"
                                className="bg-muted/60 border-border text-foreground focus-visible:ring-primary"
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
                            <FormLabel className="text-foreground">Email</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="name@company.com"
                                type="email"
                                className="bg-muted/60 border-border text-foreground focus-visible:ring-primary"
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
                            <FormLabel className="text-foreground">Password</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  type={showRegisterPassword ? "text" : "password"}
                                  placeholder="••••••••"
                                  className="bg-muted/60 border-border text-foreground focus-visible:ring-primary"
                                  {...field}
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-muted-foreground hover:text-foreground"
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
                            <FormLabel className="text-foreground">Confirm Password</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  type={showConfirmPassword ? "text" : "password"}
                                  placeholder="••••••••"
                                  className="bg-muted/60 border-border text-foreground focus-visible:ring-primary"
                                  {...field}
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-muted-foreground hover:text-foreground"
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
                                className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary mt-1"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-sm font-normal text-muted-foreground">
                                I agree to the{" "}
                                <a href="#" className="text-primary hover:text-primary/80 underline">
                                  terms of service
                                </a>{" "}
                                and{" "}
                                <a href="#" className="text-primary hover:text-primary/80 underline">
                                  privacy policy
                                </a>
                              </FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />

                      <Button
                        type="submit"
                        className="w-full bg-gradient-to-r from-blue-500 to-cyan-400 text-black dark:from-blue-900 dark:to-cyan-600 dark:text-white hover:from-blue-600 hover:to-cyan-500 dark:hover:from-blue-800 dark:hover:to-cyan-700 mt-2"
                      >
                        Create account
                      </Button>
                    </form>
                  </Form>

                  <div className="mt-6 text-center">
                    <p className="text-sm text-muted-foreground">
                      Already have an account?{" "}
                      <Button
                        variant="link"
                        className="p-0 h-auto text-primary hover:text-primary/80"
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
      {/* Forgot Password Dialog */}
      <Dialog open={forgotOpen} onOpenChange={o => {
        setForgotOpen(o);
        setForgotStep(1);
        setForgotSuccess("");
        setForgotError("");
        setForgotEmail("");
        setOtp("");
        setResetPassword("");
        setResetConfirmPassword("");
        setShowResetPasswords(false);
      }}>
        <DialogContent className="sm:max-w-lg border-none bg-white dark:bg-gradient-to-br dark:from-blue-900/90 dark:via-slate-900/90 dark:to-cyan-900/90 shadow-2xl rounded-2xl p-0 overflow-hidden">
          <div className="p-8 flex flex-col items-center">
            <DialogTitle className="text-2xl font-extrabold bg-gradient-to-r from-primary to-cyan-400 text-transparent bg-clip-text mb-2 tracking-tight drop-shadow-lg">Reset your password</DialogTitle>
            <DialogDescription className="mb-6 text-base text-muted-foreground dark:text-cyan-200/80 text-center max-w-xs mx-auto">
              {forgotStep === 1 && "Enter your email address and we'll send you a one-time code (OTP)."}
              {forgotStep === 2 && "Enter the OTP sent to your email."}
              {forgotStep === 3 && "Enter your new password."}
              {forgotStep === 4 && "Your password has been reset! You can now log in with your new password."}
            </DialogDescription>
            {forgotStep === 1 && (
              <form onSubmit={handleForgotEmailSubmit} className="w-full flex flex-col gap-4">
                <Input
                  type="email"
                  placeholder="name@company.com"
                  value={forgotEmail}
                  onChange={e => setForgotEmail(e.target.value)}
                  required
                  className="bg-muted/60 dark:bg-slate-800/80 border-2 border-cyan-400/20 dark:border-cyan-400/40 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/40 text-foreground dark:text-white placeholder:text-muted-foreground dark:placeholder:text-cyan-200/60 rounded-lg px-4 py-3 text-base shadow-inner transition-all duration-200"
                  autoFocus
                />
                {forgotSuccess && <div className="text-green-600 dark:text-green-400 text-sm text-center font-medium mt-1">{forgotSuccess}</div>}
                {forgotError && <div className="text-red-600 dark:text-red-400 text-sm text-center font-medium mt-1">{forgotError}</div>}
                <div className="h-px bg-gradient-to-r from-cyan-400/10 via-transparent to-blue-400/10 dark:from-cyan-400/30 dark:via-transparent dark:to-blue-400/30 my-2" />
                <div className="flex gap-3 mt-2">
                  <Button type="submit" className="flex-1 bg-gradient-to-r from-cyan-400 to-blue-500 text-white font-bold shadow-lg shadow-cyan-400/20 hover:from-cyan-300 hover:to-blue-400 transition-all text-base py-2.5 rounded-lg" disabled={forgotLoading}>
                    {forgotLoading ? "Sending..." : "Send OTP"}
                  </Button>
                  <Button type="button" variant="ghost" className="flex-1 border border-cyan-400/20 dark:border-cyan-400/40 text-cyan-700 dark:text-cyan-200 hover:bg-cyan-400/10 rounded-lg py-2.5 text-base font-semibold" onClick={() => setForgotOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            )}
            {forgotStep === 2 && (
              <form onSubmit={handleOtpVerify} className="w-full flex flex-col gap-4">
                <InputOTP
                  maxLength={6}
                  value={otp}
                  onChange={setOtp}
                  containerClassName="justify-center"
                  inputMode="numeric"
                  autoFocus
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                  </InputOTPGroup>
                  <InputOTPSeparator />
                  <InputOTPGroup>
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
                {forgotSuccess && <div className="text-green-600 dark:text-green-400 text-sm text-center font-medium mt-1">{forgotSuccess}</div>}
                {forgotError && <div className="text-red-600 dark:text-red-400 text-sm text-center font-medium mt-1">{forgotError}</div>}
                <div className="h-px bg-gradient-to-r from-cyan-400/10 via-transparent to-blue-400/10 dark:from-cyan-400/30 dark:via-transparent dark:to-blue-400/30 my-2" />
                <div className="flex gap-3 mt-2">
                  <Button type="submit" className="flex-1 bg-gradient-to-r from-cyan-400 to-blue-500 text-white font-bold shadow-lg shadow-cyan-400/20 hover:from-cyan-300 hover:to-blue-400 transition-all text-base py-2.5 rounded-lg" disabled={forgotLoading || otp.length !== 6}>
                    {forgotLoading ? "Verifying..." : "Verify"}
                  </Button>
                  <Button type="button" variant="ghost" className="flex-1 border border-cyan-400/20 dark:border-cyan-400/40 text-cyan-700 dark:text-cyan-200 hover:bg-cyan-400/10 rounded-lg py-2.5 text-base font-semibold" onClick={() => setForgotStep(1)}>
                    Back
                  </Button>
                </div>
              </form>
            )}
            {forgotStep === 3 && (
              <form onSubmit={handleResetPassword} className="w-full flex flex-col gap-4">
                <Input
                  type={showResetPasswords ? "text" : "password"}
                  placeholder="New password"
                  value={resetPassword}
                  onChange={e => setResetPassword(e.target.value)}
                  required
                  minLength={6}
                  className="bg-muted/60 dark:bg-slate-800/80 border-2 border-cyan-400/20 dark:border-cyan-400/40 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/40 text-foreground dark:text-white placeholder:text-muted-foreground dark:placeholder:text-cyan-200/60 rounded-lg px-4 py-3 text-base shadow-inner transition-all duration-200"
                  autoFocus
                />
                <Input
                  type={showResetPasswords ? "text" : "password"}
                  placeholder="Confirm new password"
                  value={resetConfirmPassword}
                  onChange={e => setResetConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  className="bg-muted/60 dark:bg-slate-800/80 border-2 border-cyan-400/20 dark:border-cyan-400/40 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/40 text-foreground dark:text-white placeholder:text-muted-foreground dark:placeholder:text-cyan-200/60 rounded-lg px-4 py-3 text-base shadow-inner transition-all duration-200"
                />
                <div className="flex items-center gap-2">
                  <Checkbox id="show-reset-passwords" checked={showResetPasswords} onCheckedChange={setShowResetPasswords} />
                  <label htmlFor="show-reset-passwords" className="text-sm text-muted-foreground select-none cursor-pointer">Show password</label>
                </div>
                {forgotSuccess && <div className="text-green-600 dark:text-green-400 text-sm text-center font-medium mt-1">{forgotSuccess}</div>}
                {forgotError && <div className="text-red-600 dark:text-red-400 text-sm text-center font-medium mt-1">{forgotError}</div>}
                <div className="h-px bg-gradient-to-r from-cyan-400/10 via-transparent to-blue-400/10 dark:from-cyan-400/30 dark:via-transparent dark:to-blue-400/30 my-2" />
                <div className="flex gap-3 mt-2">
                  <Button type="submit" className="flex-1 bg-gradient-to-r from-cyan-400 to-blue-500 text-white font-bold shadow-lg shadow-cyan-400/20 hover:from-cyan-300 hover:to-blue-400 transition-all text-base py-2.5 rounded-lg" disabled={forgotLoading}>
                    {forgotLoading ? "Resetting..." : "Reset Password"}
                  </Button>
                  <Button type="button" variant="ghost" className="flex-1 border border-cyan-400/20 dark:border-cyan-400/40 text-cyan-700 dark:text-cyan-200 hover:bg-cyan-400/10 rounded-lg py-2.5 text-base font-semibold" onClick={() => setForgotStep(2)}>
                    Back
                  </Button>
                </div>
              </form>
            )}
            {forgotStep === 4 && (
              <div className="w-full flex flex-col items-center gap-4">
                <div className="text-green-600 dark:text-green-400 text-center font-semibold text-lg">Password reset! You can now log in.</div>
                <Button className="w-full bg-gradient-to-r from-cyan-400 to-blue-500 text-white font-bold shadow-lg shadow-cyan-400/20 hover:from-cyan-300 hover:to-blue-400 transition-all text-base py-2.5 rounded-lg" onClick={() => { setForgotOpen(false); setForgotStep(1); }}>
                  Go to Login
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default AuthDialog
