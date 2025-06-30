self.addEventListener('push', event => {
  console.log('Push event received:', event);
  
  // Show a debug notification first
  event.waitUntil(
    self.registration.showNotification('Debug: Push Received', {
      body: `Data: ${event.data ? 'Present' : 'Missing'}`,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'debug-push',
      requireInteraction: true
    })
  );
  
  let data = {};
  try {
    data = event.data.json();
    console.log('Parsed push data:', data);
  } catch (e) {
    console.error('Error parsing push data:', e);
    data = { title: 'Notification', body: event.data.text() };
  }
  
  // Show the actual notification
  event.waitUntil(
    self.registration.showNotification(data.title || 'Task Reminder', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: data,
      tag: 'task-notification',
      requireInteraction: true
    })
  );
});

self.addEventListener('notificationclick', event => {
  console.log('Notification clicked:', event);
  event.notification.close();
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
});

// Add service worker lifecycle debugging
self.addEventListener('install', event => {
  console.log('Service Worker installing...');
  event.waitUntil(
    self.registration.showNotification('Debug: SW Installing', {
      body: 'Service worker is being installed',
      icon: '/icon-192.png',
      tag: 'debug-install'
    })
  );
});

self.addEventListener('activate', event => {
  console.log('Service Worker activating...');
  event.waitUntil(
    self.registration.showNotification('Debug: SW Active', {
      body: 'Service worker is now active',
      icon: '/icon-192.png',
      tag: 'debug-activate'
    })
  );
}); 