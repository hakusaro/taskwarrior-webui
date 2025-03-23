<template>
  <div class="mobile-task-filters">
    <!-- Status Selector -->
    <v-card class="mb-3">
      <v-card-text class="pa-2">
        <v-chip-group
          v-model="selectedStatus"
          mandatory
          active-class="primary--text"
          column
        >
          <v-chip
            v-for="st in allStatus"
            :key="st"
            :value="st"
            small
            outlined
            :color="st === selectedStatus ? 'primary' : undefined"
            @click="$emit('status-change', st)"
          >
            <v-icon left x-small>{{ statusIcons[st] }}</v-icon>
            {{ st }}
            <v-badge
              v-if="st === 'pending' && taskCounts[st] > 0"
              :content="taskCounts[st]"
              :color="st === selectedStatus ? 'primary' : 'grey'"
              inline
              x-small
            />
          </v-chip>
        </v-chip-group>
      </v-card-text>
    </v-card>
    
    <!-- Context and Mode Selection Row -->
    <div class="d-flex flex-wrap align-center mb-3">
      <v-menu offset-y>
        <template v-slot:activator="{ on, attrs }">
          <v-btn
            small
            outlined
            class="mr-2 mb-2"
            v-bind="attrs"
            v-on="on"
          >
            <v-icon left small>mdi-filter-variant</v-icon>
            Context: {{ activeContext === 'none' ? 'None' : activeContext }}
          </v-btn>
        </template>
        <v-list dense>
          <v-list-item
            v-for="ctx in availableContexts"
            :key="ctx.value"
            @click="selectContext(ctx.value)"
          >
            <v-list-item-title>
              {{ ctx.text }}
              <v-icon v-if="ctx.value === activeContext" small color="primary" class="ml-2">
                mdi-check
              </v-icon>
            </v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>

      <v-menu offset-y>
        <template v-slot:activator="{ on, attrs }">
          <v-btn
            small
            outlined
            class="mr-2 mb-2"
            v-bind="attrs"
            v-on="on"
          >
            <v-icon left small>mdi-view-module</v-icon>
            Mode: {{ currentMode }}
          </v-btn>
        </template>
        <v-list dense>
          <v-list-item
            v-for="mode in allModes"
            :key="mode"
            @click="selectMode(mode)"
          >
            <v-list-item-title>
              {{ mode }}
              <v-icon v-if="mode === currentMode" small color="primary" class="ml-2">
                mdi-check
              </v-icon>
            </v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>

      <template v-if="currentMode === 'Projects'">
        <v-menu offset-y v-if="projectsList.length > 0">
          <template v-slot:activator="{ on, attrs }">
            <v-btn
              small
              outlined
              class="mr-2 mb-2"
              v-bind="attrs"
              v-on="on"
            >
              <v-icon left small>mdi-folder</v-icon>
              Project: {{ currentProject || 'Select' }}
            </v-btn>
          </template>
          <v-list dense>
            <v-list-item
              v-for="proj in projectsList"
              :key="proj"
              @click="selectProject(proj)"
            >
              <v-list-item-title>
                {{ proj }}
                <v-icon v-if="proj === currentProject" small color="primary" class="ml-2">
                  mdi-check
                </v-icon>
              </v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>
        
        <v-chip v-if="currentProject" small color="primary" class="mb-2">
          {{ currentProject }}
          <v-progress-circular
            :size="16"
            :width="2"
            :value="projectProgress"
            color="white"
            class="ml-1"
          ></v-progress-circular>
        </v-chip>
      </template>
    </div>

    <!-- Global Actions -->
    <div class="d-flex flex-wrap align-center mb-3">
      <v-btn
        small
        color="primary"
        class="mr-2 mb-2"
        @click="$emit('refresh')"
      >
        <v-icon left small>mdi-refresh</v-icon>
        Refresh
      </v-btn>

      <v-btn
        v-if="showSyncBtn"
        small
        color="primary"
        class="mr-2 mb-2"
        @click="$emit('sync')"
      >
        <v-icon left small>mdi-sync</v-icon>
        Sync
      </v-btn>

      <v-btn
        small
        color="primary"
        class="mr-2 mb-2"
        @click="$emit('new-task')"
      >
        <v-icon left small>mdi-plus</v-icon>
        New Task
      </v-btn>

      <v-btn
        small
        outlined
        class="mb-2"
        @click="$emit('config-columns')"
      >
        <v-icon left small>mdi-cogs</v-icon>
        Columns
      </v-btn>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, computed, PropType } from '@nuxtjs/composition-api';

export default defineComponent({
  props: {
    status: {
      type: String,
      required: true
    },
    mode: {
      type: String,
      required: true
    },
    showSyncBtn: {
      type: Boolean,
      default: false
    },
    availableContexts: {
      type: Array as PropType<{ text: string, value: string }[]>,
      required: true
    },
    activeContext: {
      type: String,
      required: true
    },
    allStatus: {
      type: Array as PropType<string[]>,
      required: true
    },
    allModes: {
      type: Array as PropType<string[]>,
      required: true
    },
    taskCounts: {
      type: Object as PropType<Record<string, number>>,
      required: true
    },
    currentProject: {
      type: String,
      default: ''
    },
    projectProgress: {
      type: Number,
      default: 0
    },
    projectsList: {
      type: Array as PropType<string[]>,
      default: () => []
    }
  },

  setup(props, { emit }) {
    const statusIcons: { [st: string]: string } = {
      pending: 'mdi-clock-outline',
      waiting: 'mdi-pause',
      completed: 'mdi-check',
      deleted: 'mdi-delete',
      recurring: 'mdi-restart'
    };

    const selectedStatus = computed({
      get: () => props.status,
      set: (value: string) => emit('status-change', value)
    });

    const currentMode = computed(() => props.mode);

    const selectContext = (context: string) => {
      emit('context-change', context);
    };

    const selectMode = (mode: string) => {
      emit('mode-change', mode);
    };
    
    const selectProject = (project: string) => {
      emit('project-change', project);
    };

    return {
      selectedStatus,
      statusIcons,
      currentMode,
      selectContext,
      selectMode,
      selectProject
    };
  }
});
</script>

<style scoped>
.mobile-task-filters {
  margin-bottom: 16px;
}
</style>