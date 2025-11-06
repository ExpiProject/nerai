<script setup lang="ts">
import { ref } from 'vue';
import Splitter from 'primevue/splitter';
import SplitterPanel from 'primevue/splitterpanel';
import InputGroup from 'primevue/inputgroup';
import InputGroupAddon from 'primevue/inputgroupaddon';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import SelectButton from 'primevue/selectbutton';
import TabsContainer from "@src/components/Browser/BrowserTabs/TabsContainer.vue";

const value = ref('Tabs');
const options = ref(['Tabs', 'Notes', 'Files']);
</script>

<template>
  <div class="h-full w-full">
    <Splitter style="height: 100%; width: 100%">


      <!--  Sidebar-->
      <SplitterPanel :size="15" class="bg-pink-300">
        <div class="h-full flex flex-col justify-start p-2 gap-2 bg-pink-300">
          <div class="relative flex flex-col gap-2 h-fit w-full">
            <InputGroup class="h-8">
              <InputText
                  type="text"
                  name="addressBar"
                  placeholder="Search..."
                  class="text-md w-full"
              />
              <InputGroupAddon>
                <Button icon="pi pi-copy" severity="secondary" variant="text"/>
              </InputGroupAddon>
            </InputGroup>
            <SelectButton class="h-8 text-xs" size="small" v-model="value" :options="options" fluid />
          </div>
          <TabsContainer/>
        </div>
      </SplitterPanel>

      <!--  Main content-->
      <SplitterPanel :size="85" :minSize="60" class="flex items-center justify-center p-2 bg-pink-300">
        <div class="h-full w-full flex-1 bg-green-300 rounded-xl">
          <slot/>
        </div>
      </SplitterPanel>

    </Splitter>
  </div>
</template>

<style scoped>

</style>