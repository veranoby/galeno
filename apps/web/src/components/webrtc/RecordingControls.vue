<!-- apps/web/src/components/webrtc/RecordingControls.vue -->
<template>
  <div class="recording-controls" :class="{ 'is-recording': isRecording }">
    <!-- Recording Indicator -->
    <div v-if="isRecording" class="recording-indicator">
      <span class="recording-dot"></span>
      <span class="recording-text">Grabando</span>
      <span class="recording-time">{{ formatDuration(duration) }}</span>
    </div>

    <!-- Controls -->
    <div class="controls">
      <v-btn
        v-if="!isRecording"
        color="error"
        variant="elevated"
        :loading="loading"
        @click="startRecording"
      >
        <v-icon start>mdi-record-circle</v-icon>
        Grabar
      </v-btn>

      <template v-else>
        <v-btn
          color="warning"
          variant="tonal"
          @click="handlePauseResume"
        >
          <v-icon start>{{ isPaused ? 'mdi-play' : 'mdi-pause' }}</v-icon>
          {{ isPaused ? 'Reanudar' : 'Pausar' }}
        </v-btn>

        <v-btn
          color="error"
          variant="elevated"
          @click="stopRecording"
        >
          <v-icon start>mdi-stop</v-icon>
          Detener
        </v-btn>
      </template>

      <!-- Recording List -->
      <v-menu v-if="recordings.length > 0">
        <template v-slot:activator="{ props }">
          <v-btn
            variant="outlined"
            v-bind="props"
          >
            <v-icon start>mdi-file-video</v-icon>
            Grabaciones ({{ recordings.length }})
          </v-btn>
        </template>
        <v-list>
          <v-list-item
            v-for="(recording, index) in recordings"
            :key="index"
          >
            <template v-slot:prepend>
              <v-icon>mdi-file-video</v-icon>
            </template>
            <v-list-item-title>
              Grabación {{ index + 1 }}
            </v-list-item-title>
            <v-list-item-subtitle>
              {{ formatDuration(recording.duration) }}
            </v-list-item-subtitle>
            <template v-slot:append>
              <v-btn
                icon
                size="small"
                variant="text"
                @click="downloadRecording(index)"
              >
                <v-icon>mdi-download</v-icon>
              </v-btn>
              <v-btn
                icon
                size="small"
                variant="text"
                @click="deleteRecording(index)"
              >
                <v-icon>mdi-delete</v-icon>
              </v-btn>
            </template>
          </v-list-item>
        </v-list>
      </v-menu>
    </div>

    <!-- Error Alert -->
    <v-alert
      v-if="error"
      type="error"
      variant="tonal"
      border="start"
      class="mt-2"
      closable
      @click:close="error = null"
    >
      {{ error }}
    </v-alert>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useWebRTC } from '@/composables/useWebRTC';
import { useRecording } from '@/composables/useRecording';

interface Props {
  stream?: MediaStream;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'recording-start'): void;
  (e: 'recording-stop', url: string): void;
}>();

const { localStream } = useWebRTC();
const {
  isRecording,
  recordingDuration: duration,
  recordingUrl,
  startRecording: startRecordingFunc,
  stopRecording: stopRecordingFunc,
  pauseRecording,
  resumeRecording,
  downloadRecording: downloadRecordingFunc,
  clearRecording,
  error
} = useRecording();

const loading = ref(false);
const isPaused = ref(false);
const recordings = ref<Array<{ url: string; duration: number }>>([]);

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const startRecording = async () => {
  loading.value = true;
  const stream = props.stream || localStream.value;

  if (!stream) {
    error.value = 'No hay stream disponible para grabar';
    loading.value = false;
    return;
  }

  const success = startRecordingFunc(stream);
  if (success) {
    emit('recording-start');
  }
  loading.value = false;
};

const stopRecording = () => {
  const result = stopRecordingFunc();
  if (result?.url) {
    recordings.value.push({
      url: result.url,
      duration: result.duration
    });
    emit('recording-stop', result.url);
  }
  isPaused.value = false;
};

const handlePauseResume = () => {
  if (isPaused.value) {
    resumeRecording();
    isPaused.value = false;
  } else {
    pauseRecording();
    isPaused.value = true;
  }
};

const downloadRecording = (index: number) => {
  const recording = recordings.value[index];
  if (recording) {
    const a = document.createElement('a');
    a.href = recording.url;
    a.download = `grabacion-${index + 1}.webm`;
    a.click();
  }
};

const deleteRecording = (index: number) => {
  const recording = recordings.value.splice(index, 1)[0];
  if (recording) {
    URL.revokeObjectURL(recording.url);
  }
};
</script>

<style scoped lang="scss">
.recording-controls {
  padding: 16px;
  background-color: #f5f5f5;
  border-radius: 8px;

  &.is-recording {
    background-color: rgba(239, 68, 68, 0.1);
  }
}

.recording-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  padding: 8px 12px;
  background-color: rgba(239, 68, 68, 0.1);
  border-radius: 8px;

  .recording-dot {
    width: 12px;
    height: 12px;
    background-color: #ef4444;
    border-radius: 50%;
    animation: pulse 1s infinite;
  }

  .recording-text {
    font-weight: 600;
    color: #ef4444;
  }

  .recording-time {
    margin-left: auto;
    font-family: monospace;
    font-size: 1.25rem;
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.controls {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
