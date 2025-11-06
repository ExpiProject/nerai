<script setup lang="ts">
import { onMounted, ref } from 'vue';
import Electron from 'electron';

// address bar state
const addressBar = ref('https://www.google.com/');

// refs to DOM nodes (no document.*)
const webviewRef = ref<Electron.WebviewTag | null>(null);

// nav state
const canBack = ref(false);
const canForward = ref(false);

function normalizeUrl(raw: string) {
  const v = raw.trim();
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

function updateNavState() {
  const wv = webviewRef.value;
  if (!wv) return;
  // Electron's <webview> has canGoBack/Forward
  canBack.value = !!wv.canGoBack?.();
  canForward.value = !!wv.canGoForward?.();
}

function onGo() {
  const wv = webviewRef.value;
  if (!wv) return;
  const url = normalizeUrl(addressBar.value);
  wv.loadURL(url);
}

function onBack() {
  webviewRef.value?.goBack();
}

function onForward() {
  webviewRef.value?.goForward();
}

// Keep address bar in sync with navigation
function onDidNavigate(e: any) {
  // e.url is provided by webview event payload
  if (e?.url) addressBar.value = e.url;
  updateNavState();
}

function onDidNavigateInPage(e: any) {
  if (e?.url) addressBar.value = e.url;
  updateNavState();
}

function onDomReady() {
  updateNavState();
}

onMounted(() => {
  // nothing to query here; listeners are bound in-template
});
</script>

<template>
  <div class="flex flex-col h-screen w-full">
    <div class="bg-panel flex items-center gap-2 p-2 h-12">
      <input
          id="addressBar"
          v-model="addressBar"
          type="text"
          placeholder="Enter URL"
          class="flex-1 border rounded px-3 py-2"
          @keyup.enter="onGo"
      />
      <button
          id="goButton"
          class="px-3 py-2 rounded text-white"
          style="background:#2563eb"
          @click="onGo"
      >
        Go
      </button>
      <button
          id="backButton"
          class="px-3 py-2 rounded text-white disabled:opacity-50"
          style="background:#6b7280"
          :disabled="!canBack"
          @click="onBack"
      >
        Back
      </button>
      <button
          id="forwardButton"
          class="px-3 py-2 rounded text-white disabled:opacity-50"
          style="background:#6b7280"
          :disabled="!canForward"
          @click="onForward"
      >
        Forward
      </button>
    </div>

    <!-- Electron webview: requires webPreferences.webviewTag = true -->
    <webview
        ref="webviewRef"
        :src="addressBar"
        style="width:100%; height:100%; flex:1;"
        @dom-ready="onDomReady"
        @did-navigate="onDidNavigate"
        @did-navigate-in-page="onDidNavigateInPage"
    />
  </div>
</template>

<style scoped>
.bg-panel { background-color: #2d2d2d; }
input { color: #000; }
button:hover { opacity: 0.9; }
</style>
