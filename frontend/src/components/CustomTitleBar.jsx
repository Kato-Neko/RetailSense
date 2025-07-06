import { useState, useEffect } from "react";
import { AlertCircle, Minus, Square, Copy, X } from "lucide-react";

const CustomTitleBar = () => {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    // Listen for window maximize/unmaximize events from main process if needed
    // Optionally, you can use IPC to get the real maximized state
    if (window.electronAPI && window.electronAPI.onWindowMaximize) {
      window.electronAPI.onWindowMaximize(() => setIsMaximized(true));
      window.electronAPI.onWindowUnmaximize(() => setIsMaximized(false));
    }
  }, []);

  const handleDevTools = () => {
    if (window.electronAPI) window.electronAPI.toggleDevTools();
  };
  const handleMinimize = () => {
    if (window.electronAPI) window.electronAPI.minimizeWindow();
  };
  const handleMaximize = () => {
    if (window.electronAPI) window.electronAPI.maximizeWindow();
    setIsMaximized((prev) => !prev);
  };
  const handleClose = () => {
    if (window.electronAPI) window.electronAPI.closeWindow();
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-end w-full h-10 px-2 bg-transparent select-none" style={{ WebkitAppRegion: 'drag' }}>
      <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' }}>
        <button onClick={handleDevTools} title="Toggle Developer Tools" className="p-2 hover:bg-muted rounded">
          <AlertCircle className="h-3 w-3" />
        </button>
        <button onClick={handleMinimize} title="Minimize" className="p-2 hover:bg-muted rounded">
          <Minus className="h-3 w-3" />
        </button>
        <button onClick={handleMaximize} title={isMaximized ? "Restore" : "Maximize"} className="p-2 hover:bg-muted rounded">
          {isMaximized ? <Copy className="h-3 w-3" /> : <Square className="h-3 w-3" />}
        </button>
        <button onClick={handleClose} title="Close" className="p-2 hover:bg-muted rounded hover:bg-red-500 hover:text-white">
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
};

export default CustomTitleBar; 