<template>
  <div class="pip-video-container">
    <!-- Main video element -->
    <video
      ref="videoRef"
      :src="src"
      :autoplay="autoplay"
      :controls="showControls"
      :muted="muted"
      :playsinline="true"
      @loadedmetadata="onLoadedMetadata"
      @play="onPlay"
      @pause="onPause"
      @ended="onEnded"
      @error="onError"
      class="pip-video-element"
      :class="{ 'pip-active': isPiPActive }"
      :aria-label="ariaLabel || 'Video player'"
      role="application"
    />

    <!-- PiP Toggle Button -->
    <div 
      v-if="showPiPButton" 
      class="pip-toggle-button-wrapper"
      :class="{ 'pip-hidden': hideControls }"
    >
      <button
        @click="togglePiP"
        :disabled="!isSupported || isLoading"
        :aria-label="isPiPActive ? 'Exit Picture-in-Picture' : 'Enter Picture-in-Picture'"
        class="pip-toggle-btn"
        :class="{ 
          'pip-active': isPiPActive,
          'pip-disabled': !isSupported || isLoading
        }"
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          viewBox="0 0 24 24" 
          fill="currentColor"
          class="pip-icon"
        >
          <path d="M19 7h-8v6h8V7zm2-4H3c-1.1 0-2 .9-2 2v14c0 1.1.9 1.98 2 1.98h18c1.1 0 2-.88 2-1.98V5c0-1.1-.9-2-2-2zm0 16.01H3V4.98h18v14.03z"/>
        </svg>
      </button>
    </div>

    <!-- Loading indicator -->
    <div v-if="isLoading" class="pip-loading-overlay">
      <div class="pip-spinner"></div>
    </div>

    <!-- Error message -->
    <div v-if="hasError" class="pip-error-overlay">
      <p>{{ errorMessage }}</p>
      <button @click="retry" class="pip-retry-btn">Retry</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import { usePiP, UsePiPReturn } from '@/composables/usePiP';

// Define props
interface Props {
  src: string;
  autoplay?: boolean;
  muted?: boolean;
  showControls?: boolean;
  showPiPButton?: boolean;
  hideControls?: boolean;
  ariaLabel?: string;
  pipOptions?: {
    width?: number;
    height?: number;
    fallbackToOverlay?: boolean;
  };
}

const props = withDefaults(defineProps<Props>(), {
  autoplay: true,
  muted: true,
  showControls: false,
  showPiPButton: true,
  hideControls: false,
  ariaLabel: undefined,
  pipOptions: () => ({
    width: 480,
    height: 320,
    fallbackToOverlay: true
  })
});

// Define emits
const emit = defineEmits<{
  'loaded-metadata': [event: Event];
  'play': [event: Event];
  'pause': [event: Event];
  'ended': [event: Event];
  'error': [event: Event];
  'pip-enter': [];
  'pip-exit': [];
  'pip-change': [isActive: boolean];
  'retry': [];
}>();

// Template refs
const videoRef = ref<HTMLVideoElement>();
const isLoading = ref(false);
const hasError = ref(false);
const errorMessage = ref('');

// Use the PiP composable
const { 
  isPiPActive, 
  isSupported, 
  enterPiP, 
  exitPiP, 
  togglePiP: togglePiPInternal,
  pipWindow 
} = usePiP(videoRef, props.pipOptions) as UsePiPReturn;

// Methods
const onLoadedMetadata = (event: Event) => {
  isLoading.value = false;
  emit('loaded-metadata', event);
};

const onPlay = (event: Event) => {
  isLoading.value = false;
  emit('play', event);
};

const onPause = (event: Event) => {
  emit('pause', event);
};

const onEnded = (event: Event) => {
  emit('ended', event);
};

const onError = (event: Event) => {
  hasError.value = true;
  isLoading.value = false;
  errorMessage.value = 'Failed to load video stream';
  emit('error', event);
};

const retry = () => {
  if (videoRef.value) {
    hasError.value = false;
    isLoading.value = true;
    videoRef.value.load();
    emit('retry');
  }
};

// Watch for PiP state changes
const togglePiP = async () => {
  try {
    await togglePiPInternal();
    
    if (isPiPActive.value) {
      emit('pip-enter');
    } else {
      emit('pip-exit');
    }
    
    emit('pip-change', isPiPActive.value);
  } catch (error) {
    console.error('Error toggling PiP:', error);
    hasError.value = true;
    errorMessage.value = 'Picture-in-Picture is not supported in this browser';
  }
};

// Lifecycle hooks
onMounted(() => {
  isLoading.value = true;
});

// Expose methods to parent components
defineExpose({
  videoRef,
  isPiPActive,
  isSupported,
  enterPiP,
  exitPiP,
  togglePiP,
  retry
});
</script>

<style scoped>
.pip-video-container {
  position: relative;
  display: inline-block;
  width: 100%;
  max-width: 100%;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
  aspect-ratio: 16 / 9;
}

.pip-video-element {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: opacity 0.2s ease;
}

.pip-video-element.pip-active {
  opacity: 0.3;
}

.pip-toggle-button-wrapper {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 10;
  display: flex;
  gap: 8px;
}

.pip-toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
  backdrop-filter: blur(4px);
}

.pip-toggle-btn:hover:not(.pip-disabled) {
  background: rgba(0, 0, 0, 0.8);
  transform: scale(1.05);
}

.pip-toggle-btn:focus {
  outline: 2px solid rgba(255, 255, 255, 0.5);
  outline-offset: 2px;
}

.pip-toggle-btn.pip-active {
  background: rgba(0, 100, 255, 0.8);
}

.pip-toggle-btn.pip-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pip-icon {
  width: 20px;
  height: 20px;
}

.pip-loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  z-index: 20;
}

.pip-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-top: 4px solid white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.pip-error-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  z-index: 20;
  padding: 20px;
  text-align: center;
}

.pip-retry-btn {
  margin-top: 12px;
  padding: 8px 16px;
  background: #0066ff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.pip-retry-btn:hover {
  background: #0055cc;
}
</style>