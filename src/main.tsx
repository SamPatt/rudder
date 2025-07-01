import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  // Check if we're on HTTPS (required for service workers and push notifications)
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
    console.error('Service Worker requires HTTPS (except for localhost)');
  } else {
    window.addEventListener('load', async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/'
        });
        console.log('SW registered successfully: ', registration);
        
        // Check if service worker is active
        if (registration.active) {
          console.log('Service Worker is active');
        } else {
          console.log('Service Worker is installing/activating...');
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'activated') {
                  console.log('Service Worker activated successfully');
                }
              });
            }
          });
        }
      } catch (registrationError) {
        console.error('SW registration failed: ', registrationError);
      }
    });
  }
} else {
  console.warn('Service Worker not supported in this browser');
}
 
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
) 