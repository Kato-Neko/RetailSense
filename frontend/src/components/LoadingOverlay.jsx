import React from "react";
import { Loader } from "lucide-react";
import "../styles/LoadingOverlay.css";
import ProgressScreen from "../components/ProgressScreen";

const LoadingOverlay = ({ show, progressPercent, statusMessage, label = "Processing..." }) => {
  if (!show) return null;
  return (
    <div className="loading-overlay">
      <div className="circular-progress">
        <svg className="progress-ring" width="120" height="120">
          <circle
            className="progress-ring-bg"
            cx="60"
            cy="60"
            r="54"
            strokeWidth="12"
            fill="none"
          />
          <circle
            className="progress-ring-bar"
            cx="60"
            cy="60"
            r="54"
            strokeWidth="12"
            fill="none"
            strokeDasharray={2 * Math.PI * 54}
            strokeDashoffset={
              progressPercent !== null
                ? 2 * Math.PI * 54 * (1 - progressPercent / 100)
                : 2 * Math.PI * 54 * 0.25
            }
          />
        </svg>
        <div className="progress-text">
          {progressPercent !== null ? `${progressPercent}%` : <Loader className="spinner" />}
        </div>
        <div className="progress-label">{label}</div>
        {statusMessage && <div className="progress-status">{statusMessage}</div>}
      </div>
    </div>
  );
};

export default LoadingOverlay; 