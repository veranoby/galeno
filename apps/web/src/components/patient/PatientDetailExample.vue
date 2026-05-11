<template>
  <div class="patient-detail-header">
    <div class="patient-info">
      <h1>{{ patient.name }}</h1>
      <p>ID: {{ patient.id }}</p>
    </div>
    
    <!-- Antecedents Completion Badge -->
    <div class="completion-indicator">
      <AntecedentsCompletionBadge 
        :antecedents-data="patient.antecedents" 
        :required-fields="requiredAntecedentFields"
      />
    </div>
  </div>
  
  <div class="antecedents-card">
    <h2>Antecedentes Médicos</h2>
    
    <div class="antecedents-content">
      <div class="antecedents-summary">
        <p><strong>Historia Personal:</strong> {{ patient.antecedents.personalHistory || 'No registrada' }}</p>
        <p><strong>Historia Familiar:</strong> {{ patient.antecedents.familyHistory || 'No registrada' }}</p>
        <p><strong>Alergias:</strong> {{ patient.antecedents.allergies || 'No registradas' }}</p>
        <p><strong>Medicamentos Actuales:</strong> {{ patient.antecedents.currentMedications || 'Ninguno' }}</p>
      </div>
      
      <!-- Another instance of the completion badge inside the card -->
      <div class="card-completion-badge">
        <AntecedentsCompletionBadge 
          :antecedents-data="patient.antecedents" 
          :required-fields="requiredAntecedentFields"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import AntecedentsCompletionBadge from '@/components/AntecedentsCompletionBadge.vue';

// Define the patient type/interface
interface Patient {
  id: string;
  name: string;
  antecedents: {
    personalHistory?: string;
    familyHistory?: string;
    allergies?: string[];
    currentMedications?: string[];
    pastSurgeries?: string[];
    chronicConditions?: string[];
    vaccinationStatus?: string;
    [key: string]: any;
  };
}

// Example patient data
const patient = defineProps<{
  patient: Patient;
}>();

// Define required fields for calculating completion
const requiredAntecedentFields = [
  'personalHistory',
  'familyHistory',
  'allergies',
  'currentMedications',
  'pastSurgeries',
  'chronicConditions',
  'vaccinationStatus'
];

// Using the composable to calculate completion
// import { useAntecedentsCompletion } from '@/composables/useAntecedentsCompletion';
// const completionPercentage = useAntecedentsCompletion(
//   computed(() => patient.value.antecedents),
//   requiredAntecedentFields
// );
</script>

<style scoped>
.patient-detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #e0e0e0;
  background-color: #f9f9f9;
}

.patient-info h1 {
  margin: 0;
  color: #333;
}

.completion-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.antecedents-card {
  padding: 20px;
  margin: 20px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background-color: white;
}

.antecedents-content {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.card-completion-badge {
  align-self: center;
}

@media (max-width: 768px) {
  .patient-detail-header {
    flex-direction: column;
    gap: 15px;
    text-align: center;
  }
  
  .antecedents-content {
    flex-direction: column;
    gap: 15px;
  }
  
  .card-completion-badge {
    align-self: center;
  }
}
</style>
</template>