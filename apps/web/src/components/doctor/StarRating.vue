<!-- apps/web/src/components/doctor/StarRating.vue -->
<template>
  <div class="star-rating" :class="{ 'interactive': interactive, 'readonly': !interactive }">
    <div
      v-for="star in 5"
      :key="star"
      class="star"
      :class="{ 
        'filled': star <= modelValue,
        'hovered': interactive && star <= hoverValue,
        'half': halfStars && star === Math.ceil(modelValue) && modelValue % 1 !== 0
      }"
      @mouseenter="interactive ? hoverValue = star : null"
      @mouseleave="interactive ? hoverValue = 0 : null"
      @click="interactive ? emit('update:modelValue', star) : null"
    >
      <v-icon
        :icon="star <= (interactive && hoverValue ? hoverValue : modelValue) ? 'mdi-star' : 'mdi-star-outline'"
        :size="size"
        :color="star <= (interactive && hoverValue ? hoverValue : modelValue) ? color : 'grey-lighten-2'"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  modelValue: number;
  interactive?: boolean;
  size?: 'small' | 'medium' | 'large' | number;
  color?: string;
  halfStars?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  interactive: false,
  size: 'medium',
  color: 'warning',
  halfStars: false
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void;
}>();

const hoverValue = ref(0);
</script>

<style scoped lang="scss">
.star-rating {
  display: inline-flex;
  gap: 4px;
  cursor: default;

  &.interactive {
    cursor: pointer;
  }

  .star {
    transition: all 0.2s ease;

    &.interactive:hover {
      transform: scale(1.1);
    }
  }
}
</style>
