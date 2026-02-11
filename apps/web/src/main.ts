// Plugins
import { registerPlugins } from '@/plugins';
import App from './App.vue';
import router from '@/router';
import { createPinia } from 'pinia';

// Styles
import '@/styles/main.scss';
import 'vuetify/styles';

// Composables
import { createApp } from 'vue';

// Application
const app = createApp(App);

// Pinia store
const pinia = createPinia();
app.use(pinia);

// Router
app.use(router);

// Vuetify & other plugins
registerPlugins(app);

// Mount app
app.mount('#app');
