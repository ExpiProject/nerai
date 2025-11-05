<script setup lang="ts">
import { ref } from 'vue';
import Titlebar from './components/Tilebar.vue';
import TerminalTab from './components/Terminal/TerminalTab.vue';


interface Tab { id: string; title: string }

function generateId() {
  // Use crypto.randomUUID if available, fallback to random string
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return (crypto as any).randomUUID();
  }
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

const tabs = ref<Tab[]>([{ id: generateId(), title: 'Tab 1' }]);
const activeId = ref(tabs.value[0].id);


function addTab() {
  const id = generateId();
  tabs.value.push({ id, title: `Tab ${tabs.value.length+1}`});
  activeId.value = id;
}
</script>

<template>
  <div class="h-screen w-screen select-none flex flex-col">
    <Titlebar />


    <div class="px-3 pt-2 flex gap-2 border-b border-white/5 bg-panel">
      <button
          v-for="t in tabs"
          :key="t.id"
          class="px-3 py-1 rounded-t-xl text-sm"
          :class="t.id === activeId ? 'bg-bg text-white' : 'text-gray-400 hover:text-white'"
          @click="activeId = t.id"
      >
        {{ t.title }}
      </button>
      <button class="ml-auto text-accent" @click="addTab">＋</button>
    </div>


    <div class="flex-1 overflow-hidden">
      <TerminalTab v-for="t in tabs" :key="t.id" v-show="t.id===activeId" :id="t.id"/>
    </div>
  </div>
</template>

<style scoped>

</style>