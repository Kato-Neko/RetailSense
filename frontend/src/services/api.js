import axios from "axios";
import API_BASE_URL from "../config.js";

// Create axios instance with base configuration
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

// Add response interceptor for better error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      localStorage.removeItem('access_token');
      window.location.href = '/';
    }
    const payload = error && error.response
      ? error.response.data
      : { error: (error && (error.message || error.toString())) || 'Network error' };
    return Promise.reject(payload);
  }
);

// Add request interceptor to attach JWT token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    console.log("Retrieved token from local storage:", token); // Log the token value
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Authentication services
export const authService = {
  login: async (email, password) => {
    try {
      const response = await apiClient.post("/api/login", { email, password });
      return response.data;  // Ensure this returns the expected structure
    } catch (error) {
      // Handle different types of errors with better messages
      if (error.code === 'ERR_NETWORK' || error.message?.includes('Name or service not known')) {
        throw { error: 'Cannot connect to server. Please check your internet connection and try again.' };
      } else if (error.response?.status === 500) {
        throw { error: 'Server error. Please try again later or contact support if the issue persists.' };
      } else if (error.response?.status === 401) {
        throw { error: 'Invalid email or password. Please check your credentials and try again.' };
      } else if (error.response?.status === 429) {
        throw { error: 'Too many login attempts. Please wait a moment before trying again.' };
      } else if (error.response?.data?.error) {
        throw error.response.data;
      } else {
        throw { error: 'Login failed. Please try again.' };
      }
    }
  },

  register: async (username, email, password) => {
    try {
      const response = await apiClient.post("/api/register", {
        username,
        email,
        password,
      });
      return response.data;
    } catch (error) {
      // Handle different types of errors with better messages
      if (error.code === 'ERR_NETWORK' || error.message?.includes('Name or service not known')) {
        throw { error: 'Cannot connect to server. Please check your internet connection and try again.' };
      } else if (error.response?.status === 500) {
        throw { error: 'Server error. Please try again later or contact support if the issue persists.' };
      } else if (error.response?.status === 409) {
        throw { error: 'Username or email already exists. Please choose different credentials.' };
      } else if (error.response?.data?.error) {
        throw error.response.data;
      } else {
        throw { error: 'Registration failed. Please try again.' };
      }
    }
  },

  logout: async () => {
    try {
      const response = await apiClient.post("/api/logout");
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  getUserInfo: async () => {
    try {
      const response = await apiClient.get("/api/user");
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  updateUsername: async (newUsername) => {
    try {
      const response = await apiClient.put("/api/user/username", { username: newUsername });
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  updatePassword: async (currentPassword, newPassword) => {
    try {
      const response = await apiClient.put("/api/user/password", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  forgotPassword: async (email) => {
    try {
      const response = await apiClient.post("/api/forgot-password", { email });
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  requestOtp: async (email) => {
    try {
      const response = await apiClient.post("/api/request-otp", { email });
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  verifyOtp: async (email, otp, newPassword) => {
    try {
      const response = await apiClient.post("/api/verify-otp", { email, otp, new_password: newPassword });
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  verifyOtpOnly: async (email, otp) => {
    try {
      const response = await apiClient.post("/api/verify-otp-only", { email, otp });
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
      const response = await apiClient.post("/api/heatmap_jobs", formData);
      return response.data;
    } catch (error) {
      // Handle different types of errors with better messages
      if (error.code === 'ERR_NETWORK' || error.message?.includes('Name or service not known')) {
        throw { error: 'Cannot connect to server. Please check your internet connection and try again.' };
      } else if (error.response?.status === 500) {
        throw { error: 'Server error during video processing. Please try again later or contact support if the issue persists.' };
      } else if (error.response?.status === 401) {
        throw { error: 'Session expired. Please log in again.' };
      } else if (error.response?.status === 413) {
        throw { error: 'Video file is too large. Please choose a smaller video file.' };
      } else if (error.response?.data?.error) {
        throw error.response.data;
      } else {
        throw { error: 'Failed to start video processing. Please try again.' };
      }
    }
  },

  getJobStatus: async (jobId) => {
    try {
      const response = await apiClient.get(`/api/heatmap_jobs/${jobId}/status`);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  getJobHistory: async () => {
    try {
      const response = await apiClient.get("/api/heatmap_jobs/history");
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  getJobDetails: async (jobId) => {
    try {
      const response = await apiClient.get(`/api/heatmap_jobs/history`);
      // Find the job in the returned history
      const job = response.data.find(j => j.job_id === jobId);
      if (!job) throw new Error('Job not found');
      return job;
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
      const response = await apiClient.delete(`/api/heatmap_jobs/${jobId}`);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  cancelJob: async (jobId) => {
    try {
      const response = await apiClient.post(`/api/heatmap_jobs/${jobId}/cancel`);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  exportHeatmapCsv: async (jobId, params) => {
    try {
      const response = await apiClient.get(`/api/heatmap_jobs/${jobId}/export/csv`, {
        responseType: 'blob',
        headers: {
          'Accept': 'text/csv'
        },
        params: {
          start_datetime: params.start_datetime,
          end_datetime: params.end_datetime,
          area: params.area,
          start_time: params.start_time,
          end_time: params.end_time
        }
      });
      return response.data;
    } catch (error) {
      if (error.response && error.response.data instanceof Blob) {
        // If the error response is a blob, read it as text
        const reader = new FileReader();
        const text = await new Promise((resolve) => {
          reader.onload = () => resolve(reader.result);
          reader.readAsText(error.response.data);
        });
        try {
          const errorData = JSON.parse(text);
          throw errorData;
        } catch (e) {
          throw { error: text };
        }
      }
      throw error.response ? error.response.data : error;
    }
  },

  exportHeatmapPdf: async (jobId, params) => {
    try {
      const response = await apiClient.get(`/api/heatmap_jobs/${jobId}/export/pdf`, {
        responseType: 'blob',
        headers: {
          'Accept': 'application/pdf'
        },
        params: {
          start_datetime: params.start_datetime,
          end_datetime: params.end_datetime,
          area: params.area,
          start_time: params.start_time,
          end_time: params.end_time
        }
      });
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  getHeatmapAnalysis: async (jobId) => {
    try {
      const response = await apiClient.get(`/api/heatmap_jobs/${jobId}/analysis`);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  getCustomHeatmapAnalysis: async (jobId, params) => {
    try {
      const response = await apiClient.get(`/api/heatmap_jobs/${jobId}/custom_analysis`, {
        params: {
          start_time: params.start_time,
          end_time: params.end_time,
          area: params.area,
          timestamp: params.timestamp,
          uuid: params.uuid
        }
      });
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  generateCustomHeatmap: async (jobId, payload) => {
    const response = await apiClient.post(`/api/heatmap_jobs/${jobId}/custom_heatmap`, payload);
    return response.data; // This will return { timestamp, uuid }
  },

  getCustomHeatmapImageUrl: (jobId, start, end, timestamp, uuid) => {
    return `${API_BASE_URL}/heatmap_jobs/${jobId}/custom_heatmap_image?start_time=${start}&end_time=${end}&timestamp=${timestamp}&uuid=${uuid}`;
  },
  
  getDetections: async (jobId) => {
    try {
      const response = await apiClient.get(`/api/heatmap_jobs/${jobId}/detections`);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  getJobPoints: async (jobId) => {
    // Fetch the 4 points (pointsData) for a given job from the backend
    try {
      const response = await apiClient.get(`/api/heatmap_jobs/${jobId}/points`);
      return response.data.pointsData;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  getJobTimeRange: async (jobId) => {
    // Fetch the time range (start/end date and time) for a given job from the backend
    try {
      const response = await apiClient.get(`/api/heatmap_jobs/${jobId}/time_range`);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  getCustomHeatmapProgress: async (jobId) => {
    try {
      const response = await apiClient.get(`/api/heatmap_jobs/${jobId}/custom_heatmap_progress`);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },
};

// Export the API client for other custom requests
export default apiClient;