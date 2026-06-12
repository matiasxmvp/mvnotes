import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import React from 'react';
import ReactDOM from 'react-dom/client';
import createCache from '@emotion/cache';
import { CacheProvider } from '@emotion/react';
import App from './App';
import QuickCaptureView from './views/QuickCaptureView';
import './index.css';

// speedy:false forces textContent injection instead of CSSStyleSheet.insertRule().
// In Tauri's WebView2 production builds, insertRule silently fails (speedy default
// in production), leaving all MUI Emotion styles unapplied. textContent always works.
const muiCache = createCache({ key: 'mui', speedy: false });

// The hidden quick-capture window loads index.html?window=quick (see tauri.conf.json).
const isQuickWindow =
  new URLSearchParams(window.location.search).get('window') === 'quick';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <CacheProvider value={muiCache}>
      {isQuickWindow ? <QuickCaptureView /> : <App />}
    </CacheProvider>
  </React.StrictMode>,
);
