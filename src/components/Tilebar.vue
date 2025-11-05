<template>
  <div class="h-10 flex items-center justify-center gap-3 pl-16 pr-3 bg-panel border-b border-white/10 drag">
    <div class="no-drag text-sm text-gray-300">Nerai</div>
<!--    <div class="ml-auto flex gap-2 no-drag">-->
<!--      <a href="https://github.com/" class="text-xs text-gray-400 hover:text-white">GitHub</a>-->
<!--    </div>-->
  </div>
</template>
<style scoped>
.drag { -webkit-app-region: drag; }
.no-drag { -webkit-app-region: no-drag; }
</style>