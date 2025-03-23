<template>
	<v-app class="task-app">
		<SettingsDialog v-model="settingsDialog" />

		<v-snackbar
			v-model="snackbar"
			:color="notification.color"
			:timeout="4000"
		>
			{{ notification.text }}

			<template v-slot:action="{ attrs }">
				<v-btn
					dark
					text
					v-bind="attrs"
					@click="snackbar = false"
				>
					Close
				</v-btn>
			</template>
		</v-snackbar>

		<v-app-bar fixed app>
			<v-icon class="mr-2" color="blue">
				mdi-sticker-check-outline
			</v-icon>
			<v-toolbar-title class="mr-4">
				Taskwarrior WebUI
			</v-toolbar-title>

			<!-- Task Status Tabs -->
			<v-chip-group
				v-model="selectedStatusIndex"
				mandatory
				active-class="primary--text"
				class="task-filters mr-4"
				@change="changeStatus"
			>
				<v-chip
					v-for="st in allStatus"
					:key="st"
					:value="allStatus.indexOf(st)"
					:color="currentStatus === st ? 'primary' : undefined"
					outlined
					small
				>
					<v-icon left x-small>{{ statusIcons[st] }}</v-icon>
					{{ st }}
				</v-chip>
			</v-chip-group>

			<v-spacer />
			
			<v-icon class="mr-4" size="28px" @click="toggleTheme" :title="themeTooltip">
				{{ themeIcon }}
			</v-icon>
			<v-icon
				class="mr-2"
				size="28px"
				title="Settings"
				@click="settingsDialog = true"
			>
				mdi-cog
			</v-icon>
		</v-app-bar>

		<v-main>
			<v-container fluid>
				<nuxt />
			</v-container>
		</v-main>
	</v-app>
</template>

<script lang="ts">
import { defineComponent, useContext, useStore, computed, onErrorCaptured, ref, watch, onMounted, onBeforeUnmount, provide } from '@nuxtjs/composition-api';
import SettingsDialog from '../components/SettingsDialog.vue';
import { accessorType  } from "../store";

export default defineComponent({
	setup(_props, ctx) {
		const context = useContext();
		const store = useStore<typeof accessorType>();
		store.dispatch('fetchSettings');
		store.dispatch('fetchHiddenColumns');
		store.dispatch('fetchContexts');

		// System theme media query
		const prefersDarkScheme = ref(
			typeof window !== 'undefined' && window.matchMedia 
			? window.matchMedia('(prefers-color-scheme: dark)').matches 
			: false
		);
		
		let mediaQueryList: MediaQueryList | null = null;
		const handleSystemThemeChange = (e: MediaQueryListEvent) => {
			prefersDarkScheme.value = e.matches;
			updateTheme();
		};
		
		onMounted(() => {
			if (typeof window !== 'undefined' && window.matchMedia) {
				mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');
				mediaQueryList.addEventListener('change', handleSystemThemeChange);
			}
		});
		
		onBeforeUnmount(() => {
			if (mediaQueryList) {
				mediaQueryList.removeEventListener('change', handleSystemThemeChange);
			}
		});

		// Theme handling
		const theme = computed(() => store.state.settings.theme || 'light');
		
		const updateTheme = () => {
			if (theme.value === 'system') {
				context.$vuetify.theme.dark = prefersDarkScheme.value;
			} else {
				context.$vuetify.theme.dark = theme.value === 'dark';
			}
		};
		
		// Initialize theme
		updateTheme();

		// Initialize context if saved in settings
		onMounted(() => {
			// Set context from settings
			const savedContext = store.state.settings.context;
			if (savedContext && savedContext !== 'none') {
				store.dispatch('setContext', savedContext);
			}
		});

		// Watch for theme changes in settings
		watch(() => store.state.settings.theme, updateTheme);
		
		// For backward compatibility
		watch(() => store.state.settings.dark, (newVal) => {
			if (theme.value !== 'system') {
				context.$vuetify.theme.dark = newVal;
			}
		});

		const dark = computed(() => context.$vuetify.theme.dark);
		
		const themeIcon = computed(() => {
			if (theme.value === 'system') {
				return 'mdi-theme-light-dark';
			}
			return dark.value ? 'mdi-brightness-4' : 'mdi-brightness-7';
		});
		
		const themeTooltip = computed(() => {
			if (theme.value === 'system') {
				return 'Using system theme';
			}
			return dark.value ? 'Dark theme' : 'Light theme';
		});
		
		const toggleTheme = () => {
			// Cycle through system -> light -> dark
			const currentTheme = theme.value;
			let newTheme: string;
			
			if (currentTheme === 'system') {
				newTheme = 'light';
			} else if (currentTheme === 'light') {
				newTheme = 'dark';
			} else {
				newTheme = 'system';
			}
			
			// Update the theme in store
			store.dispatch('updateSettings', {
				...store.state.settings,
				theme: newTheme
			});
		};

		// Task status handling
		const currentStatus = ref('pending');
		const selectedStatusIndex = ref(0);
		const allStatus = ['pending', 'waiting', 'completed', 'deleted', 'recurring'];
		const statusIcons = {
			pending: 'mdi-clock-outline',
			waiting: 'mdi-pause',
			completed: 'mdi-check',
			deleted: 'mdi-delete',
			recurring: 'mdi-restart'
		};

		const changeStatus = (index: number) => {
			if (index >= 0 && index < allStatus.length) {
				currentStatus.value = allStatus[index];
			}
		};

		// Provide status to child components
		provide('taskStatus', {
			currentStatus,
			changeStatus: (status: string) => {
				currentStatus.value = status;
				selectedStatusIndex.value = allStatus.indexOf(status);
			}
		});

		const settingsDialog = ref(false);

		const notification = computed(() => store.state.notification);
		const snackbar = computed({
			get: () => store.state.snackbar,
			set: val => store.commit('setSnackbar', val)
		});

		onErrorCaptured((err: any) => {
			// axios error
			let notification: any;
			if (err?.response) {
				const { status, data } = err.response!;
				notification = {
					color: 'error',
					text: `Error ${status}: ${data}`
				};
			}
			else {
				const { name, message } = err as Error;
				notification = {
					color: 'error',
					text: `Error ${name}: ${message}`
				};
			}
			store.commit('setNotification', notification);
			return false;
		});

		return {
			dark,
			snackbar,
			notification,
			settingsDialog,
			themeIcon,
			themeTooltip,
			toggleTheme,
			SettingsDialog,
			// Task status
			currentStatus,
			selectedStatusIndex,
			allStatus,
			statusIcons,
			changeStatus
		};
	}
});
</script>

<style>
.task-filters {
  flex-wrap: wrap;
  overflow: visible;
}

@media (max-width: 600px) {
  .task-filters {
    flex-wrap: nowrap;
    overflow-x: auto;
    width: 100%;
  }
}
</style>