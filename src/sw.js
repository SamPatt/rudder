// Simple service worker without external dependencies
// Workbox precache will be injected by the build process
self.__WB_MANIFEST;

// Use absolute URLs for icons to ensure they load properly
const ICON_URL = 'https://ruddertasks.netlify.app/icon-192.png';
const BADGE_URL = 'https://ruddertasks.netlify.app/icon-72.png';

self.addEventListener('push', event => {
  console.log('🔔 Push event received:', event);
  console.log('📦 Push event data:', event.data ? event.data.text() : 'No data');
  console.log('📍 Service worker origin:', self.location.origin);
  console.log('🆔 Service worker scope:', self.registration.scope);
  
  let data = {};
  try {
    data = event.data.json();
    console.log('✅ Parsed push data:', data);
  } catch (e) {
    console.error('❌ Error parsing push data:', e);
    data = { title: 'Notification', body: event.data.text() };
  }
  
  // Show the notification with absolute URLs
  event.waitUntil(
    self.registration.showNotification(data.title || 'Task Reminder', {
      body: data.body || '',
      icon: data.icon || ICON_URL,
      badge: data.badge || BADGE_URL,
      data: data,
      tag: 'task-notification',
      requireInteraction: true,
      silent: false,
      vibrate: [200, 100, 200],
      actions: [
        {
          action: 'open',
          title: 'Open App',
          icon: BADGE_URL
        }
      ]
    }).then(() => {
      console.log('✅ Task notification shown successfully');
    }).catch(error => {
      console.error('❌ Error showing task notification:', error);
      console.error('Error details:', error.message, error.stack);
    })
  );
});

self.addEventListener('notificationclick', event => {
  console.log('👆 Notification clicked:', event);
  console.log('🎯 Action:', event.action);
  event.notification.close();
  
  // Handle action clicks
  if (event.action === 'open') {
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then(clientList => {
        console.log('🔍 Found clients:', clientList.length);
        for (const client of clientList) {
          console.log('📍 Client URL:', client.url);
          if (client.url === '/' && 'focus' in client) {
            console.log('🎯 Focusing existing client');
            return client.focus();
          }
        }
        if (clients.openWindow) {
          console.log('🆕 Opening new window');
          return clients.openWindow('/');
        }
      })
    );
  } else {
    // Default behavior for notification body click
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then(clientList => {
        console.log('🔍 Found clients:', clientList.length);
        for (const client of clientList) {
          console.log('📍 Client URL:', client.url);
          if (client.url === '/' && 'focus' in client) {
            console.log('🎯 Focusing existing client');
            return client.focus();
          }
        }
        if (clients.openWindow) {
          console.log('🆕 Opening new window');
          return clients.openWindow('/');
        }
      })
    );
  }
});

// Add message event listener to respond to messages from main thread
self.addEventListener('message', event => {
  console.log('📨 Message received in service worker:', event.data);
  
  if (event.data && event.data.type === 'DEBUG') {
    console.log('🔧 Debug message received:', event.data.message);
    // Send a response back to the main thread
    event.ports[0].postMessage({
      type: 'DEBUG_RESPONSE',
      message: 'Service worker is working!',
      timestamp: new Date().toISOString()
    });
  }
  
  if (event.data && event.data.type === 'PING') {
    console.log('🏓 Ping received, sending pong');
    // Send a response back to the main thread
    event.ports[0].postMessage({
      type: 'PONG',
      timestamp: new Date().toISOString()
    });
  }
});

// Service worker lifecycle events (without debug notifications)
self.addEventListener('install', event => {
  console.log('🔧 Service Worker installing...');
  // Skip waiting to activate immediately
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  console.log('🚀 Service Worker activating...');
  // Claim all clients immediately
  event.waitUntil(self.clients.claim());
});

// Add error handling for unhandled promise rejections
self.addEventListener('unhandledrejection', event => {
  console.error('❌ Unhandled promise rejection in service worker:', event.reason);
});

// Add error handling for errors
self.addEventListener('error', event => {
  console.error('❌ Error in service worker:', event.error);
}); 