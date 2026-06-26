// SakthiHR — Electron preload
// Runs with contextIsolation. Exposes a minimal, read-only surface to the
// renderer. The web app needs nothing from Node, so we only publish version
// info that the About screen (or diagnostics) can display if desired.

const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('sakthiDesktop', {
  isDesktop: true,
  platform: process.platform,
  versions: {
    app: process.env.npm_package_version || '0.0.0',
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
});
