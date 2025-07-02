const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const isDev = process.env.NODE_ENV === 'development';

let mainWindow;
let pythonProcess;

// Keep a global reference of the window object
function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    vibrancy: 'acrylic',
    title: 'RetailSense',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.cjs')
    },
    icon: path.join(__dirname, '../public/icon.ico'), // Use proper .ico for Windows
    show: false, // Don't show until ready
    titleBarStyle: 'default',
    autoHideMenuBar: false,
  });

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Load the app
  if (isDev) {
    // In development, load from Vite dev server
    mainWindow.loadURL('http://localhost:5173');
    // Open DevTools in development
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built files
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// Start Python backend server
function startPythonBackend() {
  const pythonPath = path.join(__dirname, '../../backend/main/app.py');
  const pythonExecutable = 'python'; // or 'python3' depending on your system
  
  console.log('Starting Python backend...');
  console.log('Python path:', pythonPath);
  
  pythonProcess = spawn(pythonExecutable, [pythonPath], {
    cwd: path.join(__dirname, '../../backend/main'),
    stdio: ['pipe', 'pipe', 'pipe']
  });

  pythonProcess.stdout.on('data', (data) => {
    console.log('Python stdout:', data.toString());
  });

  pythonProcess.stderr.on('data', (data) => {
    console.log('Python stderr:', data.toString());
  });

  pythonProcess.on('close', (code) => {
    console.log('Python process exited with code:', code);
  });

  pythonProcess.on('error', (error) => {
    console.error('Failed to start Python backend:', error);
  });
}

// Stop Python backend server
function stopPythonBackend() {
  if (pythonProcess) {
    console.log('Stopping Python backend...');
    pythonProcess.kill();
    pythonProcess = null;
  }
}

// Create application menu
function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Video File',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ['openFile'],
              filters: [
                { name: 'Video Files', extensions: ['mp4', 'avi', 'mov'] }
              ]
            });
            
            if (!result.canceled && result.filePaths.length > 0) {
              mainWindow.webContents.send('file-selected', result.filePaths[0]);
            }
          }
        },
        {
          label: 'Open Floor Plan',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ['openFile'],
              filters: [
                { name: 'Image Files', extensions: ['png', 'jpg', 'jpeg'] }
              ]
            });
            
            if (!result.canceled && result.filePaths.length > 0) {
              mainWindow.webContents.send('floorplan-selected', result.filePaths[0]);
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About RetailSense',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About RetailSense',
              message: 'RetailSense',
              detail: 'Version 1.0.0\n\nA desktop application for retail analytics and heatmap generation.\n\nTransform your retail space with intelligent analytics.'
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// App event handlers
app.whenReady().then(() => {
  createWindow();
  createMenu();
  startPythonBackend();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopPythonBackend();
});

// IPC handlers for communication between main and renderer processes
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('select-video-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Video Files', extensions: ['mp4', 'avi', 'mov'] }
    ]
  });
  
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('select-floorplan-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Image Files', extensions: ['png', 'jpg', 'jpeg'] }
    ]
  });
  
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('select-save-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.on('minimize-window', () => {
  if (mainWindow) mainWindow.minimize();
}); 