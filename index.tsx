
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initThemeEngine } from './themeEngine';

// Link and initialize the Neural Temporal Theme Engine
initThemeEngine();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
