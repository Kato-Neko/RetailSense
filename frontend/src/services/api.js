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
    // Only redirect on 401 if it's not a login attempt
    if (error?.response?.status === 401 && !error?.config?.url?.includes('/api/login')) {
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
      // The interceptor already extracts error.response.data, so error is the payload
      // The payload should be {error: "..."} from the backend
      
      // Handle different error formats
      let errorMessage = null;
      
      // If error is a string, use it directly
      if (typeof error === 'string') {
        errorMessage = error;
      }
      // If error.error exists, use it (this is the message from backend)
      else if (error && typeof error === 'object' && error.error) {
        errorMessage = error.error;
      }
      // If error.message exists, use it
      else if (error && error.message) {
        errorMessage = error.message;
      }
      // Handle network errors (these might not go through the interceptor)
      else if (error && error.code === 'ERR_NETWORK') {
        errorMessage = 'Cannot connect to server. Please check your internet connection and try again.';
      }
      
      // Throw with the error message, or fallback
      throw { error: errorMessage || 'Login failed. Please try again.' };
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
    let url = `${API_BASE_URL}/heatmap_jobs/${jobId}/custom_heatmap_image?start=${start}&end=${end}`;
    if (timestamp && uuid) {
      url += `&timestamp=${timestamp}&uuid=${uuid}`;
    }
    return url;
  },
  
  getDetections: async (jobId) => {
    try {
      const response = await apiClient.get(`/api/heatmap_jobs/${jobId}/detections`);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  regenerateDetections: async (jobId) => {
    try {
      const response = await apiClient.post(`/api/heatmap_jobs/${jobId}/regenerate_detections`);
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

  // Live streaming functions
  createLiveJob: async (config) => {
    try {
      const response = await apiClient.post('/api/heatmap_jobs/live', {
        rtsp_url: config.rtsp_url,
        camera_name: config.camera_name,
        points_data: config.points_data || []
      });
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  stopLiveJob: async (jobId) => {
    try {
      const response = await apiClient.post(`/api/heatmap_jobs/${jobId}/live/stop`);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  getLiveJobStatus: async (jobId) => {
    try {
      // Robust polling: 10s timeout with up to 3 attempts, exponential backoff (0ms, 500ms, 1000ms)
      const attempt = async (i) => {
        try {
          const response = await apiClient.get(`/api/heatmap_jobs/${jobId}/live/status`, { timeout: 10000 });
          return response.data;
        } catch (e) {
          const isTimeoutOrNetwork = e?.error?.toString?.().includes('timeout') || e?.error === 'Network error';
          if (isTimeoutOrNetwork && i < 2) {
            await new Promise(res => setTimeout(res, i === 0 ? 500 : 1000));
            return attempt(i + 1);
          }
          throw e;
        }
      };
      return await attempt(0);
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  getLiveHeatmapImageUrl: (jobId) => {
    return `${API_BASE_URL}/api/heatmap_jobs/${jobId}/live/heatmap`;
  },

  getLiveFloorplanImageUrl: (jobId) => {
    return `${API_BASE_URL}/api/heatmap_jobs/${jobId}/live/floorplan`;
  },

  getLiveCameraFeedUrl: (jobId) => {
    return `${API_BASE_URL}/api/heatmap_jobs/${jobId}/live/feed`;
  },

  getLiveCameraStreamUrl: (jobId) => {
    const token = localStorage.getItem('access_token');
    return `${API_BASE_URL}/api/heatmap_jobs/${jobId}/live/stream${token ? `?token=${token}` : ''}`;
  },
};

// Export the API client for other custom requests
export default apiClient;