// Which workspace a staff-employee chose after login. Some accounts (Admin, HR
// Manager, Department Manager who are also on the payroll) can use either the
// Admin app or their own Self-Service portal; this remembers their pick for the
// current browser session so the chooser isn't shown on every visit to "/".

export type Workspace = 'admin' | 'ess';
const KEY = 'sakthihr.workspace';

export function getWorkspace(): Workspace | null {
  try {
    const v = sessionStorage.getItem(KEY);
    return v === 'admin' || v === 'ess' ? v : null;
  } catch { return null; }
}

export function setWorkspace(w: Workspace): void {
  try { sessionStorage.setItem(KEY, w); } catch { /* ignore */ }
}

export function clearWorkspace(): void {
  try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
}
