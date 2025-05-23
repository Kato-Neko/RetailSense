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
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('access_token'); // Clear the token
      // Optionally redirect to login
      window.location.href = '/'; // Adjust based on your routing
    }
    return Promise.reject(error.response.data);
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
      const response = await apiClient.post("/login", { email, password });
      return response.data;  // Ensure this returns the expected structure
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

  getJobDetails: async (jobId) => {
    try {
      const response = await apiClient.get(`/heatmap_jobs/history`);
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

  exportHeatmapCsv: async (jobId, params) => {
    try {
      const response = await apiClient.get(`/heatmap_jobs/${jobId}/export/csv`, {
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
      const response = await apiClient.get(`/heatmap_jobs/${jobId}/export/pdf`, {
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
      const response = await apiClient.get(`/heatmap_jobs/${jobId}/analysis`);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  getCustomHeatmapAnalysis: async (jobId, params) => {
    try {
      const response = await apiClient.get(`/heatmap_jobs/${jobId}/custom_analysis`, {
        params: {
          start_time: params.start_time,
          end_time: params.end_time,
          area: params.area
        }
      });
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  generateCustomHeatmap: async (jobId, payload) => {
    const response = await apiClient.post(`/heatmap_jobs/${jobId}/custom_heatmap`, payload);
    return response.data;
  },

  getCustomHeatmapImageUrl: (jobId, start, end) => {
    return `${API_BASE_URL}/heatmap_jobs/${jobId}/custom_heatmap_image?start=${start}&end=${end}`;
  },
  
  getDetections: async (jobId) => {
    try {
      const response = await apiClient.get(`/heatmap_jobs/${jobId}/detections`);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  getJobPoints: async (jobId) => {
    // Fetch the 4 points (pointsData) for a given job from the backend
    try {
      const response = await apiClient.get(`/heatmap_jobs/${jobId}/points`);
      return response.data.pointsData;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  getJobTimeRange: async (jobId) => {
    // Fetch the time range (start/end date and time) for a given job from the backend
    try {
      const response = await apiClient.get(`/heatmap_jobs/${jobId}/time_range`);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  getCustomHeatmapProgress: async (jobId) => {
    const response = await apiClient.get(`/heatmap_jobs/${jobId}/custom_heatmap_progress`);
    return response.data;
  },
};

// Export the API client for other custom requests
export default apiClient;