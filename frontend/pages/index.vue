<template>
	<div class="px-md-6 px-lg-12">
		<!-- Modern controls for all views -->
		<div class="desktop-filters" :class="{'py-4': !$vuetify.breakpoint.xs, 'py-2': $vuetify.breakpoint.xs}">
			<!-- Title and Info -->
			<div class="d-flex align-center mb-2">
				<h2 class="headline mb-0 d-flex align-center">
					<v-icon class="mr-2" color="primary">
						{{ mode === 'Tasks' ? 'mdi-format-list-checks' : 'mdi-folder-multiple' }}
					</v-icon>
					{{ mode }}
				</h2>
				
				<!-- Project Progress (when in project mode) -->
				<template v-if="mode === 'Projects' && project">
					<v-icon class="mx-2 grey--text">mdi-chevron-right</v-icon>
					<v-chip color="primary" class="px-2">
						{{ project }}
						<v-progress-circular
							:size="20"
							:width="3"
							:value="progress"
							color="white"
							class="ml-1"
						>
							{{ progress }}%
						</v-progress-circular>
					</v-chip>
				</template>
				
				<!-- Context indicator -->
				<v-chip
					v-if="activeContextLabel && selectedContext !== 'none'"
					class="ml-3"
					color="primary"
					small
				>
					<v-icon x-small left>mdi-filter</v-icon>
					Filtered: {{ activeContextLabel }}
				</v-chip>
			</div>

			<!-- Filter Controls -->
			<div class="d-flex flex-wrap align-center">
				<!-- Context Selection -->
				<v-menu offset-y>
					<template v-slot:activator="{ on, attrs }">
						<v-btn
							class="mr-2 mb-2"
							outlined
							small
							v-bind="attrs"
							v-on="on"
						>
							<v-icon left small>mdi-filter-variant</v-icon>
							Context: {{ selectedContext === 'none' ? 'None' : selectedContext }}
						</v-btn>
					</template>
					<v-list dense>
						<v-list-item
							v-for="ctx in availableContexts"
							:key="ctx.value"
							@click="selectedContext = ctx.value"
						>
							<v-list-item-title>
								{{ ctx.text }}
								<v-icon v-if="ctx.value === selectedContext" small color="primary" class="ml-2">
									mdi-check
								</v-icon>
							</v-list-item-title>
						</v-list-item>
					</v-list>
				</v-menu>

				<!-- Mode Selection -->
				<v-menu offset-y>
					<template v-slot:activator="{ on, attrs }">
						<v-btn
							class="mr-2 mb-2"
							outlined
							small
							v-bind="attrs"
							v-on="on"
						>
							<v-icon left small>mdi-view-module</v-icon>
							Display: {{ mode }}
						</v-btn>
					</template>
					<v-list dense>
						<v-list-item
							v-for="m in allModes"
							:key="m"
							@click="mode = m"
						>
							<v-list-item-title>
								{{ m }}
								<v-icon v-if="m === mode" small color="primary" class="ml-2">
									mdi-check
								</v-icon>
							</v-list-item-title>
						</v-list-item>
					</v-list>
				</v-menu>

				<!-- Project Selection (when in Projects mode) -->
				<v-menu offset-y v-if="mode === 'Projects' && projects.length > 0">
					<template v-slot:activator="{ on, attrs }">
						<v-btn
							class="mr-2 mb-2"
							outlined
							small
							v-bind="attrs"
							v-on="on"
						>
							<v-icon left small>mdi-folder</v-icon>
							{{ project ? 'Project: ' + project : 'Select Project' }}
						</v-btn>
					</template>
					<v-list dense>
						<v-list-item
							v-for="proj in projects"
							:key="proj"
							@click="project = proj"
						>
							<v-list-item-title>
								{{ proj }}
								<v-icon v-if="proj === project" small color="primary" class="ml-2">
									mdi-check
								</v-icon>
							</v-list-item-title>
						</v-list-item>
					</v-list>
				</v-menu>
			</div>
		</div>

		<TaskList 
			:tasks="tasks" 
			:mode="mode"
			:project="project"
			:project-progress="progress"
			:active-context="activeContextLabel"
			:available-contexts="availableContexts"
			:all-modes="allModes"
			:projects-list="projects"
			@context-change="selectedContext = $event"
			@mode-change="mode = $event"
			@project-change="project = $event"
		/>
	</div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, watch, ComputedRef, useStore, useContext } from '@nuxtjs/composition-api';
import TaskList from '../components/TaskList.vue';
import { Task } from 'taskwarrior-lib';
import { accessorType  } from "../store";

export default defineComponent({
	setup() {
		const store = useStore<typeof accessorType>();
		const context = useContext();
		
		// Initialize
		store.dispatch('fetchTasks');
		store.dispatch('fetchContexts');

		// Auto Refresh
		let refreshInterval: NodeJS.Timeout | null = null;
		const setAutoRefresh = () => {
			if (refreshInterval)
				clearInterval(refreshInterval);
			const freq = +store.state.settings.autoRefresh;
			if (freq > 0) {
				refreshInterval = setInterval(() => {
					store.dispatch('fetchTasks');
				}, +store.state.settings.autoRefresh * 60000);
			}
		};
		setAutoRefresh();

		// Auto Sync
		let syncInterval: NodeJS.Timeout | null = null;
		const setAutoSync = () => {
			if (syncInterval)
				clearInterval(syncInterval);
			const freq = +store.state.settings.autoSync;
			if (freq > 0) {
				syncInterval = setInterval(() => {
					store.dispatch('syncTasks');
				}, +store.state.settings.autoSync * 60000);
			}
		};
		setAutoSync();

		// Update settings
		watch(() => store.state.settings, () => {
			setAutoSync();
			setAutoRefresh();
			// Theme is handled by the default layout
		});
		
		// Context handling
		const availableContexts = computed(() => {
			return store.state.contexts.available.map(ctx => ({
				text: ctx === 'none' ? 'No Context' : ctx,
				value: ctx
			}));
		});
		
		const selectedContext = computed({
			get: () => store.state.settings.context || 'none',
			set: (value: string) => {
				store.dispatch('setContext', value);
			}
		});
		
		const activeContextLabel = computed(() => {
			const context = store.state.contexts.active;
			return context && context !== 'none' ? context : '';
		});

		const mode = ref('Tasks');
		const allModes = ['Tasks', 'Projects'];

		const project = ref('');
		
		// Get projects and filter out those with 100% completion or zero tasks in context
		const projects: ComputedRef<string[]> = computed(() => {
			// Get all projects from tasks that are visible in the current context
			// (store.state.tasks already contains only tasks for the current context)
			const allProjects = store.getters.projects;
			
			// Filter out projects with 100% completion or no tasks in current context
			return allProjects.filter(projectName => {
				// Get all tasks for this project (already filtered for current context)
				const projectTasks = store.state.tasks.filter(
					(task: Task) => task.project === projectName
				);
				
				// Skip projects with no tasks in the current context
				if (projectTasks.length === 0) return false;
				
				// Count pending tasks
				const pendingTasks = projectTasks.filter(
					(task: Task) => task.status === 'pending'
				);
				
				// Keep project if it has at least one pending task
				return pendingTasks.length > 0;
			});
		});
		
		watch(projects, () => {
			if (projects.value.includes(project.value))
				return;
			if (projects.value.length)
				project.value = projects.value[0];
			else
				project.value = '';
		});

		const tasks: ComputedRef<Task[]> = computed(() => {
			if (mode.value === 'Tasks')
				return store.state.tasks;

			if (project.value)
				return store.state.tasks.filter(
					(task: Task) => task.project === project.value
				);

			return [];
		});

		const progress = computed(() => {
			if (mode.value === 'Projects' && project.value) {
				const completed = tasks.value.reduce((acc: number, task) => task.status === 'completed' ? acc + 1 : acc, 0);
				const pending = tasks.value.reduce((acc: number, task) => task.status === 'pending' ? acc + 1 : acc, 0);
				return completed + pending === 0
					? 100
					: Math.ceil(100 * completed / (completed + pending));
			}
			return 0;
		});

		return {
			mode,
			allModes,
			TaskList,
			tasks,
			projects,
			project,
			progress,
			availableContexts,
			selectedContext,
			activeContextLabel
		};
	}
});
</script>