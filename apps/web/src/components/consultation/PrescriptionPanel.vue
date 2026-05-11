<template>
  <div class="prescription-panel">
    <h3 class="text-h6 font-weight-bold mb-3">
      Medicamentos Recetados
    </h3>

    <!-- Selected Medications -->
    <v-card variant="outlined" class="mb-4" v-if="medications.length > 0">
      <v-card-text>
        <v-list density="compact">
          <v-list-item
            v-for="(med, index) in medications"
            :key="index"
            :subtitle="med.dosage"
          >
            <template v-slot:prepend>
              <v-icon color="success" size="small">mdi-pill</v-icon>
            </template>
            <template v-slot:title>
              <strong>{{ med.name }}</strong>
              <v-chip size="x-small" color="primary" class="ml-2">
                {{ med.frequency }}
              </v-chip>
            </template>
            <template v-slot:append>
              <v-btn
                icon="mdi-close"
                size="small"
                variant="text"
                @click="$emit('remove', index)"
              />
            </template>
          </v-list-item>
        </v-list>
      </v-card-text>
    </v-card>

    <!-- Add Medication Form -->
    <v-form ref="formRef" @submit.prevent="handleAdd">
      <v-row>
        <v-col cols="12" md="6">
          <v-text-field
            v-model="newMed.name"
            label="Nombre del medicamento"
            placeholder="Ej: Ibuprofeno 400mg"
            prepend-inner-icon="mdi-pill"
            variant="outlined"
            density="comfortable"
            :rules="[v => !!v || 'Nombre requerido']"
          />
        </v-col>

        <v-col cols="12" md="6">
          <v-text-field
            v-model="newMed.dosage"
            label="Dosis"
            placeholder="Ej: 1 tableta"
            prepend-inner-icon="mdi-ruler"
            variant="outlined"
            density="comfortable"
            :rules="[v => !!v || 'Dosis requerida']"
          />
        </v-col>

        <v-col cols="12" md="6">
          <v-text-field
            v-model="newMed.frequency"
            label="Frecuencia"
            placeholder="Ej: Cada 8 horas"
            prepend-inner-icon="mdi-clock-outline"
            variant="outlined"
            density="comfortable"
            :rules="[v => !!v || 'Frecuencia requerida']"
          />
        </v-col>

        <v-col cols="12" md="6">
          <v-text-field
            v-model="newMed.duration"
            label="Duración"
            placeholder="Ej: 5 días"
            prepend-inner-icon="mdi-calendar"
            variant="outlined"
            density="comfortable"
          />
        </v-col>

        <v-col cols="12">
          <v-textarea
            v-model="newMed.instructions"
            label="Instrucciones adicionales"
            placeholder="Ej: Tomar con alimentos"
            rows="2"
            variant="outlined"
            density="comfortable"
          />
        </v-col>

        <v-col cols="12">
          <v-btn
            type="submit"
            color="primary"
            block
            :disabled="!formValid"
          >
            <v-icon start>mdi-plus</v-icon>
            Agregar Medicamento
          </v-btn>
        </v-col>
      </v-row>
    </v-form>

    <v-alert
      type="info"
      variant="tonal"
      density="compact"
      class="mt-3"
    >
      <v-icon start>mdi-information</v-icon>
      Las recetas se generan automáticamente con membrete del doctor
    </v-alert>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue';

// Types
interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  duration?: string;
  instructions?: string;
}

// Props
interface Props {
  modelValue?: Medication[];
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: () => []
});

// Emits
const emit = defineEmits<{
  'update:modelValue': [medications: Medication[]];
  'add': [medication: Medication];
  'remove': [index: number];
}>();

// State
const formRef = ref();
const formValid = ref(false);
const medications = ref<Medication[]>(props.modelValue || []);

const newMed = reactive<Medication>({
  name: '',
  dosage: '',
  frequency: '',
  duration: '',
  instructions: ''
});

// Methods
function handleAdd() {
  if (formRef.value?.valid) {
    const medication: Medication = { ...newMed };
    medications.value.push(medication);
    emit('update:modelValue', medications.value);
    emit('add', medication);

    // Reset form
    newMed.name = '';
    newMed.dosage = '';
    newMed.frequency = '';
    newMed.duration = '';
    newMed.instructions = '';
    formRef.value?.resetValidation();
  }
}

function removeMedication(index: number) {
  medications.value.splice(index, 1);
  emit('update:modelValue', medications.value);
  emit('remove', index);
}

// Watch props
watch(() => props.modelValue, (newVal) => {
  if (newVal && newVal.length !== medications.value.length) {
    medications.value = newVal;
  }
}, { deep: true });
</script>

<style scoped lang="scss">
.prescription-panel {
  padding: 16px 0;
}
</style>
