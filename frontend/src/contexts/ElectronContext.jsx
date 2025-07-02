import React, { createContext, useContext, useEffect, useState } from 'react';

const ElectronContext = createContext();

export const useElectron = () => {
  const context = useContext(ElectronContext);
  if (!context) {
    throw new Error('useElectron must be used within an ElectronProvider');
  }
  return context;
};

export const ElectronProvider = ({ children }) => {
  const [isElectron, setIsElectron] = useState(false);
  const [appVersion, setAppVersion] = useState('');

  useEffect(() => {
    // Check if we're running in Electron
    const checkElectron = () => {
      return window.electronAPI !== undefined;
    };

    setIsElectron(checkElectron());

    // Get app version if in Electron
    if (checkElectron()) {
      window.electronAPI.getAppVersion().then(version => {
        setAppVersion(version);
      });
    }
  }, []);

  const selectVideoFile = async () => {
    if (!isElectron) {
      throw new Error('File selection only available in desktop app');
    }
    return await window.electronAPI.selectVideoFile();
  };

  const selectFloorplanFile = async () => {
    if (!isElectron) {
      throw new Error('File selection only available in desktop app');
    }
    return await window.electronAPI.selectFloorplanFile();
  };

  const selectSaveDirectory = async () => {
    if (!isElectron) {
      throw new Error('Directory selection only available in desktop app');
    }
    return await window.electronAPI.selectSaveDirectory();
  };

  const onFileSelected = (callback) => {
    if (!isElectron) return;
    window.electronAPI.onFileSelected(callback);
  };

  const onFloorplanSelected = (callback) => {
    if (!isElectron) return;
    window.electronAPI.onFloorplanSelected(callback);
  };

  const removeAllListeners = (channel) => {
    if (!isElectron) return;
    window.electronAPI.removeAllListeners(channel);
  };

  const value = {
    isElectron,
    appVersion,
    selectVideoFile,
    selectFloorplanFile,
    selectSaveDirectory,
    onFileSelected,
    onFloorplanSelected,
    removeAllListeners,
  };

  return (
    <ElectronContext.Provider value={value}>
      {children}
    </ElectronContext.Provider>
  );
}; 