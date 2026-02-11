// ============================================================================
// GALENO UI COMPONENTS - Plugins
// ============================================================================

/**
 * Register all Galeno UI plugins
 *
 * @usage
 * import { registerPlugins } from '@galeno/ui-components/plugins';
 *
 * const app = createApp(App);
 * registerPlugins(app);
 */

import { vuetify } from '../design/vuetify';

export function registerPlugins(app: any) {
  // Vuetify con tema Galeno
  app.use(vuetify);
}

// Export Vuetify separately for direct use
export { vuetify } from '../design/vuetify';
