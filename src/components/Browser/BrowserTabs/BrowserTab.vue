<script setup lang="ts">
import InputGroup from 'primevue/inputgroup';
import InputGroupAddon from 'primevue/inputgroupaddon';
import Image from 'primevue/image';
import Button from 'primevue/button';

</script>

<template>
  <div class="w-full h-8 rounded-md bg-blue-300">
    <InputGroup class="w-full h-full">
      <div class="w-full flex items-center p-2 text-xs">
        <Image src="https://www.google.com/s2/favicons?domain=https://www.youtube.com" class="h-4 mr-2"/>
        <Button icon="pi pi-volume-up" severity="secondary" variant="text" class="bg-transparent hover:bg-transparent hover:scale-125" />
        TEST
      </div>
      <InputGroupAddon class="bg-transparent border-none">
        <Button icon="pi pi-times-circle" severity="secondary" variant="text" @click="toggle"/>
      </InputGroupAddon>
    </InputGroup>
  </div>
</template>

<style scoped>

</style>