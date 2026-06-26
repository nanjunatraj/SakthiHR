// SakthiHR — Electron main process
// Wraps the Vite-built SPA (dist/) in a standalone desktop window.
// A custom "app://" standard+secure scheme is registered so that the
// renderer runs under a stable origin. That keeps two things working
// unchanged from the web build:
//   1. react-router-dom's BrowserRouter (history API + deep-link fallback)
//   2. Supabase auth session persistence (localStorage needs a real origin)

const { app, BrowserWindow, shell, protocol, net } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const APP_SCHEME = 'app';
const APP_HOST = 'bundle';
const DIST_DIR = path.join(__dirname, '..', 'dist');

// Must be called before app "ready".
protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

// Single-instance lock — focus the existing window instead of opening a new one.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

let mainWindow = null;

function resolveDistFile(requestPathname) {
  // Strip query/hash, decode, and normalise to a path inside dist/.
  let pathname = decodeURIComponent(requestPathname.split('?')[0].split('#')[0]);
  if (!pathname || pathname === '/') pathname = '/index.html';

  // Prevent path traversal outside dist/.
  const resolved = path.normalize(path.join(DIST_DIR, pathname));
  if (!resolved.startsWith(DIST_DIR)) {
    return path.join(DIST_DIR, 'index.html');
  }
  return resolved;
}

function registerAppProtocol() {
  protocol.handle(APP_SCHEME, async (request) => {
    const url = new URL(request.url);
    let filePath = resolveDistFile(url.pathname);

    const fs = require('node:fs');
    // SPA fallback: any unknown route (no file extension / missing file) -> index.html
    const hasFile = fs.existsSync(filePath) && fs.statSync(filePath).isFile();
    if (!hasFile) {
      filePath = path.join(DIST_DIR, 'index.html');
    }
    return net.fetch(pathToFileURL(filePath).toString());
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    backgroundColor: '#ffffff',
    title: 'SakthiHR',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  // Open external (http/https) links in the user's default browser, not in-app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`${APP_SCHEME}://`)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.loadURL(`${APP_SCHEME}://${APP_HOST}/index.html`);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(() => {
  registerAppProtocol();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
