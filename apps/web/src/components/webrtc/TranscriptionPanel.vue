<!-- apps/web/src/components/webrtc/TranscriptionPanel.vue -->
<template>
  <div class="transcription-panel">
    <!-- Header -->
    <div class="transcription-header">
      <h3 class="text-h6 font-weight-bold">
        <v-icon start color="primary">mdi-text-box-outline</v-icon>
        Transcripción
      </h3>
      <div class="header-actions">
        <v-btn
          v-if="!isTranscribing"
          color="primary"
          variant="tonal"
          size="small"
          @click="startTranscription"
        >
          <v-icon start>mdi-microphone</v-icon>
          Iniciar
        </v-btn>
        <v-btn
          v-else
          color="error"
          variant="tonal"
          size="small"
          @click="stopTranscription"
        >
          <v-icon start>mdi-stop</v-icon>
          Detener
        </v-btn>
        <v-btn
          icon
          size="small"
          variant="text"
          @click="exportMenu = true"
        >
          <v-icon>mdi-download</v-icon>
        </v-btn>
      </div>
    </div>

    <!-- Status Indicator -->
    <div v-if="isTranscribing" class="status-indicator">
      <v-progress-circular
        indeterminate
        size="16"
        width="2"
        color="primary"
        class="mr-2"
      />
      <span class="text-caption">Transcribiendo...</span>
    </div>

    <!-- Transcript Content -->
    <div class="transcript-content">
      <div v-if="transcript.length === 0 && !currentText" class="empty-state">
        <v-icon size="64" color="grey-lighten-2" class="mb-4">mdi-text-box-outline</v-icon>
        <p class="text-grey-darken-1">
          {{ isTranscribing ? 'Escuchando...' : 'Presiona "Iniciar" para comenzar la transcripción' }}
        </p>
      </div>

      <div v-else class="transcript-text">
        <!-- Final segments -->
        <div
          v-for="(segment, index) in transcript"
          :key="index"
          class="transcript-segment"
        >
          <span class="segment-time text-caption text-grey">
            {{ formatTime(segment.start) }}
          </span>
          <span class="segment-text">{{ segment.text }}</span>
        </div>

        <!-- Current/interim text -->
        <div v-if="currentText" class="transcript-segment current">
          <span class="segment-text">{{ currentText }}</span>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div v-if="transcript.length > 0" class="transcript-actions">
      <v-btn
        variant="text"
        size="small"
        @click="clearTranscript"
      >
        Limpiar
      </v-btn>
      <v-btn
        variant="text"
        size="small"
        @click="copyTranscript"
      >
        Copiar
      </v-btn>
    </div>

    <!-- Export Menu -->
    <v-menu v-model="exportMenu">
      <v-list>
        <v-list-item @click="exportTranscript('txt')">
          <v-list-item-title>Exportar como TXT</v-list-item-title>
        </v-list-item>
        <v-list-item @click="exportTranscript('json')">
          <v-list-item-title>Exportar como JSON</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>

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
import { useTranscription } from '@/composables/useTranscription';

const {
  isTranscribing,
  transcript,
  currentText,
  fullTranscript,
  startTranscription,
  stopTranscription,
  clearTranscript: clearTranscriptFunc,
  exportTranscript: exportTranscriptFunc,
  error
} = useTranscription();

const exportMenu = ref(false);

const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('es-EC', {
    minute: '2-digit',
    second: '2-digit'
  });
};

const clearTranscript = () => {
  clearTranscriptFunc();
};

const copyTranscript = async () => {
  try {
    await navigator.clipboard.writeText(fullTranscript.value);
    alert('Transcripción copiada al portapapeles');
  } catch (err) {
    alert('Error al copiar');
  }
};

const exportTranscript = (format: 'txt' | 'json') => {
  exportTranscriptFunc(format);
  exportMenu.value = false;
};
</script>

<style scoped lang="scss">
.transcription-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.transcription-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #e0e0e0;

  .header-actions {
    display: flex;
    gap: 4px;
  }
}

.status-indicator {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  background-color: rgba(59, 130, 246, 0.1);
  font-size: 0.875rem;
}

.transcript-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background-color: #fafafa;
}

.empty-state {
  text-align: center;
  padding: 48px 24px;
  color: #9e9e9e;
}

.transcript-text {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.transcript-segment {
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);

  &.current {
    background-color: rgba(59, 130, 246, 0.1);
    font-style: italic;
  }

  .segment-time {
    min-width: 50px;
    color: #9e9e9e;
  }

  .segment-text {
    flex: 1;
  }
}

.transcript-actions {
  display: flex;
  gap: 8px;
  padding: 8px 16px;
  border-top: 1px solid #e0e0e0;
  justify-content: flex-end;
}
</style>
