<template>
	<div class="px-md-6 px-lg-12 pt-3">
		<TaskList 
			:tasks="tasks" 
			:mode="mode"
			:project="project"
			:project-progress="progress"
			:projects-list="projects"
			:show-project-selector="mode === 'Projects'"
			:active-context="activeContextLabel"
			:available-contexts="availableContexts"
			:all-modes="allModes"
			@context-change="selectedContext = $event"
			@mode-change="mode = $event"
			@project-change="project = $event"
		/>
	</div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, watch, ComputedRef, useStore, useContext, onMounted, onBeforeUnmount } from '@nuxtjs/composition-api';
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
		
		// Listen for display mode changes from app bar
		onMounted(() => {
			console.log('Index.vue mounted, setting up mode change listeners');
			
			// Check if mode is passed in URL
			if (typeof window !== 'undefined') {
				const urlParams = new URLSearchParams(window.location.search);
				const modeParam = urlParams.get('mode');
				if (modeParam && (modeParam === 'Tasks' || modeParam === 'Projects')) {
					console.log('Setting mode from URL parameter:', modeParam);
					mode.value = modeParam;
				}
				
				// Check if mode was set by direct navigation or global variable
				if ((window as any).__forceDisplayMode) {
					console.log('Setting mode from global variable:', (window as any).__forceDisplayMode);
					mode.value = (window as any).__forceDisplayMode;
					delete (window as any).__forceDisplayMode;
				}
				
				// Also set up a periodic check for the global variable
				const modeCheckInterval = setInterval(() => {
					if ((window as any).__currentDisplayMode) {
						console.log('Setting mode from periodic check of global variable:', (window as any).__currentDisplayMode);
						mode.value = (window as any).__currentDisplayMode;
						delete (window as any).__currentDisplayMode;
					}
				}, 200);
				
				// Store the interval for cleanup
				(window as any).__modeCheckInterval = modeCheckInterval;
			}
			
			// Listen for event via $root (traditional Vue event bus)
			if (context.app && context.app.$root) {
				context.app.$root.$on('display-mode-changed', (newMode: string) => {
					console.log('Received mode change via $root:', newMode);
					mode.value = newMode;
				});
			}
			
			// Also listen for window event (fallback method)
			if (typeof window !== 'undefined') {
				const handleModeChange = (event: CustomEvent) => {
					console.log('Received mode change via window event:', event.detail);
					mode.value = event.detail;
				};
				
				window.addEventListener('display-mode-changed', handleModeChange as EventListener);
				
				// Store the handler for cleanup
				(window as any).__modeChangeHandler = handleModeChange;
			}
		});
		
		onBeforeUnmount(() => {
			// Clean up all event listeners
			if (context.app && context.app.$root) {
				context.app.$root.$off('display-mode-changed');
			}
			
			if (typeof window !== 'undefined') {
				// Clear event listener
				if ((window as any).__modeChangeHandler) {
					window.removeEventListener('display-mode-changed', (window as any).__modeChangeHandler as EventListener);
					delete (window as any).__modeChangeHandler;
				}
				
				// Clear interval
				if ((window as any).__modeCheckInterval) {
					clearInterval((window as any).__modeCheckInterval);
					delete (window as any).__modeCheckInterval;
				}
				
				// Clean up any leftover global variables
				delete (window as any).__forceDisplayMode;
				delete (window as any).__currentDisplayMode;
			}
		});

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
			return allProjects.filter((projectName: string) => {
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
		
		// Watch for mode changes and automatically select a project when switching to Projects mode
		watch(mode, (newMode) => {
			console.log('Mode changed to:', newMode);
			if (newMode === 'Projects' && !project.value && projects.value.length > 0) {
				console.log('Auto-selecting first project:', projects.value[0]);
				project.value = projects.value[0];
			}
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