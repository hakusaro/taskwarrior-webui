import { accessorType } from '~/store';

declare module 'vue/types/vue' {
	interface Vue {
		$accessor: typeof accessorType
	}
}

declare module '@nuxt/types' {
	interface NuxtAppOptions {
		$accessor: typeof accessorType
	}
}

// Add urgency to Task interface from taskwarrior-lib
declare module 'taskwarrior-lib' {
	interface Task {
		urgency: number;
	}
}
