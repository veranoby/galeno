<template>
  <div class="completion-badge-container">
    <div 
      class="completion-badge" 
      :class="{ 
        'low-completion': completionPercentage < 50,
        'medium-completion': completionPercentage >= 50 && completionPercentage < 80,
        'high-completion': completionPercentage >= 80 
      }"
    >
      <svg class="badge-svg" viewBox="0 0 100 100">
        <!-- Background circle -->
        <circle
          class="background-circle"
          cx="50"
          cy="50"
          r="45"
          fill="none"
        />
        
        <!-- Progress circle -->
        <circle
          class="progress-circle"
          cx="50"
          cy="50"
          r="45"
          fill="none"
          :stroke-dasharray="circumference"
          :stroke-dashoffset="strokeDashoffset"
          transform="rotate(-90 50 50)"
        />
        
        <!-- Center text -->
        <text
          x="50"
          y="50"
          text-anchor="middle"
          dominant-baseline="central"
          class="percentage-text"
        >
          {{ completionPercentage }}%
        </text>
      </svg>
    </div>
    
    <div class="completion-label">
      {{ completionPercentage }}% completado
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { calculateAntecedentsCompletion } from '@/utils/antecedentsCompletion';

// Define props
interface Props {
  antecedentsData: Record<string, any>;
  requiredFields?: string[];
}

const props = withDefaults(defineProps<Props>(), {
  requiredFields: undefined
});

// Calculate circumference for the circle (2 * π * r)
const radius = 45;
const circumference = 2 * Math.PI * radius;

// Calculate completion percentage using utility
const completionPercentage = computed(() => {
  return calculateAntecedentsCompletion(props.antecedentsData, props.requiredFields);
});

// Calculate stroke dash offset for the progress circle
const strokeDashoffset = computed(() => {
  const progress = completionPercentage.value / 100;
  return circumference - (progress * circumference);
});
</script>

<style scoped>
.completion-badge-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.completion-badge {
  position: relative;
  width: 60px;
  height: 60px;
}

.badge-svg {
  width: 100%;
  height: 100%;
}

.background-circle {
  stroke: #e0e0e0;
  stroke-width: 8;
}

.progress-circle {
  stroke-width: 8;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.5s ease;
}

.percentage-text {
  font-size: 14px;
  font-weight: bold;
  fill: #333;
}

.low-completion .progress-circle {
  stroke: #f44336; /* Red */
}

.medium-completion .progress-circle {
  stroke: #ff9800; /* Yellow/Orange */
}

.high-completion .progress-circle {
  stroke: #4caf50; /* Green */
}

.completion-label {
  font-size: 12px;
  color: #666;
  margin-top: 4px;
}

/* Additional styling for different completion levels */
.low-completion .percentage-text {
  fill: #f44336;
}

.medium-completion .percentage-text {
  fill: #ff9800;
}

.high-completion .percentage-text {
  fill: #4caf50;
}
</style>
</template>