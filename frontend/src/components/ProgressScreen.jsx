import React from "react";
import "../styles/ProgressScreen.css";

const ProgressScreen = ({ show, percent, label = "Processing...", statusMessage }) => {
  if (!show) return null;
  return (
    <div className="progress-screen-overlay">
      <div className="progress-screen-content">
        <svg className="progress-screen-ring" width="140" height="140">
          <circle
            className="progress-screen-bg"
            cx="70"
            cy="70"
            r="62"
            strokeWidth="14"
            fill="none"
          />
          <circle
            className="progress-screen-bar"
            cx="70"
            cy="70"
            r="62"
            strokeWidth="14"
            fill="none"
            strokeDasharray={2 * Math.PI * 62}
            strokeDashoffset={
              percent !== null && percent !== undefined
                ? 2 * Math.PI * 62 * (1 - percent / 100)
                : 2 * Math.PI * 62
            }
          />
        </svg>
        <div className="progress-screen-percent">{percent !== null && percent !== undefined ? `${percent}%` : "0%"}</div>
        <div className="progress-screen-label">{label}</div>
        {statusMessage && <div className="progress-screen-status">{statusMessage}</div>}
      </div>
    </div>
  );
};

export default ProgressScreen; 