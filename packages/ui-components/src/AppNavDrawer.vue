<template>
  <v-navigation-drawer v-model="isOpen" temporary>
    <v-list>
      <v-list-item
        v-for="item in items"
        :key="item.value"
        :value="item.value"
        :prepend-icon="item.icon"
        @click="handleClick(item)"
      >
        <v-list-item-title>{{ item.title }}</v-list-item-title>
      </v-list-item>
    </v-list>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
interface NavItem {
  value: string;
  title: string;
  icon: string;
}

interface Props {
  modelValue: boolean;
  items: NavItem[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  navigate: [value: string];
}>();

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

function handleClick(item: NavItem) {
  emit('navigate', item.value);
  isOpen.value = false;
}
</script>
