import React, { useState } from "react";
import { Outlet } from "react-router-dom"; // This will render the matched child route
import SideMenu from "../components/SideMenu"; // Adjust the import path as needed
import { SidebarProvider } from "../components/ui/sidebar"; // Import SidebarProvider
import "../styles/Base.css"; // Import the CSS for Base
import "../styles/SideMenu.css"; // Import the CSS for SideMenu

const Base = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev);
  };

  return (
    <div className="flex h-screen">
      {" "}
      {/* Main flex container */}
      <div className={`sidebar-container ${isSidebarOpen ? 'open' : 'closed'}`}>
        {" "}
        {/* Container for SideMenu */}
        <SidebarProvider>
          <SideMenu 
            isAuthenticated={true} // Pass actual authentication state
            setIsAuthenticated={() => {}} // Pass actual set function
            isSidebarOpen={isSidebarOpen} 
            toggleSidebar={toggleSidebar} 
          />
        </SidebarProvider>
      </div>
      <div className="content-container">
        {" "}
        {/* Container for Outlet */}
        <div className="content">
          {" "}
          {/* Main content area */}
          <Outlet /> {/* This will render the routed components */}
        </div>
      </div>
    </div>
  );
};

export default Base;
