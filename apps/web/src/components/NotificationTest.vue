<template>
  <div class="notification-test-container">
    <h2>Notification System Test</h2>
    
    <!-- Preferences Controls -->
    <section class="preferences-section">
      <h3>Notification Preferences</h3>
      <div class="preference-controls">
        <label>
          <input 
            v-model="localPrefs.pushEnabled" 
            type="checkbox" 
            @change="updatePreferences"
          />
          Enable Push Notifications
        </label>
        
        <label>
          <input 
            v-model="localPrefs.sseEnabled" 
            type="checkbox" 
            @change="updatePreferences"
          />
          Enable SSE Notifications
        </label>
        
        <label>
          <input 
            v-model="localPrefs.toastEnabled" 
            type="checkbox" 
            @change="updatePreferences"
          />
          Enable Toast Notifications
        </label>
      </div>
    </section>

    <!-- Send Notification Controls -->
    <section class="send-section">
      <h3>Send Test Notification</h3>
      <div class="send-controls">
        <div class="input-group">
          <label>Title:</label>
          <input v-model="testNotification.title" type="text" placeholder="Notification title" />
        </div>
        
        <div class="input-group">
          <label>Message:</label>
          <textarea v-model="testNotification.message" placeholder="Notification message"></textarea>
        </div>
        
        <div class="input-group">
          <label>Type:</label>
          <select v-model="testNotification.type">
            <option value="info">Info</option>
            <option value="success">Success</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
            <option value="system">System</option>
          </select>
        </div>
        
        <div class="input-group">
          <label>Method:</label>
          <select v-model="testNotification.method">
            <option value="">Auto (All Available)</option>
            <option value="push">Push</option>
            <option value="sse">SSE</option>
            <option value="toast">Toast</option>
          </select>
        </div>
        
        <button @click="sendTestNotification" :disabled="sending">
          {{ sending ? 'Sending...' : 'Send Notification' }}
        </button>
      </div>
    </section>

    <!-- Current Notifications -->
    <section class="notifications-section">
      <h3>Current Notifications ({{ notifications.length }})</h3>
      <div class="notifications-list">
        <div 
          v-for="notification in notifications" 
          :key="notification.id" 
          class="notification-item"
          :class="{ 'unread': !notification.read }"
        >
          <div class="notification-header">
            <span class="notification-title">{{ notification.title }}</span>
            <span class="notification-type">{{ notification.type }}</span>
          </div>
          <div class="notification-body">
            <p>{{ notification.message }}</p>
            <small>Method: {{ notification.method }} | Created: {{ formatDate(notification.createdAt) }}</small>
          </div>
          <div class="notification-actions">
            <button 
              v-if="!notification.read" 
              @click="markAsRead(notification.id)"
              class="mark-read-btn"
            >
              Mark as Read
            </button>
            <span v-else class="read-status">Read</span>
          </div>
        </div>
        
        <div v-if="notifications.length === 0" class="empty-state">
          No notifications yet. Send a test notification!
        </div>
      </div>
    </section>

    <!-- Unread Count -->
    <section class="stats-section">
      <h3>Statistics</h3>
      <p>Unread notifications: {{ unreadCount }}</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue';
import { useNotifications } from '@/composables/useNotifications';
import { NotificationType, NotificationMethod } from '@galeno/shared-types';

// Use the notification composable
const {
  notifications,
  unreadCount,
  preferences,
  sendNotification,
  getNotifications,
  markAsRead,
  updatePreferences: updateServerPreferences
} = useNotifications();

// Local state for test controls
const sending = ref(false);
const localPrefs = reactive({
  pushEnabled: preferences.value.pushEnabled,
  sseEnabled: preferences.value.sseEnabled,
  toastEnabled: preferences.value.toastEnabled
});

const testNotification = reactive({
  title: 'Test Notification',
  message: 'This is a test notification to verify the system is working correctly.',
  type: 'info' as NotificationType,
  method: '' as NotificationMethod | '',
  data: {}
});

// Update local preferences when server preferences change
watch(preferences, (newPrefs) => {
  localPrefs.pushEnabled = newPrefs.pushEnabled;
  localPrefs.sseEnabled = newPrefs.sseEnabled;
  localPrefs.toastEnabled = newPrefs.toastEnabled;
}, { deep: true });

// Update server preferences when local prefs change
const updatePreferences = async () => {
  await updateServerPreferences({
    pushEnabled: localPrefs.pushEnabled,
    sseEnabled: localPrefs.sseEnabled,
    toastEnabled: localPrefs.toastEnabled
  });
};

// Send a test notification
const sendTestNotification = async () => {
  if (!testNotification.title || !testNotification.message) {
    alert('Please enter both title and message');
    return;
  }

  sending.value = true;
  
  try {
    const result = await sendNotification({
      userId: '', // Will be filled by backend with current user ID
      title: testNotification.title,
      message: testNotification.message,
      type: testNotification.type,
      method: testNotification.method || undefined,
      data: testNotification.data
    });
    
    if (result.success) {
      alert(`Notification sent successfully via: ${result.deliveredMethods.join(', ')}`);
      // Refresh notifications list
      await getNotifications();
    } else {
      alert(`Failed to send notification: ${result.error || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Error sending notification:', error);
    alert('Error sending notification');
  } finally {
    sending.value = false;
  }
};

// Format date for display
const formatDate = (date: Date) => {
  return new Date(date).toLocaleString();
};

// Initialize notifications on mount
onMounted(async () => {
  await getNotifications();
});
</script>

<style scoped>
.notification-test-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
  font-family: Arial, sans-serif;
}

h2 {
  color: #333;
  border-bottom: 2px solid #eee;
  padding-bottom: 0.5rem;
  margin-bottom: 2rem;
}

h3 {
  color: #555;
  margin-top: 1.5rem;
  margin-bottom: 1rem;
}

.preferences-section,
.send-section,
.notifications-section,
.stats-section {
  margin-bottom: 2rem;
  padding: 1.5rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  background-color: #fafafa;
}

.preference-controls {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.preference-controls label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.send-controls {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.input-group label {
  font-weight: bold;
  color: #555;
}

.input-group input,
.input-group textarea,
.input-group select {
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 1rem;
}

.input-group textarea {
  min-height: 80px;
  resize: vertical;
}

button {
  padding: 0.75rem 1.5rem;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  align-self: flex-start;
}

button:hover:not(:disabled) {
  background-color: #0056b3;
}

button:disabled {
  background-color: #6c757d;
  cursor: not-allowed;
}

.mark-read-btn {
  background-color: #28a745;
  padding: 0.25rem 0.5rem;
  font-size: 0.875rem;
}

.mark-read-btn:hover {
  background-color: #1e7e34;
}

.notifications-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.notification-item {
  background-color: white;
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 1rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.notification-item.unread {
  border-left: 4px solid #007bff;
  background-color: #f8f9ff;
}

.notification-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.notification-title {
  font-weight: bold;
  color: #333;
}

.notification-type {
  background-color: #e9ecef;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.875rem;
}

.notification-body p {
  margin: 0 0 0.5rem 0;
  color: #555;
}

.notification-body small {
  color: #888;
}

.notification-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 0.5rem;
}

.read-status {
  color: #28a745;
  font-style: italic;
}

.empty-state {
  text-align: center;
  color: #888;
  font-style: italic;
  padding: 2rem;
}
</style>