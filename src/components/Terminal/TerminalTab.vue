<template>
  <div class="h-full w-full flex flex-col bg-[#0b0f14]">
    <!-- Output Panel (Read-only) -->
    <div class="flex-1 overflow-hidden border-b border-gray-700">
      <div ref="outputWrap" class="h-full w-full"></div>
    </div>

    <!-- Input Panel -->
    <div class="h-12 flex items-center px-3 bg-[#0d1117] border-t border-gray-700">
      <span class="text-green-400 mr-2 font-mono text-sm">❯</span>
      <input
        ref="inputField"
        v-model="inputValue"
        @keydown.enter="handleEnter"
        @keydown.up="handleHistoryUp"
        @keydown.down="handleHistoryDown"
        @keydown.tab.prevent="handleTab"
        type="text"
        class="flex-1 bg-transparent outline-none text-gray-200 font-mono text-sm"
        placeholder="Type command..."
      />
    </div>
  </div>
</template>


<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { FitAddon } from '@xterm/addon-fit';


const outputWrap = ref<HTMLDivElement | null>(null);
const inputField = ref<HTMLInputElement | null>(null);
const inputValue = ref('');

let outputTerm: Terminal | null = null;
let fit: FitAddon | null = null;
let disposer: (() => void) | null = null;
let ptyId: string | null = null;

// Command history
const commandHistory = ref<string[]>([]);
const historyIndex = ref(-1);

// Current line buffer for tab completion
let currentBuffer = '';

onMounted(async () => {
  if (!outputWrap.value) return;

  // Create output terminal (read-only)
  outputTerm = new Terminal({
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 13,
    theme: {
      background: '#0b0f14',
      foreground: '#e5e7eb',
      cursor: '#4ade80',
      black: '#0b0f14'
    },
    cursorBlink: false,
    disableStdin: true, // Make it read-only
    scrollback: 10000
  });

  fit = new FitAddon();
  outputTerm.loadAddon(fit);
  outputTerm.open(outputWrap.value);
  fit.fit();

  const cols = outputTerm.cols;
  const rows = outputTerm.rows;

  // Create PTY
  const { id } = await window.api.createPty(cols, rows);
  ptyId = id;

  // Resize observer
  const ro = new ResizeObserver(() => {
    if (fit && outputTerm) {
      fit.fit();
      window.api.resizePty(ptyId!, outputTerm.cols, outputTerm.rows);
    }
  });
  ro.observe(outputWrap.value);

  // Subscribe to data
  disposer = window.api.onPtyData(ptyId, (chunk: string) => {
    if (outputTerm) {
      outputTerm.write(chunk);
    }
  });

  // Exit handling
  window.api.onPtyExit(ptyId, () => {
    outputTerm?.write('\r\n\x1b[31m[process exited]\x1b[0m\r\n');
  });

  // Focus input field
  inputField.value?.focus();
});

// Handle Enter key - send command
const handleEnter = () => {
  if (!ptyId || !inputValue.value.trim()) return;

  const command = inputValue.value;

  // Add to history
  if (command.trim()) {
    commandHistory.value.push(command);
    historyIndex.value = commandHistory.value.length;
  }

  // Send to PTY with newline
  window.api.writePty(ptyId, command + '\n');

  // Clear input
  inputValue.value = '';
  currentBuffer = '';
};

// Handle Up arrow - previous command
const handleHistoryUp = (e: KeyboardEvent) => {
  e.preventDefault();
  if (commandHistory.value.length === 0) return;

  if (historyIndex.value > 0) {
    historyIndex.value--;
    inputValue.value = commandHistory.value[historyIndex.value];
  }
};

// Handle Down arrow - next command
const handleHistoryDown = (e: KeyboardEvent) => {
  e.preventDefault();
  if (commandHistory.value.length === 0) return;

  if (historyIndex.value < commandHistory.value.length - 1) {
    historyIndex.value++;
    inputValue.value = commandHistory.value[historyIndex.value];
  } else {
    historyIndex.value = commandHistory.value.length;
    inputValue.value = '';
  }
};

// Handle Tab key - send tab character for autocomplete
const handleTab = () => {
  if (!ptyId) return;

  // Send tab character to shell for autocomplete
  window.api.writePty(ptyId, '\t');
};

// Cleanup on unmount
onBeforeUnmount(() => {
  disposer?.();
  if (ptyId) {
    window.api.killPty(ptyId);
  }
});
</script>