// Service worker for push notifications

self.addEventListener('push', (event) => {
  let payload = {};

  try {
    // Get the payload from the push event
    payload = event.data ? event.data.json() : {};
  } catch (error) {
    console.error('Error parsing push notification data:', error);
    payload = { title: 'Notification', body: 'New message received' };
  }

  // Extract notification data
  const title = payload.title || 'Notification';
  const options = {
    body: payload.message || payload.body || 'You have a new notification',
    icon: payload.icon || '/favicon.ico',
    badge: payload.badge || '/favicon.ico',
    tag: payload.tag || 'default',
    data: {
      url: payload.url || '/',
      ...payload.data
    },
    actions: payload.actions || []
  };

  // Show the notification
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  // Close the notification
  event.notification.close();

  // Get the URL from notification data
  const url = event.notification.data?.url || '/';

  // Open the specified URL
  event.waitUntil(
    clients.openWindow(url)
  );
});

self.addEventListener('pushsubscriptionchange', (event) => {
  // Handle subscription updates (e.g., when the subscription expires)
  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: process.env.VAPID_PUBLIC_KEY
    }).then(async (subscription) => {
      // Send the new subscription to your server
      const storedUserId = localStorage.getItem('userId');
      if (storedUserId) {
        await fetch('/api/v1/notifications/push-subscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          },
          body: JSON.stringify({
            userId: storedUserId,
            subscription: JSON.stringify(subscription.toJSON())
          })
        });
      }
    })
  );
});