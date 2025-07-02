const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // File selection APIs
  selectVideoFile: () => ipcRenderer.invoke('select-video-file'),
  selectFloorplanFile: () => ipcRenderer.invoke('select-floorplan-file'),
  selectSaveDirectory: () => ipcRenderer.invoke('select-save-directory'),
  
  // App info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  
  // Listen for file selection events from menu
  onFileSelected: (callback) => {
    ipcRenderer.on('file-selected', (event, filePath) => callback(filePath));
  },
  
  onFloorplanSelected: (callback) => {
    ipcRenderer.on('floorplan-selected', (event, filePath) => callback(filePath));
  },
  
  // Remove listeners
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  },

  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  restoreFramedWindow: () => ipcRenderer.send('restore-framed-window'),
});

// Handle window controls
window.addEventListener('DOMContentLoaded', () => {
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector);
    if (element) element.innerText = text;
  };

  for (const dependency of ['chrome', 'node', 'electron']) {
    replaceText(`${dependency}-version`, process.versions[dependency]);
  }
}); 