// @galeno/ui-components
// Galeno Design System - Componentes Vuetify compartidos

// ============================================================================
// COMPONENTES BASE
// ============================================================================

export { default as AppButton } from './AppButton.vue';
export { default as ConfirmDialog } from './ConfirmDialog.vue';
export { default as AppAppBar } from './AppAppBar.vue';
export { default as AppNavDrawer } from './AppNavDrawer.vue';
export { default as AppCard } from './AppCard.vue';
export { default as AppInput } from './AppInput.vue';
export { default as AppSelect } from './AppSelect.vue';
export { default as AppDatePicker } from './AppDatePicker.vue';
export { default as AppStatusBadge } from './AppStatusBadge.vue';

// ============================================================================
// COMPONENTES IA
// ============================================================================

export { default as IaChip } from './IaChip.vue';

// ============================================================================
// DESIGN SYSTEM
// ============================================================================

export * from './design';

// ============================================================================
// PLUGINS
// ============================================================================

export * from './plugins';

// ============================================================================
// TYPES
// ============================================================================

export interface NavItem {
  value: string;
  title: string;
  icon: string;
  badge?: number | string;
  disabled?: boolean;
}

export interface DialogProps {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: string;
  cancelColor?: string;
  maxWidth?: string | number;
}

// ============================================================================
// VUETIFY PLUGIN EXPORT
// ============================================================================

export { vuetify } from './design/vuetify';
