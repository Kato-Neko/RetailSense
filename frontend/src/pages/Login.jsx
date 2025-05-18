"use client";

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Eye, EyeOff } from "lucide-react";
import { authService } from "../services/api";
import "../styles/Login.css";

const Login = ({ setIsAuthenticated }) => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.email || !formData.password) {
        toast.error("Please fill in all fields");
        return;
    }

    console.log("Submitting login with data:", formData);

    try {
        localStorage.removeItem('access_token');  // Clear any old token
        const response = await authService.login(formData.email, formData.password);
        
        console.log("Login response:", response);

        if (response.success && response.access_token) {
            localStorage.setItem('access_token', response.access_token);
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
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email" className="form-label">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="text"
              required
              className="form-input"
              placeholder="Enter your email"
              value={formData.email}
              onChange={handleChange}
            />
          </div>
          <div className="form-group">
            <label htmlFor="password" className="form-label">
              Password
            </label>
            <div className="password-input-container">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                className="form-input"
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleChange}
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="password-icon" />
                ) : (
                  <Eye className="password-icon" />
                )}
              </button>
            </div>
          </div>

          <button type="submit" className="login-btn">
            Sign in
          </button>

          <div className="login-footer">
            <p>
              Don't have an account?{" "}
              <button
                type="button"
                className="text-link"
                onClick={() => navigate("/register")}
              >
                Create one
              </button>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
