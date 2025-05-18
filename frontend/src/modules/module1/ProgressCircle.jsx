import React from "react";

const ProgressCircle = ({ percent }) => (
  <div
    style={{
      position: "fixed",
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)",
      zIndex: 1000,
      background: "#232526",
      borderRadius: "50%",
      width: 72,
      height: 72,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#fff",
      fontWeight: 700,
      fontSize: 28,
      boxShadow: "0 2px 16px rgba(0,0,0,0.18)",
      pointerEvents: "none",
    }}
  >
    <span style={{ position: "relative", zIndex: 2 }}>{percent}%</span>
  </div>
);

export default ProgressCircle; 