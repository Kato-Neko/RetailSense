import axios from "axios";

// Base URL for API requests
const API_BASE_URL = "http://localhost:5000/api";

// Create axios instance with base configuration
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// Add response interceptor for better error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle network errors more gracefully
    if (error.code === "ECONNABORTED") {
      console.error("Request timeout:", error);
      return Promise.reject({ error: "Request timed out. Please try again." });
    }

    if (!error.response) {
      console.error("Network error:", error);
      return Promise.reject({
        error: "Network error. Please check if the backend server is running.",
      });
    }

    return Promise.reject(error.response.data);
  }
);

// Add request interceptor to attach JWT token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Authentication services
export const authService = {
  login: async (username, password) => {
    try {
      const response = await apiClient.post("/login", { username, password });
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  register: async (username, email, password) => {
    try {
      const response = await apiClient.post("/register", {
        username,
        email,
        password,
      });
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  logout: async () => {
    try {
      const response = await apiClient.post("/logout");
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  getUserInfo: async () => {
    try {
      const response = await apiClient.get("/user");
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  updateUsername: async (newUsername) => {
    try {
      const response = await apiClient.put("/user/username", { username: newUsername });
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },
};

// Heatmap job services
export const heatmapService = {
  createJob: async (formData) => {
    try {
      const response = await apiClient.post("/heatmap_jobs", formData);
      return response.data;
    } catch (error) {
      if (!error.response) {
        console.error("Network error during job creation:", error);
        throw {
          error:
            "Network error. Please check if the backend server is running.",
        };
      }
      throw error.response ? error.response.data : error;
    }
  },

  getJobStatus: async (jobId) => {
    try {
      const response = await apiClient.get(`/heatmap_jobs/${jobId}/status`);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  getJobHistory: async () => {
    try {
      const response = await apiClient.get("/heatmap_jobs/history");
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  getHeatmapImageUrl: (jobId) => {
    return `${API_BASE_URL}/heatmap_jobs/${jobId}/result/image`;
  },

  getProcessedVideoUrl: (jobId) => {
    return `${API_BASE_URL}/heatmap_jobs/${jobId}/result/video`;
  },

  deleteJob: async (jobId) => {
    try {
      const response = await apiClient.delete(`/heatmap_jobs/${jobId}`);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  cancelJob: async (jobId) => {
    try {
      const response = await apiClient.post(`/heatmap_jobs/${jobId}/cancel`);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },
};

// Export the API client for other custom requests
export default apiClient;
