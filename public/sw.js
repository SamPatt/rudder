self.addEventListener('push', event => {
  console.log('Push event received:', event);
  console.log('Push event data:', event.data ? event.data.text() : 'No data');
  
  // Get the correct base URL for icons
  const baseUrl = self.location.origin || 'https://ruddertasks.netlify.app';
  
  let data = {};
  try {
    data = event.data.json();
    console.log('Parsed push data:', data);
  } catch (e) {
    console.error('Error parsing push data:', e);
    data = { title: 'Notification', body: event.data.text() };
  }
  
  // Show the notification
  event.waitUntil(
    self.registration.showNotification(data.title || 'Task Reminder', {
      body: data.body || '',
      icon: data.icon || `${baseUrl}/icon-192.png`,
      badge: data.badge || `${baseUrl}/icon-72.png`,
      data: data,
      tag: 'task-notification',
      requireInteraction: true,
      silent: false,
      vibrate: [200, 100, 200],
      actions: [
        {
          action: 'open',
          title: 'Open App',
          icon: `${baseUrl}/icon-72.png`
        }
      ]
    }).then(() => {
      console.log('Task notification shown successfully');
    }).catch(error => {
      console.error('Error showing task notification:', error);
    })
  );
});

self.addEventListener('notificationclick', event => {
  console.log('Notification clicked:', event);
  event.notification.close();
  
  // Handle action clicks
  if (event.action === 'open') {
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then(clientList => {
        for (const client of clientList) {
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
    );
  } else {
    // Default behavior for notification body click
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then(clientList => {
        for (const client of clientList) {
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
    );
  }
});

// Service worker lifecycle events (without debug notifications)
self.addEventListener('install', event => {
  console.log('Service Worker installing...');
  // Skip waiting to activate immediately
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  console.log('Service Worker activating...');
  // Claim all clients immediately
  event.waitUntil(self.clients.claim());
}); 