<template>
	<v-dialog
		v-model="showDialog"
		max-width="400px"
		@keydown.esc="closeDialog"
	>
		<v-card>
			<v-card-title>
				Settings
			</v-card-title>
			<v-card-text>
				<v-form ref="formRef">
					<v-list-item>
						<v-list-item-content>
							<v-list-item-title>
								Theme
							</v-list-item-title>
							<v-list-item-subtitle>
								appearance setting
							</v-list-item-subtitle>
						</v-list-item-content>
						<v-list-item-action>
							<v-select
								v-model="settings.theme"
								:items="themeOptions"
								item-text="text"
								item-value="value"
								style="width: 120px"
								hide-details
								dense
							/>
						</v-list-item-action>
					</v-list-item>

					<v-list-item>
						<v-list-item-content>
							<v-list-item-title>
								Auto Refresh
							</v-list-item-title>
							<v-list-item-subtitle>
								in minutes (0 means no refresh)
							</v-list-item-subtitle>
						</v-list-item-content>
						<v-list-item-action>
							<v-text-field
								v-model="settings.autoRefresh"
								style="width: 40px"
								:rules="numberRules"
							/>
						</v-list-item-action>
					</v-list-item>

					<v-list-item>
						<v-list-item-content>
							<v-list-item-title class="pb-1">
								Auto Sync
								<v-icon size="18px" class="ml-2" @click="sync" title="Sync immediately">
									mdi-sync
								</v-icon>
							</v-list-item-title>
							<v-list-item-subtitle>
								in minutes (0 means no auto sync)<br />
								run <code>task sync</code> periodically
							</v-list-item-subtitle>
						</v-list-item-content>
						<v-list-item-action>
							<v-text-field
								v-model="settings.autoSync"
								style="width: 40px"
								:rules="numberRules"
							/>
						</v-list-item-action>
					</v-list-item>

					<v-list-item>
						<v-list-item-content>
							<v-list-item-title>
								Default Context
							</v-list-item-title>
							<v-list-item-subtitle>
								taskwarrior context filter
							</v-list-item-subtitle>
						</v-list-item-content>
						<v-list-item-action>
							<v-select
								v-model="settings.context"
								:items="contextOptions"
								item-text="text"
								item-value="value"
								style="width: 120px"
								hide-details
								dense
							/>
						</v-list-item-action>
					</v-list-item>
				</v-form>
			</v-card-text>
			<v-card-actions>
				<v-spacer />
				<v-btn text @click="closeDialog">
					Cancel
				</v-btn>
				<v-btn @click="reset">
					Reset
				</v-btn>
				<v-btn color="primary" @click="save">
					Save
				</v-btn>
			</v-card-actions>
		</v-card>
	</v-dialog>
</template>

<script lang="ts">
import { watch, defineComponent, useStore, computed, ref, reactive } from '@nuxtjs/composition-api';
import { accessorType  } from "../store";

export default defineComponent({
	props: {
		value: Boolean,
	},

	setup(props, ctx) {
		const store = useStore<typeof accessorType>();

		const showDialog = computed({
			get: () => props.value,
			set: val => ctx.emit('input', val)
		});

		const numberRules = [
			(str: string) => (str && !isNaN(+str) && +str >= 0) || 'invalid'
		];

		const themeOptions = [
			{ text: 'Light', value: 'light' },
			{ text: 'Dark', value: 'dark' },
			{ text: 'System', value: 'system' }
		];
		
		const contextOptions = computed(() => {
			return store.state.contexts.available.map(ctx => ({
				text: ctx === 'none' ? 'No Context' : ctx,
				value: ctx
			}));
		});

		// Fetch contexts when dialog opens
		watch(showDialog, (isOpen) => {
			if (isOpen) {
				store.dispatch('fetchContexts');
			}
		});

		const formRef = ref(null);
		const settings = reactive({
			theme: store.state.settings.theme || 'system',
			autoRefresh: store.state.settings.autoRefresh,
			autoSync: store.state.settings.autoSync,
			context: store.state.settings.context || 'none'
		});

		const reset = () => {
			settings.theme = store.state.settings.theme || 'system';
			settings.autoRefresh = store.state.settings.autoRefresh;
			settings.autoSync = store.state.settings.autoSync;
			settings.context = store.state.settings.context || 'none';
		};

		const closeDialog = () => {
			showDialog.value = false;
			reset();
		};

		const save = () => {
			const valid = (formRef as any).value.validate();
			if (valid) {
				store.dispatch('updateSettings', {
					...settings
				});
				
				// Update the context if it has changed
				if (settings.context !== store.state.contexts.active) {
					store.dispatch('setContext', settings.context);
				}
				
				closeDialog();
			}
		};

		const sync = async () => {
			await store.dispatch('syncTasks');
		};

		return {
			sync,
			showDialog,
			closeDialog,
			save,
			reset,
			settings,
			numberRules,
			formRef,
			themeOptions,
			contextOptions
		};
	}
});
</script>