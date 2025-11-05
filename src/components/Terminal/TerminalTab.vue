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

// Current working directory for path resolution
const currentWorkingDir = ref('');
let homeDir = '';

onMounted(async () => {
  if (!outputWrap.value) return;

  // Get home directory from main process
  homeDir = await window.api.getHomeDir();
  currentWorkingDir.value = homeDir;

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

  // Track directory changes
  trackDirectoryChange(command);

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

// Track directory changes to maintain current working directory
const trackDirectoryChange = (command: string) => {
  const trimmed = command.trim();

  if (trimmed.startsWith('cd ')) {
    let path = trimmed.substring(3).trim();

    // Remove trailing slash if present
    if (path.endsWith('/') && path.length > 1) {
      path = path.slice(0, -1);
    }

    if (!path || path === '~') {
      currentWorkingDir.value = homeDir;
    } else if (path.startsWith('/')) {
      // Absolute path
      currentWorkingDir.value = path;
    } else if (path.startsWith('~/')) {
      // Home-relative path
      currentWorkingDir.value = homeDir + path.substring(1);
    } else if (path === '..') {
      // Go up one directory
      const parts = currentWorkingDir.value.split('/').filter(p => p);
      parts.pop();
      currentWorkingDir.value = parts.length > 0 ? '/' + parts.join('/') : '/';
    } else if (path.includes('../')) {
      // Handle paths with .. in them (e.g., ../folder or folder/../otherfolder)
      const parts = currentWorkingDir.value.split('/').filter(p => p);
      const pathParts = path.split('/');

      for (const part of pathParts) {
        if (part === '..') {
          parts.pop();
        } else if (part && part !== '.') {
          parts.push(part);
        }
      }

      currentWorkingDir.value = parts.length > 0 ? '/' + parts.join('/') : '/';
    } else {
      // Relative path (including nested like Documents/Project/ProjectA)
      currentWorkingDir.value = currentWorkingDir.value + '/' + path;
    }

    // Normalize path (remove duplicate slashes, etc.)
    currentWorkingDir.value = currentWorkingDir.value.replace(/\/+/g, '/');
  }
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
  const builtInSuggestions = await generateSuggestions(lastWord, input);

  if (builtInSuggestions.length > 0) {
    suggestions.value = builtInSuggestions;
    selectedSuggestionIndex.value = 0;
  }
};

// Generate suggestions based on input
const generateSuggestions = async (lastWord: string, fullInput: string): Promise<string[]> => {
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

  const words = fullInput.trim().split(/\s+/);
  const commandName = words[0];

  // If at the start (first word), suggest commands
  if (words.length === 1) {
    return commonCommands
      .filter(cmd => cmd.startsWith(lastWord))
      .slice(0, 10);
  }

  // If starts with 'git ' and only 2 words, suggest git commands
  if (commandName === 'git' && words.length === 2) {
    return gitCommands
      .filter(cmd => cmd.startsWith(fullInput.trim()))
      .map(cmd => cmd.substring(4).trim())
      .slice(0, 10);
  }

  // If starts with 'npm ' and only 2 words, suggest npm commands
  if (commandName === 'npm' && words.length === 2) {
    return npmCommands
      .filter(cmd => cmd.startsWith(fullInput.trim()))
      .map(cmd => cmd.substring(4).trim())
      .slice(0, 10);
  }

  // For subsequent words, try path-based autocomplete
  if (words.length >= 2) {
    // Commands that typically take file/directory paths
    const pathCommands = ['cd', 'ls', 'cat', 'rm', 'cp', 'mv', 'mkdir', 'touch', 'chmod', 'chown', 'vim', 'nano', 'code'];

    if (pathCommands.includes(commandName)) {
      return await getPathSuggestions(lastWord);
    }
  }

  return [];
};

// Get path-based suggestions (files/directories)
const getPathSuggestions = async (partialPath: string): Promise<string[]> => {
  try {
    let searchDir = currentWorkingDir.value;
    let prefix = '';

    // Handle paths with directory separators
    if (partialPath.includes('/')) {
      const lastSlash = partialPath.lastIndexOf('/');
      const dirPart = partialPath.substring(0, lastSlash + 1);
      prefix = partialPath.substring(lastSlash + 1);

      // Resolve the directory to search
      if (dirPart.startsWith('/')) {
        searchDir = dirPart;
      } else if (dirPart.startsWith('~/')) {
        searchDir = homeDir + dirPart.substring(1);
      } else {
        searchDir = currentWorkingDir.value + '/' + dirPart;
      }
    } else {
      prefix = partialPath;
    }

    // Read directory contents
    const entries = await window.api.readDir(searchDir);

    // Filter and format suggestions
    return entries
      .filter((entry: { name: string; isDirectory: boolean }) =>
        entry.name.startsWith(prefix) && !entry.name.startsWith('.')
      )
      .map((entry: { name: string; isDirectory: boolean }) => {
        const name = entry.name;
        // Add trailing slash for directories
        return entry.isDirectory ? name + '/' : name;
      })
      .slice(0, 15);
  } catch (error) {
    console.error('Error getting path suggestions:', error);
    return [];
  }
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
  const isDirectory = suggestion.endsWith('/');

  if (words.length === 1) {
    // Replace the whole input if it's a single word
    // Add space only if it's not a directory (directories need to allow continuation)
    inputValue.value = suggestion + (isDirectory ? '' : ' ');
  } else {
    // Replace the last word
    const lastWord = words[words.length - 1];

    // Check if the last word contains a partial path
    if (lastWord.includes('/')) {
      const lastSlash = lastWord.lastIndexOf('/');
      const pathPrefix = lastWord.substring(0, lastSlash + 1);
      words[words.length - 1] = pathPrefix + suggestion;
    } else {
      words[words.length - 1] = suggestion;
    }

    inputValue.value = words.join(' ') + (isDirectory ? '' : ' ');
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