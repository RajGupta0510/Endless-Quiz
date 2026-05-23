import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// Suppress Chrome extension errors (like MetaMask) from triggering the React error overlay in development
if (process.env.NODE_ENV === 'development') {
  const ignoreErrors = (event) => {
    const error = event.error || event.reason || {};
    const message = event.message || error.message || (typeof error === 'string' ? error : '');
    const filename = event.filename || error.filename || '';
    const stack = error.stack || '';

    const isChromeExtension = 
      filename.includes('chrome-extension://') || 
      stack.includes('chrome-extension://') || 
      message.includes('chrome-extension://') ||
      message.includes('MetaMask') ||
      message.includes('Failed to connect to MetaMask');

    if (isChromeExtension) {
      event.stopImmediatePropagation();
      if (event.preventDefault) {
        event.preventDefault();
      }
      return true;
    }
  };

  window.addEventListener('error', ignoreErrors, true);
  window.addEventListener('unhandledrejection', ignoreErrors, true);
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
