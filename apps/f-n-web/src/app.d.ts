/// <reference types="@sveltejs/kit" />
/// <reference types="@cloudflare/workers-types" />

declare global {
	namespace App {
		interface Error {
			message: string;
			code?: string;
		}
		interface Locals {
			user: {
				id: string;
				email: string;
			} | null;
		}
		interface PageData {}
		interface PageState {}
		interface Platform {
			env: {
				DB: D1Database;
				SESSIONS: KVNamespace;
				CACHE: KVNamespace;
				NOTION_CLIENT_ID?: string;
				NOTION_CLIENT_SECRET?: string;
				YOUTUBE_CLIENT_ID?: string;
				YOUTUBE_CLIENT_SECRET?: string;
				SITE_URL?: string;
			};
			context: ExecutionContext;
			caches: CacheStorage;
		}
	}
}

export {};
