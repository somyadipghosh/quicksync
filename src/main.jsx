import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { SocketProvider } from './contexts/SocketContext';
import { UserProvider } from './contexts/UserContext';

// Initialize Service Worker if browser supports it
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    console.log('App loaded, will register service worker');
    // We'll handle registration in the SocketContext component
    
    // Add extra logging to help with debugging
    navigator.serviceWorker.addEventListener('message', (event) => {
      console.log('SW message received in main thread:', event.data);
    });
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <UserProvider>
      <SocketProvider>
        <App />
      </SocketProvider>
    </UserProvider>
  </StrictMode>,
)
