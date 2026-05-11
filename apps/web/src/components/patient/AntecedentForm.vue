<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { TipoAntecedente, CreateAntecedenteDto, CATEGORIAS_POR_TIPO } from '@/composables/useAntecedents';

// Props
interface Props {
  pacienteId: string;
  antecedente?: {
    id: string;
    tipo: TipoAntecedente;
    categoria: string | null;
    detalle: string;
    grado: string | null;
  } | null;
  submitLabel?: string;
}

const props = withDefaults(defineProps<Props>(), {
  antecedente: null,
  submitLabel: 'Guardar'
});

// Emits
const emit = defineEmits<{
  submit: [data: CreateAntecedenteDto]
  cancel: []
}>();

// Composables
const categoriasPorTipo: typeof CATEGORIAS_POR_TIPO = {
  personal: ['patológico', 'quirúrgico', 'traumático', 'alérgico', 'ginecoobstétrico', 'otros'],
  familiar: ['padre', 'madre', 'hermanos', 'abuelos', 'tíos', 'otros'],
  medicamento: ['actual', 'previo'],
  habito: ['tabaco', 'alcohol', 'drogas', 'cafeína', 'ejercicio', 'dieta', 'sueño', 'otros'],
  alergia: ['medicamento', 'alimento', 'ambiente', 'otros']
};

const tipoLabels: Record<TipoAntecedente, string> = {
  personal: 'Personal',
  familiar: 'Familiar',
  medicamento: 'Medicamento',
  habito: 'Hábito',
  alergia: 'Alergia'
};

// Estado del formulario
const tipo = ref<TipoAntecedente>(props.antecedente?.tipo || 'personal');
const categoria = ref<string>(props.antecedente?.categoria || '');
const detalle = ref<string>(props.antecedente?.detalle || '');
const grado = ref<string>(props.antecedente?.grado || '');

// Computados
const categoriasDisponibles = computed(() => categoriasPorTipo[tipo.value]);

const labelDetalle = computed(() => {
  const labels: Record<TipoAntecedente, string> = {
    personal: 'Descripción',
    familiar: 'Descripción',
    medicamento: 'Nombre del medicamento',
    habito: 'Descripción del hábito',
    alergia: 'Sustancia alergénica'
  };
  return labels[tipo.value];
});

const placeholderDetalle = computed(() => {
  const placeholders: Record<TipoAntecedente, string> = {
    personal: 'Ej: Apendicectomía a los 15 años',
    familiar: 'Ej: Madre con hipertensión',
    medicamento: 'Ej: Paracetamol 500mg',
    habito: 'Ej: Fumador de 10 cigarrillos diarios',
    alergia: 'Ej: Penicilina - anafilaxis'
  };
  return placeholders[tipo.value];
});

const mostrarGrado = computed(() => tipo.value === 'familiar' || tipo.value === 'alergia');

const labelGrado = computed(() => {
  if (tipo.value === 'familiar') return 'Parentesco';
  if (tipo.value === 'alergia') return 'Severidad';
  return 'Grado';
});

// Reset al cambiar tipo
watch(tipo, () => {
  categoria.value = '';
});

// Métodos
const handleSubmit = () => {
  const data: CreateAntecedenteDto = {
    tipo: tipo.value,
    categoria: categoria.value || undefined,
    detalle: detalle.value,
    grado: grado.value || undefined
  };

  emit('submit', data);
};

const handleCancel = () => {
  emit('cancel');
};

const reset = () => {
  tipo.value = 'personal';
  categoria.value = '';
  detalle.value = '';
  grado.value = '';
};

// Exponer reset
defineExpose({ reset });
</script>

<template>
  <form @submit.prevent="handleSubmit" class="antecedente-form">
    <div class="form-group">
      <label for="tipo" class="form-label">Tipo de Antecedente</label>
      <select
        id="tipo"
        v-model="tipo"
        class="form-select"
        required
      >
        <option value="personal">{{ tipoLabels.personal }}</option>
        <option value="familiar">{{ tipoLabels.familiar }}</option>
        <option value="medicamento">{{ tipoLabels.medicamento }}</option>
        <option value="habito">{{ tipoLabels.habito }}</option>
        <option value="alergia">{{ tipoLabels.alergia }}</option>
      </select>
    </div>

    <div class="form-group">
      <label for="categoria" class="form-label">Categoría</label>
      <select
        id="categoria"
        v-model="categoria"
        class="form-select"
        required
      >
        <option value="">Seleccionar...</option>
        <option v-for="cat in categoriasDisponibles" :key="cat" :value="cat">
          {{ cat.charAt(0).toUpperCase() + cat.slice(1) }}
        </option>
      </select>
    </div>

    <div class="form-group">
      <label for="detalle" class="form-label">{{ labelDetalle }}</label>
      <textarea
        id="detalle"
        v-model="detalle"
        class="form-textarea"
        :placeholder="placeholderDetalle"
        rows="3"
        required
      ></textarea>
    </div>

    <div v-if="mostrarGrado" class="form-group">
      <label for="grado" class="form-label">{{ labelGrado }}</label>
      <input
        id="grado"
        v-model="grado"
        type="text"
        class="form-input"
        :placeholder="labelGrado === 'Parentesco' ? 'Ej: Primer grado' : 'Ej: Leve'"
      >
    </div>

    <div class="form-actions">
      <button type="button" @click="handleCancel" class="btn btn-secondary">
        Cancelar
      </button>
      <button type="submit" class="btn btn-primary">
        {{ submitLabel }}
      </button>
    </div>
  </form>
</template>

<style scoped>
.antecedente-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-label {
  font-weight: 600;
  font-size: 0.875rem;
  color: #374151;
}

.form-select,
.form-input,
.form-textarea {
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  transition: border-color 0.15s ease-in-out;
}

.form-select:focus,
.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-textarea {
  resize: vertical;
  min-height: 80px;
}

.form-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  margin-top: 0.5rem;
}

.btn {
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  font-weight: 500;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.15s ease-in-out;
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
  border: 1px solid #d1d5db;
}

.btn-secondary:hover {
  background: #e5e7eb;
}

.btn-primary {
  background: #3b82f6;
  color: white;
  border: 1px solid #3b82f6;
}

.btn-primary:hover {
  background: #2563eb;
}
</style>
