import { ActionTree, MutationTree, GetterTree } from 'vuex';
import { Task } from 'taskwarrior-lib';
import { getAccessorType } from 'typed-vuex';

export const state = () => ({
	tasks: [] as Task[],
	snackbar: false,
	notification: {
		color: '',
		text: ''
	},
	settings: {
		theme: 'system', // 'light', 'dark', 'system'
		dark: false, // keep for backward compatibility
		autoRefresh: '5', // in minutes
		autoSync: '0', // in minutes
		context: 'none' // selected taskwarrior context
	},
	contexts: {
		available: [] as string[],
		active: 'none'
	},
	hiddenColumns: [] as string[]
});

export type RootState = ReturnType<typeof state>;

export const getters: GetterTree<RootState, RootState> = {
	projects: state => state.tasks.map(task => task.project).filter(p => p !== undefined),
	tags: state => state.tasks.reduce((tags: string[], task) => {
		return task.tags ? tags.concat(task.tags) : tags;
	}, [])
};

export const mutations: MutationTree<RootState> = {
	setSettings(state, settings) {
		state.settings = settings;
	},

	setTasks(state, tasks: Task[]) {
		state.tasks = tasks;
	},

	setHiddenColumns(state, hiddenColumns) {
		state.hiddenColumns = hiddenColumns
	},

	setContexts(state, contexts) {
		state.contexts = contexts;
	},

	setActiveContext(state, context) {
		state.contexts.active = context;
	},

	setNotification(state, notification) {
		state.notification = notification;
		// Show notification
		state.snackbar = true;
	},

	setSnackbar(state, value) {
		state.snackbar = value;
	}
};

export const actions: ActionTree<RootState, RootState> = {
	fetchSettings(context) {
		const settings = localStorage.getItem('settings');
		if (settings) {
			const parsedSettings = JSON.parse(settings);
			
			// Handle backward compatibility
			if (parsedSettings.dark !== undefined && parsedSettings.theme === undefined) {
				parsedSettings.theme = parsedSettings.dark ? 'dark' : 'light';
			}
			
			// Initialize context if not present
			if (parsedSettings.context === undefined) {
				parsedSettings.context = 'none';
			}
			
			context.commit('setSettings', parsedSettings);
		}
	},

	updateSettings(context, settings) {
		// Ensure dark property is kept in sync with theme for backward compatibility
		if (settings.theme !== undefined) {
			settings.dark = settings.theme === 'dark';
		}
		
		context.commit('setSettings', settings);
		localStorage.setItem('settings', JSON.stringify(settings));
	},

	fetchHiddenColumns(context) {
		const columns = localStorage.getItem('hiddenColumns');
		if (columns) {
			context.commit('setHiddenColumns', JSON.parse(columns));
		}
	},

	updateHiddenColumns(context, columns) {
		context.commit('setHiddenColumns', columns);
		localStorage.setItem('hiddenColumns', JSON.stringify(columns));
	},

	async fetchContexts(context) {
		try {
			const response = await this.$axios.$get('/api/tasks/contexts');
			context.commit('setContexts', {
				available: response.contexts,
				active: response.active
			});
		} catch (error) {
			console.error('Error fetching contexts:', error);
			context.commit('setNotification', {
				color: 'error',
				text: 'Failed to load Taskwarrior contexts'
			});
		}
	},

	async setContext(context, contextName) {
		try {
			await this.$axios.$post(`/api/tasks/context/${contextName}`);
			context.commit('setActiveContext', contextName);
			
			// Update stored setting
			const settings = { ...context.state.settings, context: contextName };
			context.dispatch('updateSettings', settings);
			
			// Refresh tasks to reflect the new context
			await context.dispatch('fetchTasks');
			
			context.commit('setNotification', {
				color: 'success',
				text: contextName === 'none' 
					? 'Context cleared' 
					: `Context set to: ${contextName}`
			});
		} catch (error) {
			console.error('Error setting context:', error);
			context.commit('setNotification', {
				color: 'error',
				text: 'Failed to set Taskwarrior context'
			});
		}
	},

	async fetchTasks(context) {
		const response = await this.$axios.$get('/api/tasks');
		const { tasks, context: activeContext } = response;
		
		context.commit('setTasks', tasks);
		
		// Update active context if it changed
		if (activeContext && activeContext !== context.state.contexts.active) {
			context.commit('setActiveContext', activeContext);
			// Update settings to match
			const settings = { ...context.state.settings, context: activeContext };
			context.commit('setSettings', settings);
			localStorage.setItem('settings', JSON.stringify(settings));
		}
	},

	async deleteTasks(context, tasks: Task[]) {
		await this.$axios.$delete('/api/tasks', {
			params: { tasks: tasks.map(task => task.uuid) }
		});
		// Refresh
		await context.dispatch('fetchTasks');
	},

	async updateTasks(context, tasks: Task[]) {
		await this.$axios.$put('/api/tasks', { tasks });
		// Refresh
		await context.dispatch('fetchTasks');
	},

	async syncTasks(_context) {
		await this.$axios.$post('/api/sync');
	}
};

export const accessorType = getAccessorType({
	state,
	mutations,
	actions
});
