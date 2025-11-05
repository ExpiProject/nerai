/// <reference types="@electron-forge/plugin-vite/forge-vite-env" />

declare module '*.vue' {
    import { DefineComponent } from 'vue';
    const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, any>;
    export default component;
}
