<template>
  <div class="h-full w-full flex flex-col bg-[#0b0f14]">
    <!-- Output Panel (Read-only) -->
    <div class="flex-1 overflow-hidden border-b border-gray-700">
      <div ref="outputWrap" class="h-full w-full"></div>
    </div>

    <!-- Input Panel -->
    <div class="relative h-12 flex items-center px-3 bg-[#0d1117] border-t border-gray-700">
      <span class="text-green-400 mr-2 font-mono text-sm">❯</span>
      <div class="flex-1 relative">
        <input
          ref="inputField"
          v-model="inputValue"
          @keydown.enter="handleEnter"
          @keydown.up="handleHistoryUp"
          @keydown.down="handleHistoryDown"
          @keydown.tab.prevent="handleTab"
          @input="handleInput"
          type="text"
          class="w-full bg-transparent outline-none text-gray-200 font-mono text-sm"
          placeholder="Type command..."
        />

        <!-- Autocomplete Dropdown -->
        <div
          v-if="suggestions.length > 0"
          class="absolute bottom-full left-0 mb-1 w-full max-w-md bg-[#1c2128] border border-gray-600 rounded-md shadow-lg max-h-64 overflow-y-auto z-50"
        >
          <div
            v-for="(suggestion, index) in suggestions"
            :key="index"
            @click="selectSuggestion(suggestion)"
            :class="[
              'px-3 py-2 cursor-pointer font-mono text-sm',
              index === selectedSuggestionIndex
                ? 'bg-[#2d333b] text-green-400'
                : 'text-gray-300 hover:bg-[#2d333b]'
            ]"
          >
            {{ suggestion }}
          </div>
        </div>
      </div>
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

// Autocomplete suggestions
const suggestions = ref<string[]>([]);
const selectedSuggestionIndex = ref(0);

// Tab completion state
let isWaitingForCompletion = false;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let completionBuffer = '';
let completionTimeout: ReturnType<typeof setTimeout> | null = null;

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
    if (fit && outputTerm && ptyId) {
      fit.fit();
      window.api.resizePty(ptyId, outputTerm.cols, outputTerm.rows);
    }
  });
  ro.observe(outputWrap.value);

  // Subscribe to data
  disposer = window.api.onPtyData(ptyId, (chunk: string) => {
    if (outputTerm) {
      outputTerm.write(chunk);
    }

    // Capture tab completion responses
    if (isWaitingForCompletion) {
      completionBuffer += chunk;

      // Reset timeout
      if (completionTimeout) clearTimeout(completionTimeout);

      // Wait for completion to finish (200ms after last data)
      completionTimeout = setTimeout(() => {
        processCompletionBuffer();
        isWaitingForCompletion = false;
        completionBuffer = '';
      }, 200);
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
  if (!ptyId) return;

  // If suggestions are visible, select the highlighted one
  if (suggestions.value.length > 0) {
    selectSuggestion(suggestions.value[selectedSuggestionIndex.value]);
    return;
  }

  if (!inputValue.value.trim()) return;

  const command = inputValue.value;

  // Add to history
  if (command.trim()) {
    commandHistory.value.push(command);
    historyIndex.value = commandHistory.value.length;
  }

  // Send to PTY with newline
  window.api.writePty(ptyId, command + '\n');

  // Clear input and suggestions
  inputValue.value = '';
  suggestions.value = [];
  selectedSuggestionIndex.value = 0;
};

// Handle Up arrow - previous command or navigate suggestions
const handleHistoryUp = (e: KeyboardEvent) => {
  e.preventDefault();

  // If suggestions are visible, navigate them
  if (suggestions.value.length > 0) {
    selectedSuggestionIndex.value =
      selectedSuggestionIndex.value > 0
        ? selectedSuggestionIndex.value - 1
        : suggestions.value.length - 1;
    return;
  }

  // Otherwise navigate command history
  if (commandHistory.value.length === 0) return;

  if (historyIndex.value > 0) {
    historyIndex.value--;
    inputValue.value = commandHistory.value[historyIndex.value];
  }
};

// Handle Down arrow - next command or navigate suggestions
const handleHistoryDown = (e: KeyboardEvent) => {
  e.preventDefault();

  // If suggestions are visible, navigate them
  if (suggestions.value.length > 0) {
    selectedSuggestionIndex.value =
      selectedSuggestionIndex.value < suggestions.value.length - 1
        ? selectedSuggestionIndex.value + 1
        : 0;
    return;
  }

  // Otherwise navigate command history
  if (commandHistory.value.length === 0) return;

  if (historyIndex.value < commandHistory.value.length - 1) {
    historyIndex.value++;
    inputValue.value = commandHistory.value[historyIndex.value];
  } else {
    historyIndex.value = commandHistory.value.length;
    inputValue.value = '';
  }
};

// Handle Tab key - trigger autocomplete or select suggestion
const handleTab = () => {
  if (!ptyId) return;

  // If suggestions are visible, select the highlighted one
  if (suggestions.value.length > 0) {
    selectSuggestion(suggestions.value[selectedSuggestionIndex.value]);
    return;
  }

  // Otherwise trigger autocomplete from shell
  const input = inputValue.value;
  if (!input.trim()) return;

  // Request completion
  isWaitingForCompletion = true;
  completionBuffer = '';

  // Create a hidden PTY session to get completions without affecting output
  getShellCompletions(input);
};

// Get shell completions
const getShellCompletions = async (input: string) => {
  if (!ptyId) return;

  // For simple file/command completion, we'll use a heuristic approach
  // Extract the last word (what we're trying to complete)
  const words = input.split(/\s+/);
  const lastWord = words[words.length - 1] || '';

  // Generate suggestions based on common commands and patterns
  const builtInSuggestions = generateSuggestions(lastWord, input);

  if (builtInSuggestions.length > 0) {
    suggestions.value = builtInSuggestions;
    selectedSuggestionIndex.value = 0;
  }
};

// Generate suggestions based on input
const generateSuggestions = (lastWord: string, fullInput: string): string[] => {
  const commonCommands = [
    'ls', 'cd', 'pwd', 'cat', 'grep', 'find', 'mkdir', 'rm', 'cp', 'mv',
    'echo', 'touch', 'chmod', 'chown', 'ps', 'kill', 'top', 'df', 'du',
    'git', 'npm', 'node', 'python', 'pip', 'curl', 'wget', 'ssh', 'scp',
    'tar', 'zip', 'unzip', 'vim', 'nano', 'code', 'clear', 'exit'
  ];

  const gitCommands = [
    'git add', 'git commit', 'git push', 'git pull', 'git status',
    'git branch', 'git checkout', 'git merge', 'git log', 'git diff',
    'git clone', 'git init', 'git remote', 'git fetch', 'git rebase'
  ];

  const npmCommands = [
    'npm install', 'npm start', 'npm run', 'npm test', 'npm build',
    'npm init', 'npm update', 'npm publish', 'npm uninstall'
  ];

  // If at the start (first word), suggest commands
  if (fullInput.trim().split(/\s+/).length === 1) {
    return commonCommands
      .filter(cmd => cmd.startsWith(lastWord))
      .slice(0, 10);
  }

  // If starts with 'git ', suggest git commands
  if (fullInput.startsWith('git ')) {
    return gitCommands
      .filter(cmd => cmd.startsWith(fullInput.trim()))
      .map(cmd => cmd.substring(4).trim())
      .slice(0, 10);
  }

  // If starts with 'npm ', suggest npm commands
  if (fullInput.startsWith('npm ')) {
    return npmCommands
      .filter(cmd => cmd.startsWith(fullInput.trim()))
      .map(cmd => cmd.substring(4).trim())
      .slice(0, 10);
  }

  return [];
};

// Process completion buffer from shell
const processCompletionBuffer = () => {
  // Parse shell completion responses if available
  if (completionBuffer) {
    // For future enhancement: parse actual shell tab completion output
    // Currently we use built-in suggestions
    console.debug('Completion buffer:', completionBuffer);
  }
};

// Select a suggestion
const selectSuggestion = (suggestion: string) => {
  const words = inputValue.value.trim().split(/\s+/);

  if (words.length === 1) {
    // Replace the whole input if it's a single word
    inputValue.value = suggestion + ' ';
  } else {
    // Replace the last word
    words[words.length - 1] = suggestion;
    inputValue.value = words.join(' ') + ' ';
  }

  // Clear suggestions
  suggestions.value = [];
  selectedSuggestionIndex.value = 0;

  // Focus back on input
  inputField.value?.focus();
};

// Handle input changes
const handleInput = () => {
  // Clear suggestions when user types
  if (suggestions.value.length > 0) {
    suggestions.value = [];
    selectedSuggestionIndex.value = 0;
  }

  // Reset history index
  historyIndex.value = commandHistory.value.length;
};

// Cleanup on unmount
onBeforeUnmount(() => {
  disposer?.();
  if (ptyId) {
    window.api.killPty(ptyId);
  }
});
</script>