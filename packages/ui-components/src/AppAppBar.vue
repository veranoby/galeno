<template>
  <v-app-bar :color="color" :elevation="elevation">
    <v-app-bar-nav-icon @click="emit('nav-click')" />

    <v-app-bar-title>
      <slot name="title">
        {{ title }}
      </slot>
    </v-app-bar-title>

    <v-spacer />

    <slot name="actions" />
  </v-app-bar>
</template>

<script setup lang="ts">
interface Props {
  title?: string;
  color?: string;
  elevation?: string | number;
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Galeno',
  color: 'primary',
  elevation: '2',
});

const emit = defineEmits<{
  'nav-click': [];
}>();
</script>
