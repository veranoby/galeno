<template>
  <div class="toast-container">
    <transition-group name="toast" tag="div" class="toasts-wrapper">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        :class="[
          'toast',
          `toast--${toast.type}`,
          { 'toast--rtl': rtl }
        ]"
        role="alert"
        :aria-live="toast.type === 'error' ? 'assertive' : 'polite'"
        :aria-atomic="true"
      >
        <div class="toast__icon">
          <component :is="getIcon(toast.type)" />
        </div>
        <div class="toast__content">
          <h4 v-if="toast.title" class="toast__title">{{ toast.title }}</h4>
          <p class="toast__message">{{ toast.message }}</p>
        </div>
        <button 
          type="button" 
          class="toast__close"
          @click="removeToast(toast.id)"
          :aria-label="closeLabel"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </transition-group>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import type { NotificationType } from '@galeno/shared-types';

export interface Toast {
  id: string;
  title?: string;
  message: string;
  type: NotificationType;
  duration?: number; // in ms, 0 means permanent
  closable?: boolean;
}

interface Props {
  rtl?: boolean;
  closeLabel?: string;
  maxToasts?: number;
  defaultDuration?: number;
}

const props = withDefaults(defineProps<Props>(), {
  rtl: false,
  closeLabel: 'Close notification',
  maxToasts: 5,
  defaultDuration: 5000
});

const toasts = ref<Toast[]>([]);

// Icon mapping for different toast types
const icons = {
  info: defineAsyncComponent(() => import('./icons/InfoIcon.vue')),
  success: defineAsyncComponent(() => import('./icons/SuccessIcon.vue')),
  warning: defineAsyncComponent(() => import('./icons/WarningIcon.vue')),
  error: defineAsyncComponent(() => import('./icons/ErrorIcon.vue')),
  system: defineAsyncComponent(() => import('./icons/SystemIcon.vue'))
};

const getIcon = (type: NotificationType) => {
  return icons[type as keyof typeof icons] || icons.info;
};

// Add a new toast
const addToast = (toast: Omit<Toast, 'id'>) => {
  const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const newToast: Toast = {
    id,
    ...toast,
    duration: toast.duration ?? props.defaultDuration,
    closable: toast.closable ?? true
  };

  // Remove oldest toast if we exceed maxToasts
  if (toasts.value.length >= props.maxToasts) {
    toasts.value.shift();
  }

  toasts.value.push(newToast);

  // Auto-remove toast after duration if it's not permanent
  if (newToast.duration && newToast.duration > 0) {
    setTimeout(() => {
      removeToast(id);
    }, newToast.duration);
  }
};

// Remove a toast by ID
const removeToast = (id: string) => {
  const index = toasts.value.findIndex(toast => toast.id === id);
  if (index !== -1) {
    toasts.value.splice(index, 1);
  }
};

// Clear all toasts
const clearToasts = () => {
  toasts.value = [];
};

// Expose methods to parent components
defineExpose({
  addToast,
  removeToast,
  clearToasts
});

// Keyboard navigation support
const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && toasts.value.length > 0) {
    // Close the most recent toast
    removeToast(toasts.value[toasts.value.length - 1].id);
  }
};

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.5rem;
  pointer-events: none;
}

.toasts-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.toast {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem;
  min-width: 300px;
  max-width: 400px;
  border-radius: 0.5rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  pointer-events: auto;
  overflow: hidden;
  position: relative;
  animation: slideIn 0.3s ease-out;
}

.toast--rtl {
  direction: rtl;
}

.toast--info {
  background-color: #dbeafe;
  border-left: 4px solid #3b82f6;
  color: #1d4ed8;
}

.toast--success {
  background-color: #dcfce7;
  border-left: 4px solid #22c55e;
  color: #15803d;
}

.toast--warning {
  background-color: #fef3c7;
  border-left: 4px solid #f59e0b;
  color: #92400e;
}

.toast--error {
  background-color: #fee2e2;
  border-left: 4px solid #ef4444;
  color: #b91c1c;
}

.toast--system {
  background-color: #ede9fe;
  border-left: 4px solid #8b5cf6;
  color: #5b21b6;
}

.toast__icon {
  flex-shrink: 0;
  width: 1.5rem;
  height: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.toast__content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.toast__title {
  font-weight: 600;
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.25rem;
}

.toast__message {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.25rem;
  word-break: break-word;
}

.toast__close {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 0.25rem;
  color: inherit;
  opacity: 0.7;
  transition: opacity 0.2s;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.toast__close:hover,
.toast__close:focus {
  opacity: 1;
  outline: 2px solid currentColor;
  outline-offset: 2px;
}

/* Transitions */
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(30px);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(30px);
  position: absolute;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* Responsive adjustments */
@media (max-width: 640px) {
  .toast-container {
    top: 0.5rem;
    right: 0.5rem;
    left: 0.5rem;
  }
  
  .toast {
    min-width: auto;
    width: 100%;
  }
}
</style>