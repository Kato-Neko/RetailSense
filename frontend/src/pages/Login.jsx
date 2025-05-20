import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Eye, EyeOff } from "lucide-react";
import { authService } from "../services/api";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import "../styles/Login.css";

const Login = ({ setIsAuthenticated }) => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);

  const FormSchema = z.object({
    email: z
      .string()
      .email("Invalid email address")
      .min(1, "Email is required"),
    password: z.string().min(1, "Password is required"),
  });

  const form = useForm({
    resolver: zodResolver(FormSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data) => {
    console.log("Submitting login with data:", data);

    try {
      localStorage.removeItem("access_token"); // Clear any old token
      const response = await authService.login(data.email, data.password);

      console.log("Login response:", response);

      if (response.success && response.access_token) {
        localStorage.setItem("access_token", response.access_token);
        console.log("Access Token stored:", response.access_token);
        setIsAuthenticated(true);
        toast.success("Login successful");
        navigate("/dashboard");
      } else {
        toast.error(response.message || "Login failed");
      }
    } catch (error) {
      console.error("Login error:", error);
      toast.error(error.message || "Login failed");
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h2 className="login-title">RetailSense</h2>
          <p className="login-subtitle">AI Foot Traffic Heatmap System</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input className="input" placeholder="Enter your email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl className="relative">
                    <div className="flex items-center">
                      <Input
                        className="input"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        {...field}
                      />
                      <button
                        type="button"
                        className="password-toggle-btn absolute inset-y-0 right-2 flex items-center"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="button">
              Sign in
            </Button>

            <div className="login-footer text-center">
              <p>
                Don't have an account?{" "}
                <button
                  type="button"
                  className="text-link font-medium"
                  onClick={() => navigate("/register")}
                >
                  Create one
                </button>
              </p>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
};

export default Login;
