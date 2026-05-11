<template>
  <div class="diagnosis-chip-container">
    <h3 class="text-h6 font-weight-bold mb-3">
      Diagnósticos CIE-10
    </h3>

    <!-- Selected Diagnoses -->
    <div v-if="diagnoses.length > 0" class="selected-diagnoses mb-3">
      <v-chip
        v-for="(diagnosis, index) in diagnoses"
        :key="diagnosis.code"
        closable
        color="primary"
        class="mr-2 mb-2"
        @click:close="$emit('remove', index)"
      >
        <v-icon start size="small">mdi-stethoscope</v-icon>
        {{ diagnosis.code }} - {{ diagnosis.description }}
      </v-chip>
    </div>

    <!-- Add Diagnosis Input -->
    <v-combobox
      v-model="searchQuery"
      :items="filteredDiagnoses"
      item-title="description"
      item-value="code"
      label="Buscar diagnóstico CIE-10"
      placeholder="Ej: J00 - Nasofaringitis aguda"
      prepend-inner-icon="mdi-magnify"
      variant="outlined"
      density="comfortable"
      hide-no-data
      hide-selected
      clearable
      @update:model-value="handleSearch"
      @keydown.enter="handleAdd"
    >
      <template v-slot:item="{ props: itemProps, item }">
        <v-list-item v-bind="itemProps">
          <v-list-item-title>
            <strong>{{ item.raw.code }}</strong> - {{ item.raw.description }}
          </v-list-item-title>
        </v-list-item>
      </template>
    </v-combobox>

    <v-alert
      type="info"
      variant="tonal"
      density="compact"
      class="mt-3"
    >
      <v-icon start>mdi-information</v-icon>
      Los diagnósticos se codifican automáticamente según CIE-10
    </v-alert>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';

// Types
interface CIE10Diagnosis {
  code: string;
  description: string;
  category?: string;
}

// Props
interface Props {
  modelValue?: CIE10Diagnosis[];
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: () => []
});

// Emits
const emit = defineEmits<{
  'update:modelValue': [diagnoses: CIE10Diagnosis[]];
  'add': [diagnosis: CIE10Diagnosis];
  'remove': [index: number];
}>();

// State
const searchQuery = ref<string>('');
const diagnoses = ref<CIE10Diagnosis[]>(props.modelValue || []);

// Computed
const filteredDiagnoses = computed(() => {
  if (!searchQuery.value) return [];
  
  const query = searchQuery.value.toLowerCase();
  return cie10Database.filter(d => 
    d.code.toLowerCase().includes(query) ||
    d.description.toLowerCase().includes(query)
  ).slice(0, 10);
});

// Methods
function handleSearch(query: string) {
  searchQuery.value = query;
}

function handleAdd() {
  if (filteredDiagnoses.value.length > 0) {
    const diagnosis = filteredDiagnoses.value[0];
    addDiagnosis(diagnosis);
  }
}

function addDiagnosis(diagnosis: CIE10Diagnosis) {
  if (!diagnoses.value.find(d => d.code === diagnosis.code)) {
    diagnoses.value.push(diagnosis);
    emit('update:modelValue', diagnoses.value);
    emit('add', diagnosis);
  }
  searchQuery.value = '';
}

function removeDiagnosis(index: number) {
  diagnoses.value.splice(index, 1);
  emit('update:modelValue', diagnoses.value);
  emit('remove', index);
}

// CIE-10 Database (subset común)
const cie10Database: CIE10Diagnosis[] = [
  { code: 'J00', description: 'Nasofaringitis aguda [resfriado común]' },
  { code: 'J01', description: 'Sinusitis aguda' },
  { code: 'J02', description: 'Faringitis aguda' },
  { code: 'J03', description: 'Amigdalitis aguda' },
  { code: 'J04', description: 'Laringitis y traqueítis agudas' },
  { code: 'J06', description: 'Infección aguda de las vías respiratorias superiores' },
  { code: 'J10', description: 'Gripe debida al virus de la influenza estacional identificado' },
  { code: 'J11', description: 'Gripe, virus no identificado' },
  { code: 'J18', description: 'Neumonía, organismo no especificado' },
  { code: 'A09', description: 'Diarrea y gastroenteritis de presunto origen infeccioso' },
  { code: 'K29', description: 'Gastritis y duodenitis' },
  { code: 'K52', description: 'Otras gastroenteritis y colitis no infecciosas' },
  { code: 'I10', description: 'Hipertensión esencial (primaria)' },
  { code: 'I11', description: 'Enfermedad cardiaca hipertensiva' },
  { code: 'E11', description: 'Diabetes mellitus no insulinodependiente' },
  { code: 'E10', description: 'Diabetes mellitus insulinodependiente' },
  { code: 'E78', description: 'Trastornos del metabolismo de las lipoproteínas' },
  { code: 'E03', description: 'Otras formas de hipotiroidismo' },
  { code: 'F41', description: 'Otros trastornos de ansiedad' },
  { code: 'F32', description: 'Episodios depresivos' },
  { code: 'M54', description: 'Dorsalgia' },
  { code: 'M79', description: 'Otros trastornos de los tejidos blandos' },
  { code: 'R50', description: 'Fiebre de origen desconocido y de otra causa' },
  { code: 'R51', description: 'Dolor de cabeza' },
  { code: 'R10', description: 'Dolor abdominal y pélvico' },
];

// Watch props
watch(() => props.modelValue, (newVal) => {
  if (newVal && newVal.length !== diagnoses.value.length) {
    diagnoses.value = newVal;
  }
}, { deep: true });
</script>

<style scoped lang="scss">
.diagnosis-chip-container {
  padding: 16px 0;
}

.selected-diagnoses {
  display: flex;
  flex-wrap: wrap;
}

:deep(.v-combobox__selection) {
  font-size: 0.875rem;
}
</style>
