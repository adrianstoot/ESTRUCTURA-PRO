const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('node:path');

const isDevelopment = !app.isPackaged;

function createMainWindow() {
  const window = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    frame: false,
    backgroundColor: '#111b24',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  window.once('ready-to-show', () => {
    window.show();
    if (isDevelopment && process.env.ESTRUCTURAS_PRO_DEVTOOLS === '1') {
      window.webContents.openDevTools({ mode: 'detach' });
    }
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDevelopment && process.env.ESTRUCTURAS_PRO_DEV_URL) {
    window.loadURL(process.env.ESTRUCTURAS_PRO_DEV_URL);
  } else {
    window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

ipcMain.on('window:minimize', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.minimize();
});

ipcMain.on('window:close', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.close();
});

ipcMain.handle('window:toggle-maximize', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) return false;
  if (window.isMaximized()) window.unmaximize();
  else window.maximize();
  return window.isMaximized();
});

ipcMain.handle('window:is-maximized', (event) => (
  BrowserWindow.fromWebContents(event.sender)?.isMaximized() || false
));

app.whenReady().then(() => {
  app.setAppUserModelId('com.estructuraspro.desktop');
  createMainWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
