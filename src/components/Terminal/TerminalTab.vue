<template>
  <div ref="wrap" class="h-full w-full"></div>
</template>


<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { FitAddon } from '@xterm/addon-fit';


const wrap = ref<HTMLDivElement | null>(null);

let term: Terminal | null = null;
let fit: FitAddon | null = null;
let disposer: (() => void) | null = null;


onMounted(async () => {
  if (!wrap.value) return;

  term = new Terminal({
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 13,
    theme: {
      background: '#0b0f14',
      foreground: '#e5e7eb',
      cursor: '#4ade80',
      black: '#0b0f14'
    }
  });
  fit = new FitAddon();
  term.loadAddon(fit);
  term.open(wrap.value);
  fit.fit();


  const cols = term.cols;
  const rows = term.rows;


// Create PTY
  const { id } = await window.api.createPty(cols, rows);


// Keep the id stable per component instance (renderer id equals pty id)
  const ptyId = id;


// Handle keyboard
  term.onData(data => window.api.writePty(ptyId, data));


// Resize observer
  const ro = new ResizeObserver(() => {
    if (fit && term) {
      fit.fit();
      window.api.resizePty(ptyId, term.cols, term.rows);
    }
  });
  ro.observe(wrap.value);


// Subscribe to data
  disposer = window.api.onPtyData(ptyId, (chunk: string) => {
    if (term) {
      term.write(chunk);
    }
  });


// exit handling
  window.api.onPtyExit(ptyId, () => {
    term?.write('\r\n\x1b[31m[process exited]\x1b[0m\r\n');
  });


// Cleanup on unmount
  onBeforeUnmount(() => {
    disposer?.();
    window.api.killPty(ptyId);
  });
});
</script>