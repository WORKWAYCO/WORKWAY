/**
 * Storage Module
 *
 * Unified storage API that works with both KV (key-value) and R2 (object storage).
 * Provides a simple interface for workflow developers.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface StorageOptions {
	/** Content type for files */
	contentType?: string;
	/** Custom metadata */
	metadata?: Record<string, string>;
	/** Time to live in seconds (KV only) */
	ttl?: number;
}

export interface ListOptions {
	/** Filter by prefix */
	prefix?: string;
	/** Maximum items to return */
	limit?: number;
	/** Cursor for pagination */
	cursor?: string;
}

export interface ListResult {
	keys: string[];
	cursor?: string;
	complete: boolean;
}

export interface FileMetadata {
	key: string;
	size: number;
	contentType?: string;
	uploaded: Date;
	metadata?: Record<string, string>;
}

// ============================================================================
// KV STORAGE
// ============================================================================

/**
 * Key-Value storage wrapper for Cloudflare KV
 */
export class KVStorage {
	private kv: KVNamespace;
	private prefix: string;

	constructor(kv: KVNamespace, prefix: string = '') {
		this.kv = kv;
		this.prefix = prefix;
	}

	/**
	 * Get a value
	 */
	async get<T = any>(key: string): Promise<T | null> {
		return this.kv.get<T>(this.prefix + key, 'json');
	}

	/**
	 * Get a value as text
	 */
	async getText(key: string): Promise<string | null> {
		return this.kv.get(this.prefix + key, 'text');
	}

	/**
	 * Get a value as ArrayBuffer
	 */
	async getBuffer(key: string): Promise<ArrayBuffer | null> {
		return this.kv.get(this.prefix + key, 'arrayBuffer');
	}

	/**
	 * Set a value
	 */
	async set<T = any>(key: string, value: T, options: StorageOptions = {}): Promise<void> {
		const kvOptions: KVNamespacePutOptions = {};

		if (options.ttl) {
			kvOptions.expirationTtl = options.ttl;
		}
		if (options.metadata) {
			kvOptions.metadata = options.metadata;
		}

		const serialized = typeof value === 'string' ? value : JSON.stringify(value);
		await this.kv.put(this.prefix + key, serialized, kvOptions);
	}

	/**
	 * Delete a value
	 */
	async delete(key: string): Promise<void> {
		await this.kv.delete(this.prefix + key);
	}

	/**
	 * List keys
	 */
	async list(options: ListOptions = {}): Promise<ListResult> {
		const listOptions: KVNamespaceListOptions = {};

		if (options.prefix) {
			listOptions.prefix = this.prefix + options.prefix;
		} else if (this.prefix) {
			listOptions.prefix = this.prefix;
		}

		if (options.limit) {
			listOptions.limit = options.limit;
		}
		if (options.cursor) {
			listOptions.cursor = options.cursor;
		}

		const result = await this.kv.list(listOptions);

		return {
			keys: result.keys.map(k => k.name.replace(this.prefix, '')),
			cursor: result.list_complete ? undefined : result.cursor,
			complete: result.list_complete,
		};
	}

	/**
	 * Check if key exists
	 */
	async has(key: string): Promise<boolean> {
		const value = await this.kv.get(this.prefix + key);
		return value !== null;
	}
}

// ============================================================================
// R2 STORAGE (Object/File Storage)
// ============================================================================

/**
 * Object storage wrapper for Cloudflare R2
 */
export class ObjectStorage {
	private bucket: R2Bucket;
	private prefix: string;

	constructor(bucket: R2Bucket, prefix: string = '') {
		this.bucket = bucket;
		this.prefix = prefix;
	}

	/**
	 * Upload a file
	 */
	async uploadFile(
		key: string,
		data: ArrayBuffer | Uint8Array | string | ReadableStream,
		options: StorageOptions = {}
	): Promise<void> {
		const r2Options: R2PutOptions = {};

		if (options.contentType) {
			r2Options.httpMetadata = { contentType: options.contentType };
		}
		if (options.metadata) {
			r2Options.customMetadata = options.metadata;
		}

		await this.bucket.put(this.prefix + key, data, r2Options);
	}

	/**
	 * Download a file as ArrayBuffer
	 */
	async downloadFile(key: string): Promise<ArrayBuffer | null> {
		const object = await this.bucket.get(this.prefix + key);
		if (!object) return null;
		return object.arrayBuffer();
	}

	/**
	 * Download a file as text
	 */
	async downloadText(key: string): Promise<string | null> {
		const object = await this.bucket.get(this.prefix + key);
		if (!object) return null;
		return object.text();
	}

	/**
	 * Download a file as stream
	 */
	async downloadStream(key: string): Promise<ReadableStream | null> {
		const object = await this.bucket.get(this.prefix + key);
		if (!object) return null;
		return object.body;
	}

	/**
	 * Get file metadata
	 */
	async getMetadata(key: string): Promise<FileMetadata | null> {
		const object = await this.bucket.head(this.prefix + key);
		if (!object) return null;

		return {
			key: key,
			size: object.size,
			contentType: object.httpMetadata?.contentType,
			uploaded: object.uploaded,
			metadata: object.customMetadata,
		};
	}

	/**
	 * Delete a file
	 */
	async deleteFile(key: string): Promise<void> {
		await this.bucket.delete(this.prefix + key);
	}

	/**
	 * Delete multiple files
	 */
	async deleteFiles(keys: string[]): Promise<void> {
		const fullKeys = keys.map(k => this.prefix + k);
		await this.bucket.delete(fullKeys);
	}

	/**
	 * List files
	 */
	async list(options: ListOptions = {}): Promise<ListResult> {
		const listOptions: R2ListOptions = {};

		if (options.prefix) {
			listOptions.prefix = this.prefix + options.prefix;
		} else if (this.prefix) {
			listOptions.prefix = this.prefix;
		}

		if (options.limit) {
			listOptions.limit = options.limit;
		}
		if (options.cursor) {
			listOptions.cursor = options.cursor;
		}

		const result = await this.bucket.list(listOptions);

		return {
			keys: result.objects.map(o => o.key.replace(this.prefix, '')),
			cursor: result.truncated ? result.cursor : undefined,
			complete: !result.truncated,
		};
	}

	/**
	 * Check if file exists
	 */
	async has(key: string): Promise<boolean> {
		const object = await this.bucket.head(this.prefix + key);
		return object !== null;
	}

	/**
	 * Copy a file
	 */
	async copy(sourceKey: string, destKey: string): Promise<void> {
		const source = await this.bucket.get(this.prefix + sourceKey);
		if (!source) {
			throw new Error(`Source file not found: ${sourceKey}`);
		}

		await this.bucket.put(this.prefix + destKey, source.body, {
			httpMetadata: source.httpMetadata,
			customMetadata: source.customMetadata,
		});
	}
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a KV storage instance
 */
export function createKVStorage(kv: KVNamespace, prefix: string = ''): KVStorage {
	return new KVStorage(kv, prefix);
}

/**
 * Create an object storage instance
 */
export function createObjectStorage(bucket: R2Bucket, prefix: string = ''): ObjectStorage {
	return new ObjectStorage(bucket, prefix);
}

// Convenience alias
export const storage = {
	KVStorage,
	ObjectStorage,
	createKVStorage,
	createObjectStorage,
};

export default storage;
