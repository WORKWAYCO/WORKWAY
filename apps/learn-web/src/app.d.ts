/// <reference types="@sveltejs/kit" />
/// <reference types="@cloudflare/workers-types" />

declare global {
  namespace App {
    interface Locals {
      user?: {
        id: string;
        email: string;
        displayName?: string;
      };
    }

    interface Platform {
      env: {
        DB: D1Database;
        SESSIONS: KVNamespace;
        IDENTITY_WORKER_URL: string;
        WORKWAY_MARKETPLACE_URL: string;
      };
      context: ExecutionContext;
      caches: CacheStorage;
    }
  }
}

export {};
