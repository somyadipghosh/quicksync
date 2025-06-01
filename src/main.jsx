import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Initialize Service Worker if browser supports it
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    console.log('App loaded, will register service worker');
    // We'll handle registration in the SocketContext component
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
