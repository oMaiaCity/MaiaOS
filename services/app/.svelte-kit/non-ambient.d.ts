
// this file is generated — do not edit it


declare module "svelte/elements" {
	export interface HTMLAttributes<T> {
		'data-sveltekit-keepfocus'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-noscroll'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-preload-code'?:
			| true
			| ''
			| 'eager'
			| 'viewport'
			| 'hover'
			| 'tap'
			| 'off'
			| undefined
			| null;
		'data-sveltekit-preload-data'?: true | '' | 'hover' | 'tap' | 'off' | undefined | null;
		'data-sveltekit-reload'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-replacestate'?: true | '' | 'off' | undefined | null;
	}
}

export {};


declare module "$app/types" {
	export interface AppTypes {
		RouteId(): "/" | "/mini-apps" | "/mini-apps/[id]";
		RouteParams(): {
			"/mini-apps/[id]": { id: string }
		};
		LayoutParams(): {
			"/": { id?: string };
			"/mini-apps": { id?: string };
			"/mini-apps/[id]": { id: string }
		};
		Pathname(): "/" | "/mini-apps" | "/mini-apps/" | `/mini-apps/${string}` & {} | `/mini-apps/${string}/` & {};
		ResolvedPathname(): `${"" | `/${string}`}${ReturnType<AppTypes['Pathname']>}`;
		Asset(): "/logo_clean.png" | "/mini-apps/snake/index.html" | "/robots.txt" | string & {};
	}
}