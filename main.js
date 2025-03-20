const { app, BrowserWindow } = require('electron');
const path = require('path');
const express = require('express');

const PORT = 3001; // Port for our local HTTP server

// Create an Express app to serve static files from the "out" folder
const expressApp = express();
expressApp.use(express.static(path.join(__dirname, 'out')));
expressApp.listen(PORT, () => {
  console.log(`Static server running on http://localhost:${PORT}`);
});

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Load the static export from our local server
  win.loadURL(`http://localhost:${PORT}/index.html`);
}

app.whenReady().then(() => {
  createWindow();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
