import { getCurrentWindow } from '@tauri-apps/api/window';
import { isDesktopApp } from '../lib/desktopPlatform';

const syncTheme = () => {
  let theme = 'light';
  try { theme = localStorage.getItem('theme') || 'light'; } catch { /* optional preference */ }
  document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches));
};
syncTheme();
window.addEventListener('storage', syncTheme);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', syncTheme);

if (isDesktopApp()) {
  const appWindow = getCurrentWindow();
  const reportFailure = () => { document.getElementById('error')!.textContent = 'Try again'; };
  const syncMaximized = async () => {
    const maximized = await appWindow.isMaximized();
    const button = document.getElementById('maximize')!;
    button.setAttribute('aria-label', maximized ? 'Restore window' : 'Maximize');
    button.setAttribute('title', maximized ? 'Restore window' : 'Maximize');
    button.innerHTML = maximized
      ? '<svg viewBox="0 0 12 12"><path d="M4 3V1.5h6.5V8H9"/><rect x="1.5" y="4" width="6.5" height="6.5"/></svg>'
      : '<svg viewBox="0 0 12 12"><rect x="1.5" y="1.5" width="9" height="9"/></svg>';
  };
  document.getElementById('minimize')!.onclick = () => { void appWindow.minimize().catch(reportFailure); };
  document.getElementById('maximize')!.onclick = () => { void appWindow.toggleMaximize().then(syncMaximized).catch(reportFailure); };
  document.getElementById('close')!.onclick = () => { void appWindow.close().catch(reportFailure); };
  void appWindow.onResized(() => { void syncMaximized().catch(reportFailure); }).catch(reportFailure);
  void syncMaximized().catch(reportFailure);
}
