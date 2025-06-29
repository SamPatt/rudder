self.addEventListener('push', event => {
  let data = {};
  try {
    data = event.data.json();
  } catch (e) {
    data = { title: 'Notification', body: event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Task Reminder', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: data,
    })
  );
});

self.addEventListener('notificationclick', event => {
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