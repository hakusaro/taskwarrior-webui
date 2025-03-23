<template>
	<div>
		<ConfirmationDialog
			v-model="showConfirmationDialog"
			:title="confirmation.title"
			:text="confirmation.text"
			@yes="confirmation.handler"
		/>
		<TaskDialog v-model="showTaskDialog" :task="currentTask || undefined" />
		<ColumnDialog v-model="showColumnDialog" :active-columns="headers"/>

		<!-- Common Action Bar -->
		<div class="task-actions px-3 mb-4 d-flex flex-wrap align-center">
			<!-- Batch actions - Only visible when items are selected -->
			<template v-if="selected.length">
				<div class="d-flex flex-wrap align-center">
					<v-chip class="mr-2 mb-2" color="primary">
						{{ selected.length }} selected
					</v-chip>
					<v-btn
						v-show="status === 'pending'"
						class="mr-2 mb-2"
						color="success"
						small
						@click="completeTasks(selected)"
					>
						<v-icon left size="18">mdi-check</v-icon>Done
					</v-btn>
					<v-btn
						v-show="status === 'completed' || status === 'deleted'"
						class="mr-2 mb-2"
						color="primary"
						small
						@click="restoreTasks(selected)"
					>
						<v-icon left size="18">mdi-restore</v-icon>Restore
					</v-btn>
					<v-btn
						v-show="status !== 'deleted'"
						class="mr-2 mb-2"
						color="error"
						small
						@click="deleteTasks(selected)"
					>
						<v-icon left size="18">mdi-delete</v-icon>Delete
					</v-btn>
					<v-btn
						class="mr-2 mb-2"
						text
						small
						@click="selected = []"
					>
						<v-icon left size="18">mdi-close</v-icon>Clear
					</v-btn>
				</div>
				<v-spacer />
			</template>

			<!-- Global Actions - Always visible -->
			<div class="d-flex flex-wrap align-center ml-auto">
				<v-btn
					color="primary"
					class="mr-2 mb-2"
					small
					outlined
					@click="refresh"
					title="Refresh Tasks"
				>
					<v-icon left small>mdi-refresh</v-icon>
					Refresh
				</v-btn>

				<v-btn
					v-if="showSyncBtn"
					color="primary"
					class="mr-2 mb-2"
					small
					outlined
					@click="syncTasks"
					title="Sync Tasks"
				>
					<v-icon left small>mdi-sync</v-icon>
					Sync
				</v-btn>

				<v-btn
					color="primary"
					class="mr-2 mb-2"
					small
					@click="newTask"
					title="New Task"
				>
					<v-icon left small>mdi-plus</v-icon>
					New Task
				</v-btn>
				
				<v-btn
					color="primary"
					class="mb-2"
					small
					outlined
					@click="showColumnDialog = true"
					title="Configure Columns"
				>
					<v-icon left small>mdi-cogs</v-icon>
					Columns
				</v-btn>
			</div>
		</div>

		<!-- Mobile View -->
		<div v-if="$vuetify.breakpoint.xs" class="mobile-view pa-2">
			<MobileTaskList
				:tasks="tasks"
				:status="status"
				@edit-task="editTask"
				@confirm="showConfirmation"
			/>
		</div>
		
		<!-- Desktop View -->
		<div v-else>
			<div class="px-3">
				<v-data-table
					:items="classifiedTasks[status]"
					:headers="filteredHeaders"
					show-select
					item-key="uuid"
					:item-class="rowClass"
					v-model="selected"
					class="elevation-1 rounded"
					style="width: 100%"
					:sort-by="['urgency']"
					:sort-desc="[true]"
					must-sort
					dense
				>
					<template v-slot:item.description="{ item }">
						<span v-html="linkify(item.description)" />
					</template>

					<template v-if="status === 'waiting'" v-slot:item.wait="{ item }">
						{{ displayDate(item.wait) }}
					</template>
					<template v-slot:item.scheduled="{ item }">
						{{ displayDate(item.scheduled) }}
					</template>
					<template v-slot:item.due="{ item }">
						{{ displayDate(item.due) }}
					</template>
					<template v-slot:item.until="{ item }">
						{{ displayDate(item.until) }}
					</template>

					<template v-slot:item.priority="{ item }">
						<v-chip
							v-if="item.priority"
							x-small
							:color="priorityColor(item.priority)"
						>
							{{ item.priority }}
						</v-chip>
					</template>

					<template v-slot:item.tags="{ item }">
						<v-chip
							v-for="tag in item.tags"
							:key="tag"
							x-small
							class="mr-1"
						>
							{{ tag }}
						</v-chip>
					</template>

					<template v-slot:item.urgency="{ item }">
						<v-chip x-small :color="urgencyColor(item.urgency)">
							{{ Number(item.urgency).toFixed(1) }}
						</v-chip>
					</template>

					<template v-slot:item.actions="{ item }">
						<div class="d-flex">
							<v-btn
								v-show="status === 'pending'"
								icon
								x-small
								color="success"
								class="mr-1"
								@click="completeTasks([item])"
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
								@click="restoreTasks([item])"
								title="Restore"
							>
								<v-icon>mdi-restore</v-icon>
							</v-btn>
							<v-btn
								icon
								x-small
								color="primary"
								class="mr-1"
								@click="editTask(item)"
								title="Edit"
							>
								<v-icon>mdi-pencil</v-icon>
							</v-btn>
							<v-btn
								v-show="status !== 'deleted'"
								icon
								x-small
								color="error"
								@click="deleteTasks([item])"
								title="Delete"
							>
								<v-icon>mdi-delete</v-icon>
							</v-btn>
						</div>
					</template>
				</v-data-table>
			</div>
		</div>
	</div>
</template>

<script lang="ts">
import { defineComponent, useStore, computed, reactive, ref, ComputedRef, Ref, inject } from '@nuxtjs/composition-api';
import { Task } from 'taskwarrior-lib';
import _ from 'lodash';
import TaskDialog from '../components/TaskDialog.vue';
import ConfirmationDialog from '../components/ConfirmationDialog.vue';
import ColumnDialog from '../components/ColumnDialog.vue';
import MobileTaskList from '../components/MobileTaskList.vue';
import MobileTaskFilters from '../components/MobileTaskFilters.vue';
import moment from 'moment';
import urlRegex from 'url-regex-safe';
import normalizeUrl from 'normalize-url';
import { accessorType  } from "../store";

function displayDate(str?: string) {
	if (!str)
		return str;

	const date = moment(str);
	const diff = moment.duration(date.diff(moment()));
	if (Math.abs(diff.asDays()) < 1)
		return diff.humanize(true);
	return date.format('YYYY-MM-DD');
}

function urgentDate(str?: string) {
	if (!str)
		return false;

	const date = moment(str);
	const diff = moment.duration(date.diff(moment()));
	const days = diff.asDays();
	if (days > 0 && days < 1)
		return true;

	return false;
}

function expiredDate(str?: string) {
	if (!str)
		return false;

	const date = moment(str);
	return date.isBefore(moment());
}

function futureDate(str?: string) {
	if (!str)
		return false;

	const date = moment(str);
	return date.isAfter(moment());
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
	components: {
		TaskDialog,
		ConfirmationDialog,
		ColumnDialog,
		MobileTaskList,
		MobileTaskFilters
	},
	
	props: {
		tasks: {
			type: Array as () => Task[],
			required: true
		},
		mode: {
			type: String,
			default: 'Tasks'
		},
		project: {
			type: String,
			default: ''
		},
		projectProgress: {
			type: Number,
			default: 0
		},
		activeContext: {
			type: String,
			default: 'none'
		},
		availableContexts: {
			type: Array,
			default: () => []
		},
		allModes: {
			type: Array,
			default: () => ['Tasks', 'Projects']
		},
		projectsList: {
			type: Array,
			default: () => []
		}
	},

	setup(props, { emit }) {
		const store = useStore<typeof accessorType>();
		const selected = ref<Task[]>([]);
		// We don't need selectedStatusIndex anymore as it's handled by the parent

		// Inject task status from parent layout
const taskStatusProvider = inject('taskStatus') as { 
	currentStatus: Ref<string>,
	changeStatus: (status: string) => void 
};

const status = computed(() => taskStatusProvider.currentStatus.value);
		const allStatus = ['pending', 'waiting', 'completed', 'deleted', 'recurring'];
		const statusIcons: { [st: string]: string } = {
			pending: 'mdi-clock-outline',
			waiting: 'mdi-pause',
			completed: 'mdi-check',
			deleted: 'mdi-delete',
			recurring: 'mdi-restart'
		};
		
		const headers = computed(() => [
			{ text: 'Project', value: 'project' },
			{ text: 'Description', value: 'description' },
			{ text: 'Priority', value: 'priority' },
			{ text: 'Scheduled', value: 'scheduled' },
			...(status.value === 'recurring'
				? [{ text: 'Recur', value: 'recur' }]
				: []),
			...(status.value !== 'waiting'
				? [{ text: 'Due', value: 'due' }]
				: [{ text: 'Wait', value: 'wait' }]),
			{ text: 'Until', value: 'until' },
			{ text: 'Tags', value: 'tags' },
			{ text: 'Urgency', value: 'urgency' },
			{ text: 'Actions', value: 'actions', sortable: false }
		]);

		const filteredHeaders = computed(()=>
			headers.value.filter((v)=> !store.state.hiddenColumns.includes(v.value))
		)

		const showColumnDialog = ref(false);

		const tempTasks: { [key: string]: ComputedRef<Task[]> } = {};
		for (const status of allStatus) {
			tempTasks[status] = computed((): Task[] => props.tasks?.filter(task => {
				if (status === "waiting" || status === "pending") {
					const waiting = (task.wait && !expiredDate(task.wait))
						|| (task.scheduled && futureDate(task.scheduled));
					return task.status === "pending" && (status === "pending" ? !waiting : waiting);
				}
				else if (status === "pending") {
					return task.status === "pending" && !(task.wait && !expiredDate(task.wait));
				}
				else {
					return task.status === status;
				}
			}).sort((a: any, b: any) => (b.urgency || 0) - (a.urgency || 0)) || []);
		}
		const classifiedTasks = reactive(tempTasks);
		
		// Task counts for each status (used in mobile view)
		const taskCountMap = computed(() => {
			const counts: Record<string, number> = {};
			allStatus.forEach(st => {
				counts[st] = classifiedTasks[st].value?.length || 0;
			});
			return counts;
		});

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

		const showSyncBtn = computed(() => {
			return store.state.settings.autoSync !== '0';
		});

		const syncTasks = async () => {
			try {
				await store.dispatch('syncTasks');
				store.commit('setNotification', {
					color: 'success',
					text: 'Successfully synced tasks.'
				});
			} catch (error) {
				store.commit('setNotification', {
					color: 'error',
					text: 'Failed to sync tasks.'
				});
			}
		};

		const newTask = () => {
			showTaskDialog.value = true;
			currentTask.value = null;
		};

		const editTask = (task: Task) => {
			showTaskDialog.value = true;
			currentTask.value = _.cloneDeep(task);
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
			confirmation.text = 'Are you sure to delete the task(s)?';
			confirmation.handler = async () => {
				await store.dispatch('deleteTasks', tasks);
				selected.value = selected.value.filter(task => tasks.findIndex(t => t.uuid === task.uuid) === -1);
				store.commit('setNotification', {
					color: 'success',
					text: 'Successfully delete the task(s)'
				});
			};
			showConfirmationDialog.value = true;
		};

		const restoreTasks = (tasks: Task[]) => {
			confirmation.text = 'Are you sure to restore the task(s)?';
			confirmation.handler = async () => {
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
			};
			showConfirmationDialog.value = true;
		};

		const rowClass = (item: Task) => {
			if (item.mask)
				return 'recur-task';
			else if (status.value !== 'completed' && urgentDate(item.due))
				return 'urgent-task';
			else if (status.value !== 'completed' && expiredDate(item.due))
				return 'expired-task';
			return undefined;
		};
		
		// Color helpers
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
		
		// Status change handler
		const changeStatus = (newStatus: string) => {
			taskStatusProvider.changeStatus(newStatus);
			selected.value = [];
			
			// No longer needed as status is controlled by the parent
			
		};
		
		// Status change from chip group
		const changeStatusByIndex = (index: number) => {
			if (index >= 0 && index < allStatus.length) {
				const newStatus = allStatus[index];
				changeStatus(newStatus);
			}
		};
		
		const changeContext = (context: string) => {
			emit('context-change', context);
		};
		
		const changeMode = (mode: string) => {
			emit('mode-change', mode);
		};
		
		const changeProject = (project: string) => {
			emit('project-change', project);
		};
		
		const showConfirmation = (data: { text: string, handler: () => void }) => {
			confirmation.text = data.text;
			confirmation.handler = data.handler;
			showConfirmationDialog.value = true;
		};

		return {
			linkify,
			refresh,
			headers,
			filteredHeaders,
			classifiedTasks,
			status,
			allStatus,
			statusIcons,
			selected,
			
			showSyncBtn,
			syncTasks,
			newTask,
			currentTask,
			editTask,
			deleteTasks,
			completeTasks,
			restoreTasks,
			showTaskDialog,
			showConfirmationDialog,
			showColumnDialog,
			confirmation,
			displayDate,
			rowClass,
			priorityColor,
			urgencyColor,
			changeStatus,
			changeStatusByIndex,
			changeContext,
			changeMode,
			changeProject,
			showConfirmation,
			taskCountMap
		};
	}
});
</script>

<style>
.v-application tr.recur-task {
  background-color: #2196F333;
}

.v-application tr.urgent-task {
  background-color: #F4433633;
}

.v-application tr.expired-task {
  background-color: #79554844;
}

.task-status-tabs {
  border-radius: 4px;
  background-color: rgba(0, 0, 0, 0.02);
}

.task-actions {
  border-radius: 4px;
  background-color: rgba(0, 0, 0, 0.02);
}
</style>