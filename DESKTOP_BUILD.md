# SakthiHR — Windows Desktop Build

The web app (React + Vite) is wrapped in **Electron** and packaged with
**electron-builder** into a standalone Windows application. All runtime
dependencies (Chromium, Node, and the built app code) are bundled — the only
external requirement at runtime is internet access to the SakthiHR Supabase
backend.

## Prerequisites

- Node.js 18+ and npm
- `npm install` (installs `electron` + `electron-builder` dev dependencies)
- The Supabase credentials in `.env.local` are **baked into the bundle at build
  time** (Vite `import.meta.env.VITE_*`). Make sure `.env.local` points at the
  intended project before building.

## Build commands

| Command | Output | Notes |
| --- | --- | --- |
| `npm run dist:win` | NSIS installer **+** portable zip | Full release build |
| `npm run dist:win:installer` | `release/SakthiHR-Setup-<ver>.exe` | Wizard installer |
| `npm run dist:win:portable` | `release/SakthiHR-<ver>-x64.zip` | Unzip → run `SakthiHR.exe` |

Each command runs `vite build` first, then packages. Artifacts land in
`release/` (git-ignored).

### Cross-building from macOS / Linux
electron-builder ships its own bundled Wine + NSIS toolchain, so both the
portable zip **and** the NSIS installer can be produced on macOS/Linux. For a
code-signed, fully native build, run the same commands on Windows.

## Artifacts

- **`SakthiHR-Setup-<ver>.exe`** — per-user NSIS installer (no admin prompt),
  lets the user choose the install directory, creates Desktop + Start Menu
  shortcuts, and registers an uninstaller.
- **`SakthiHR-<ver>-x64.zip`** — portable. Extract anywhere and launch
  `SakthiHR.exe`; no installation required.
- **`release/win-unpacked/`** — the raw unpacked app directory.

## How it works

- `electron/main.cjs` registers a custom **`app://`** standard + secure scheme
  and serves the `dist/` folder through it, with an SPA fallback to
  `index.html`. Running under a real origin (instead of `file://`) keeps
  `react-router-dom`'s `BrowserRouter` and Supabase auth session persistence
  (localStorage) working unchanged.
- `electron/preload.cjs` exposes a minimal read-only `window.sakthiDesktop`
  bridge (version/platform info) with `contextIsolation` enabled.
- `electron-builder.yml` holds the packaging config (targets, NSIS options,
  icon).

## Branding

App icon is generated from `build/icon.png` (run `node scripts/generate-icon.cjs`
to regenerate). Replace that PNG (1024×1024) and rebuild to rebrand;
electron-builder converts it to a multi-resolution `.ico` automatically.

## Code signing (optional, recommended for distribution)

Unsigned Windows builds trigger SmartScreen warnings on first run. To sign,
provide a code-signing certificate via electron-builder's `CSC_LINK` /
`CSC_KEY_PASSWORD` environment variables (or `win.certificateFile`) and rebuild
on Windows.
