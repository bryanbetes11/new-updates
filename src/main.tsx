import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerAppServiceWorker } from './lib/serviceWorkerUpdate.ts';
import { initializeDeviceLayout } from './lib/device.ts';
import {
  clearExpiredRouteRecoveryMarker,
  installVitePreloadFailureLogging,
  RouteRecoveryBoundary,
} from './components/RouteRecoveryBoundary.tsx';

initializeDeviceLayout();
installVitePreloadFailureLogging();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouteRecoveryBoundary>
      <App />
    </RouteRecoveryBoundary>
  </StrictMode>
);

registerAppServiceWorker();
clearExpiredRouteRecoveryMarker();
