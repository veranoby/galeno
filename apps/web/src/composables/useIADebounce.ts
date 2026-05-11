// apps/web/src/composables/useIADebounce.ts
import { ref, watch, Ref } from 'vue';
import { apiClient } from '@/services/api';

export interface CodigoCIE10 {
  codigo: string;
  descripcion: string;
  confianza: number; // 0-1
}

export function useIADebounce(evolucion: Ref<string>) {
  const loading = ref(false);
  const sugerencias = ref<CodigoCIE10[]>([]);
  let debounceTimer: ReturnType<typeof setTimeout>;

  watch(evolucion, (newText) => {
    clearTimeout(debounceTimer);

    if (newText.length < 50) return; // Mínimo 50 caracteres

    debounceTimer = setTimeout(async () => {
      loading.value = true;
      try {
        const response = await apiClient.post('/api/ia/diagnostico', {
          evolucion: newText
        });
        sugerencias.value = response.data;
      } finally {
        loading.value = false;
      }
    }, 3000); // 3 segundos de debounce
  });

  return { loading, sugerencias };
}