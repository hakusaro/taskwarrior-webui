<template>
  <div>
    <div class="mobile-task-controls">
      <!-- Batch action buttons for selected tasks -->
      <div v-show="selected.length" class="selected-actions">
        <v-chip class="selected-count ma-2" color="primary">
          {{ selected.length }} selected
        </v-chip>
        <v-btn
          v-show="status === 'pending'"
          class="ma-1"
          color="success"
          small
          @click="completeTasks(selected)"
        >
          <v-icon left size="18">mdi-check</v-icon>Done
        </v-btn>
        <v-btn
          v-show="status === 'completed' || status === 'deleted'"
          class="ma-1"
          color="primary"
          small
          @click="restoreTasks(selected)"
        >
          <v-icon left size="18">mdi-restore</v-icon>Restore
        </v-btn>
        <v-btn
          v-show="status !== 'deleted'"
          class="ma-1"
          color="error"
          small
          @click="deleteTasks(selected)"
        >
          <v-icon left size="18">mdi-delete</v-icon>Delete
        </v-btn>
        <v-btn
          class="ma-1"
          text
          small
          @click="selected = []"
        >
          <v-icon left size="18">mdi-close</v-icon>Clear
        </v-btn>
      </div>
    </div>

    <!-- Task Cards List -->
    <v-card
      v-for="task in classifiedTasks[status]"
      :key="task.uuid"
      :class="['task-card mb-3', rowClass(task), {'selected': isSelected(task)}]"
      @click="toggleSelect(task)"
      elevation="1"
    >
      <div class="d-flex align-center task-card-header pa-2">
        <v-checkbox
          :input-value="isSelected(task)"
          class="mr-1 mt-0 pt-0"
          hide-details
          @click.stop="toggleSelect(task)"
        ></v-checkbox>
        
        <div class="task-project" v-if="task.project">
          <v-chip x-small color="primary" class="mr-1">{{ task.project }}</v-chip>
        </div>
        
        <div v-if="task.priority" class="mr-1">
          <v-chip 
            x-small 
            :color="priorityColor(task.priority)"
          >{{ task.priority }}</v-chip>
        </div>
        
        <v-spacer></v-spacer>
        
        <!-- Quick Action Buttons -->
        <v-btn
          v-show="status === 'pending'"
          icon
          x-small
          color="success"
          class="mr-1"
          @click.stop="completeTasks([task])"
          title="Done"
        >
          <v-icon>mdi-check</v-icon>
        </v-btn>
        <v-btn
          v-show="status === 'completed' || status === 'deleted'"
          icon
          x-small
          color="primary"
          class="mr-1"
          @click.stop="restoreTasks([task])"
          title="Restore"
        >
          <v-icon>mdi-restore</v-icon>
        </v-btn>
        <v-btn
          icon
          x-small
          color="primary"
          class="mr-1"
          @click.stop="editTask(task)"
          title="Edit"
        >
          <v-icon>mdi-pencil</v-icon>
        </v-btn>
        <v-btn
          v-show="status !== 'deleted'"
          icon
          x-small
          color="error"
          @click.stop="deleteTasks([task])"
          title="Delete"
        >
          <v-icon>mdi-delete</v-icon>
        </v-btn>
      </div>
      
      <v-card-text class="py-2">
        <div class="task-description" v-html="linkify(task.description)"></div>
        
        <!-- Task Metadata -->
        <div class="task-metadata mt-2">
          <template v-if="task.due">
            <v-chip 
              x-small 
              :color="isExpired(task.due) ? 'error' : (isUrgent(task.due) ? 'warning' : 'default')"
              class="mr-1 mb-1"
            >
              <v-icon x-small left>mdi-calendar</v-icon>
              {{ displayDate(task.due) }}
            </v-chip>
          </template>
          
          <template v-if="task.scheduled">
            <v-chip x-small class="mr-1 mb-1">
              <v-icon x-small left>mdi-calendar-clock</v-icon>
              {{ displayDate(task.scheduled) }}
            </v-chip>
          </template>
          
          <template v-if="status === 'waiting' && task.wait">
            <v-chip x-small class="mr-1 mb-1">
              <v-icon x-small left>mdi-timer-sand</v-icon>
              {{ displayDate(task.wait) }}
            </v-chip>
          </template>
          
          <template v-if="task.tags && task.tags.length">
            <v-chip 
              v-for="tag in task.tags" 
              :key="tag"
              x-small
              class="mr-1 mb-1"
            >
              <v-icon x-small left>mdi-tag</v-icon>
              {{ tag }}
            </v-chip>
          </template>
          
          <template v-if="task.urgency !== undefined">
            <v-chip x-small class="mb-1" :color="urgencyColor(task.urgency)">
              <v-icon x-small left>mdi-alert-circle</v-icon>
              {{ Math.round(task.urgency * 10) / 10 }}
            </v-chip>
          </template>
        </div>
      </v-card-text>
    </v-card>
    
    <!-- Empty State -->
    <v-card v-if="classifiedTasks[status].length === 0" class="pa-4 text-center">
      <v-icon large color="grey lighten-1">mdi-check-all</v-icon>
      <div class="text-h6 grey--text text--lighten-1">No tasks</div>
    </v-card>
  </div>
</template>

<script lang="ts">
import { defineComponent, useStore, computed, reactive, ref, ComputedRef, Ref } from '@nuxtjs/composition-api';
import { Task } from 'taskwarrior-lib';
import _ from 'lodash';
import moment from 'moment';
import urlRegex from 'url-regex-safe';
import normalizeUrl from 'normalize-url';
import { accessorType } from "../store";

function displayDate(str?: string) {
  if (!str)
    return str;

  const date = moment(str);
  const diff = moment.duration(date.diff(moment()));
  if (Math.abs(diff.asDays()) < 1)
    return diff.humanize(true);
  return date.format('YYYY-MM-DD');
}

function isUrgent(str?: string) {
  if (!str)
    return false;

  const date = moment(str);
  const diff = moment.duration(date.diff(moment()));
  const days = diff.asDays();
  if (days > 0 && days < 1)
    return true;

  return false;
}

function isExpired(str?: string) {
  if (!str)
    return false;

  const date = moment(str);
  return date.isBefore(moment());
}

function linkify(text: string) {
  const regex = urlRegex();

  let match;
  let lastIndex = 0;
  let result = '';
  while ((match = regex.exec(text)) !== null) {
    const str = text.substring(lastIndex, match.index);
    const url = `<a target="_blank" href=${normalizeUrl(match[0])}>${match[0]}</a>`;
    result = `${result}${str}${url}`;
    lastIndex = match.index + match[0].length;
  }
  result += text.substring(lastIndex);

  return result;
}

export default defineComponent({
  props: {
    tasks: {
      type: Array as () => Task[],
      required: true
    },
    status: {
      type: String,
      required: true
    }
  },

  setup(props, { emit }) {
    const store = useStore<typeof accessorType>();
    const selected = ref<Task[]>([]);

    const allStatus = ['pending', 'waiting', 'completed', 'deleted', 'recurring'];

    const tempTasks: { [key: string]: ComputedRef<Task[]> } = {};
    for (const status of allStatus) {
      tempTasks[status] = computed((): Task[] => props.tasks?.filter(task => {
        if (status === "waiting" || status === "pending") {
          const waiting = (task.wait && !isExpired(task.wait))
            || (task.scheduled && moment(task.scheduled).isAfter(moment()));
          return task.status === "pending" && (status === "pending" ? !waiting : waiting);
        }
        else if (status === "pending") {
          return task.status === "pending" && !(task.wait && !isExpired(task.wait));
        }
        else {
          return task.status === status;
        }
      }).sort((a, b) => b.urgency - a.urgency) || []);
    }
    const classifiedTasks = reactive(tempTasks);

    const refresh = () => {
      store.dispatch('fetchTasks');
    };

    const showConfirmationDialog = ref(false);
    const confirmation = reactive({
      title: 'Confirm',
      text: '',
      handler: () => {}
    });

    const showTaskDialog = ref(false);
    const currentTask: Ref<Task | null> = ref(null);

    const editTask = (task: Task) => {
      emit('edit-task', task);
    };

    const completeTasks = async (tasks: Task[]) => {
      await store.dispatch('updateTasks', tasks.map(task => {
        return {
          ...task,
          status: 'completed'
        };
      }));
      selected.value = selected.value.filter(task => tasks.findIndex(t => t.uuid === task.uuid) === -1);
      store.commit('setNotification', {
        color: 'success',
        text: 'Successfully complete the task(s)'
      });
    };

    const deleteTasks = (tasks: Task[]) => {
      emit('confirm', {
        text: 'Are you sure to delete the task(s)?',
        handler: async () => {
          await store.dispatch('deleteTasks', tasks);
          selected.value = selected.value.filter(task => tasks.findIndex(t => t.uuid === task.uuid) === -1);
          store.commit('setNotification', {
            color: 'success',
            text: 'Successfully delete the task(s)'
          });
        }
      });
    };

    const restoreTasks = (tasks: Task[]) => {
      emit('confirm', {
        text: 'Are you sure to restore the task(s)?',
        handler: async () => {
          await store.dispatch('updateTasks', tasks.map(task => {
            return {
              ...task,
              status: 'pending'
            };
          }));
          selected.value = selected.value.filter(task => tasks.findIndex(t => t.uuid === task.uuid) === -1);
          store.commit('setNotification', {
            color: 'success',
            text: 'Successfully restore the task(s)'
          });
        }
      });
    };

    const rowClass = (task: Task) => {
      if (task.mask)
        return 'recur-task';
      else if (props.status !== 'completed' && isUrgent(task.due))
        return 'urgent-task';
      else if (props.status !== 'completed' && isExpired(task.due))
        return 'expired-task';
      return undefined;
    };

    const priorityColor = (priority: string) => {
      switch (priority) {
        case 'H': return 'error';
        case 'M': return 'warning';
        case 'L': return 'info';
        default: return '';
      }
    };

    const urgencyColor = (urgency: number) => {
      if (urgency > 10) return 'error';
      if (urgency > 5) return 'warning';
      return 'grey';
    };

    const isSelected = (task: Task) => {
      if (!Array.isArray(selected.value)) {
        selected.value = [];
        return false;
      }
      return selected.value.findIndex(t => t.uuid === task.uuid) !== -1;
    };

    const toggleSelect = (task: Task) => {
      if (!Array.isArray(selected.value)) {
        selected.value = [];
      }
      
      const index = selected.value.findIndex(t => t.uuid === task.uuid);
      if (index === -1) {
        selected.value.push(task);
      } else {
        selected.value.splice(index, 1);
      }
    };

    return {
      linkify,
      refresh,
      classifiedTasks,
      selected,
      isSelected,
      toggleSelect,
      editTask,
      deleteTasks,
      completeTasks,
      restoreTasks,
      rowClass,
      displayDate,
      isUrgent,
      isExpired,
      priorityColor,
      urgencyColor
    };
  }
});
</script>

<style scoped>
.task-card {
  position: relative;
  border-left: 4px solid transparent;
}

.task-card.recur-task {
  border-left-color: #2196F3;
}

.task-card.urgent-task {
  border-left-color: #F44336;
}

.task-card.expired-task {
  border-left-color: #795548;
}

.task-card.selected {
  background-color: rgba(var(--v-primary-base), 0.05);
}

.task-description {
  font-size: 0.95rem;
  line-height: 1.4;
}

.task-metadata {
  display: flex;
  flex-wrap: wrap;
}

.mobile-task-controls {
  margin-bottom: 16px;
}

.selected-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
}

.selected-count {
  font-weight: bold;
}
</style>