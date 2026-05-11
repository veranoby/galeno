/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare module 'virtual:pwa-register/vue' {
  import { type RegisterSWOptions } from 'vite-plugin-pwa/client';
  export function useRegisterSW(options: RegisterSWOptions): {
    needRefresh: any;
    updateServiceWorker: any;
    onOfflineReady: any;
  };
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}
