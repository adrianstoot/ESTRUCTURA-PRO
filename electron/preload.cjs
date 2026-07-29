const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', Object.freeze({
  isDesktop: true,
  platform: process.platform,
  minimize: () => ipcRenderer.send('window:minimize'),
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  close: () => ipcRenderer.send('window:close'),
  closeWindow: () => ipcRenderer.send('window:close'),
  quit: () => ipcRenderer.send('window:close'),
  toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize'),
  isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
}));
