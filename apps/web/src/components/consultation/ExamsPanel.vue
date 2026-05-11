<template>
  <div class="exams-panel">
    <h3 class="text-h6 font-weight-bold mb-3">
      Exámenes Solicitados
    </h3>

    <!-- Selected Exams -->
    <v-card variant="outlined" class="mb-4" v-if="exams.length > 0">
      <v-card-text>
        <v-list density="compact">
          <v-list-item
            v-for="(exam, index) in exams"
            :key="index"
            :subtitle="exam.notes"
          >
            <template v-slot:prepend>
              <v-icon :color="getUrgencyColor(exam.urgency)" size="small">
                mdi-test-tube
              </v-icon>
            </template>
            <template v-slot:title>
              <strong>{{ exam.name }}</strong>
              <v-chip size="x-small" :color="getUrgencyColor(exam.urgency)" class="ml-2">
                {{ getUrgencyLabel(exam.urgency) }}
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

    <!-- Add Exam Form -->
    <v-form ref="formRef" @submit.prevent="handleAdd">
      <v-row>
        <v-col cols="12">
          <v-select
            v-model="newExam.name"
            label="Tipo de examen"
            :items="commonExams"
            prepend-inner-icon="mdi-test-tube"
            variant="outlined"
            density="comfortable"
            :rules="[v => !!v || 'Examen requerido']"
          />
        </v-col>

        <v-col cols="12" md="6">
          <v-select
            v-model="newExam.urgency"
            label="Urgencia"
            :items="urgencyOptions"
            prepend-inner-icon="mdi-alert"
            variant="outlined"
            density="comfortable"
            :rules="[v => !!v || 'Urgencia requerida']"
          />
        </v-col>

        <v-col cols="12" md="6">
          <v-text-field
            v-model="newExam.lab"
            label="Laboratorio preferido"
            placeholder="Opcional"
            prepend-inner-icon="mdi-office-building"
            variant="outlined"
            density="comfortable"
          />
        </v-col>

        <v-col cols="12">
          <v-textarea
            v-model="newExam.notes"
            label="Notas clínicas"
            placeholder="Indicaciones especiales"
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
            Agregar Examen
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
      Las órdenes de examen se generan con membrete y sello digital
    </v-alert>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue';

// Types
interface Exam {
  name: string;
  urgency: 'routine' | 'urgent' | 'stat';
  lab?: string;
  notes?: string;
}

// Props
interface Props {
  modelValue?: Exam[];
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: () => []
});

// Emits
const emit = defineEmits<{
  'update:modelValue': [exams: Exam[]];
  'add': [exam: Exam];
  'remove': [index: number];
}>();

// State
const formRef = ref();
const formValid = ref(false);
const exams = ref<Exam[]>(props.modelValue || []);

const newExam = reactive<Exam>({
  name: '',
  urgency: 'routine',
  lab: '',
  notes: ''
});

// Options
const commonExams = [
  'Hemograma completo',
  'Glucosa en sangre',
  'Hemoglobina glicosilada (HbA1c)',
  'Perfil lipídico',
  'Colesterol total',
  'Triglicéridos',
  'HDL colesterol',
  'LDL colesterol',
  'Creatinina',
  'Urea',
  'Ácido úrico',
  'TGO/AST',
  'TGP/ALT',
  'Bilirrubina total',
  'TSH',
  'T4 libre',
  'Antígeno prostático específico (PSA)',
  'Examen general de orina',
  'Urocultivo',
  'Coprológico',
  'Coproparasitario',
  'Radiografía de tórax',
  'Ecografía abdominal',
  'Electrocardiograma',
  'Prueba de esfuerzo'
];

const urgencyOptions = [
  { title: 'Routine', value: 'routine', color: 'success' },
  { title: 'Urgente', value: 'urgent', color: 'warning' },
  { title: 'Estat (Inmediato)', value: 'stat', color: 'error' }
];

// Methods
function getUrgencyColor(urgency: string): string {
  const option = urgencyOptions.find(o => o.value === urgency);
  return option?.color || 'grey';
}

function getUrgencyLabel(urgency: string): string {
  const option = urgencyOptions.find(o => o.value === urgency);
  return option?.title || urgency;
}

function handleAdd() {
  if (formRef.value?.valid) {
    const exam: Exam = { ...newExam };
    exams.value.push(exam);
    emit('update:modelValue', exams.value);
    emit('add', exam);

    // Reset form
    newExam.name = '';
    newExam.urgency = 'routine';
    newExam.lab = '';
    newExam.notes = '';
    formRef.value?.resetValidation();
  }
}

function removeExam(index: number) {
  exams.value.splice(index, 1);
  emit('update:modelValue', exams.value);
  emit('remove', index);
}

// Watch props
watch(() => props.modelValue, (newVal) => {
  if (newVal && newVal.length !== exams.value.length) {
    exams.value = newVal;
  }
}, { deep: true });
</script>

<style scoped lang="scss">
.exams-panel {
  padding: 16px 0;
}
</style>
