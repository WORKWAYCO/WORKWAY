/**
 * R2 Storage Module
 *
 * Cloudflare R2 utilities for object storage, file uploads, and backups.
 * R2 is S3-compatible with zero egress fees.
 *
 * Use cases:
 * - File uploads (user assets, documents)
 * - Database backups (D1 exports)
 * - Large data storage (logs, exports)
 * - Static asset hosting
 *
 * @example
 * ```typescript
 * const storage = new R2Storage(env.STORAGE);
 *
 * // Upload a file
 * await storage.upload('uploads/doc.pdf', fileData, 'application/pdf');
 *
 * // Download
 * const file = await storage.download('uploads/doc.pdf');
 *
 * // List files
 * const files = await storage.list('uploads/');
 * ```
 */

// =============================================================================
// TYPES
// =============================================================================

/**
 * Options for upload operations
 */
export interface UploadOptions {
	/** Content type (MIME type) */
	contentType?: string;
	/** Custom metadata */
	metadata?: Record<string, string>;
	/** Cache control header */
	cacheControl?: string;
	/** Content disposition (inline or attachment) */
	contentDisposition?: string;
}

/**
 * Result from upload operation
 */
export interface UploadResult {
	key: string;
	size: number;
	etag: string;
	uploadedAt: string;
}

/**
 * Options for list operations
 */
export interface ListOptions {
	/** Prefix to filter by */
	prefix?: string;
	/** Maximum number of results */
	limit?: number;
	/** Cursor for pagination */
	cursor?: string;
	/** Delimiter for hierarchy */
	delimiter?: string;
}

/**
 * Result from list operation
 */
export interface ListResult {
	objects: Array<{
		key: string;
		size: number;
		etag: string;
		uploaded: Date;
	}>;
	truncated: boolean;
	cursor?: string;
	delimitedPrefixes?: string[];
}

/**
 * File download result
 */
export interface DownloadResult {
	body: ReadableStream;
	contentType: string;
	size: number;
	etag: string;
	metadata?: Record<string, string>;
}

// =============================================================================
// R2 STORAGE CLASS
// =============================================================================

/**
 * R2 Storage wrapper with typed interface
 */
export class R2Storage {
	constructor(private bucket: R2Bucket) {}

	/**
	 * Upload a file to R2
	 *
	 * @example
	 * ```typescript
	 * // Upload from ArrayBuffer
	 * await storage.upload('files/doc.pdf', arrayBuffer, 'application/pdf');
	 *
	 * // Upload from string
	 * await storage.upload('data/config.json', JSON.stringify(config), 'application/json');
	 *
	 * // Upload with metadata
	 * await storage.upload('uploads/image.jpg', imageData, {
	 *   contentType: 'image/jpeg',
	 *   metadata: { userId: '123', originalName: 'photo.jpg' },
	 * });
	 * ```
	 */
	async upload(
		key: string,
		data: ArrayBuffer | string | ReadableStream | Blob,
		options?: UploadOptions | string
	): Promise<UploadResult> {
		// Handle simple string content type
		const opts: UploadOptions = typeof options === 'string' 
			? { contentType: options }
			: options ?? {};

		const result = await this.bucket.put(key, data, {
			httpMetadata: {
				contentType: opts.contentType ?? 'application/octet-stream',
				cacheControl: opts.cacheControl,
				contentDisposition: opts.contentDisposition,
			},
			customMetadata: opts.metadata,
		});

		return {
			key,
			size: result.size,
			etag: result.etag,
			uploadedAt: result.uploaded.toISOString(),
		};
	}

	/**
	 * Download a file from R2
	 *
	 * @example
	 * ```typescript
	 * const file = await storage.download('files/doc.pdf');
	 * if (file) {
	 *   return new Response(file.body, {
	 *     headers: { 'Content-Type': file.contentType },
	 *   });
	 * }
	 * ```
	 */
	async download(key: string): Promise<DownloadResult | null> {
		const object = await this.bucket.get(key);
		if (!object) return null;

		return {
			body: object.body,
			contentType: object.httpMetadata?.contentType ?? 'application/octet-stream',
			size: object.size,
			etag: object.etag,
			metadata: object.customMetadata,
		};
	}

	/**
	 * Get file metadata without downloading
	 *
	 * @example
	 * ```typescript
	 * const meta = await storage.head('files/doc.pdf');
	 * if (meta) {
	 *   console.log('File size:', meta.size);
	 * }
	 * ```
	 */
	async head(key: string): Promise<Omit<DownloadResult, 'body'> | null> {
		const object = await this.bucket.head(key);
		if (!object) return null;

		return {
			contentType: object.httpMetadata?.contentType ?? 'application/octet-stream',
			size: object.size,
			etag: object.etag,
			metadata: object.customMetadata,
		};
	}

	/**
	 * Delete a file from R2
	 *
	 * @example
	 * ```typescript
	 * await storage.delete('files/doc.pdf');
	 * ```
	 */
	async delete(key: string): Promise<void> {
		await this.bucket.delete(key);
	}

	/**
	 * Delete multiple files from R2
	 *
	 * @example
	 * ```typescript
	 * await storage.deleteMany(['file1.pdf', 'file2.pdf']);
	 * ```
	 */
	async deleteMany(keys: string[]): Promise<void> {
		await this.bucket.delete(keys);
	}

	/**
	 * List files in R2
	 *
	 * @example
	 * ```typescript
	 * // List all files
	 * const files = await storage.list();
	 *
	 * // List with prefix
	 * const uploads = await storage.list({ prefix: 'uploads/' });
	 *
	 * // Paginate
	 * let cursor: string | undefined;
	 * do {
	 *   const result = await storage.list({ cursor, limit: 100 });
	 *   console.log(result.objects);
	 *   cursor = result.cursor;
	 * } while (cursor);
	 * ```
	 */
	async list(options?: ListOptions): Promise<ListResult> {
		const result = await this.bucket.list({
			prefix: options?.prefix,
			limit: options?.limit,
			cursor: options?.cursor,
			delimiter: options?.delimiter,
		});

		return {
			objects: result.objects.map((obj) => ({
				key: obj.key,
				size: obj.size,
				etag: obj.etag,
				uploaded: obj.uploaded,
			})),
			truncated: result.truncated,
			cursor: result.truncated ? result.cursor : undefined,
			delimitedPrefixes: result.delimitedPrefixes,
		};
	}

	/**
	 * Check if a file exists
	 *
	 * @example
	 * ```typescript
	 * if (await storage.exists('config.json')) {
	 *   // File exists
	 * }
	 * ```
	 */
	async exists(key: string): Promise<boolean> {
		const head = await this.bucket.head(key);
		return head !== null;
	}

	/**
	 * Copy a file within R2
	 *
	 * @example
	 * ```typescript
	 * await storage.copy('original.pdf', 'backup/original.pdf');
	 * ```
	 */
	async copy(sourceKey: string, destKey: string): Promise<UploadResult> {
		const source = await this.bucket.get(sourceKey);
		if (!source) {
			throw new Error(`Source file not found: ${sourceKey}`);
		}

		return this.upload(destKey, source.body, {
			contentType: source.httpMetadata?.contentType,
			metadata: source.customMetadata,
		});
	}

	/**
	 * Generate a presigned URL for direct upload/download
	 *
	 * Note: R2 presigned URLs require Workers with specific configuration.
	 * This returns a worker URL that proxies to R2.
	 *
	 * @example
	 * ```typescript
	 * const url = storage.getProxyUrl('files/doc.pdf', 3600);
	 * // Returns: /r2/files/doc.pdf?expires=1234567890
	 * ```
	 */
	getProxyUrl(key: string, expiresInSeconds: number = 3600): string {
		const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
		return `/r2/${key}?expires=${expires}`;
	}
}

// =============================================================================
// D1 BACKUP UTILITIES
// =============================================================================

/**
 * Backup D1 database to R2
 *
 * Note: D1 has built-in Time Travel for point-in-time recovery (30 days).
 * This creates an additional backup marker in R2.
 *
 * @example
 * ```typescript
 * const key = await backupD1ToR2(env.DB, env.BACKUPS, 'production-db');
 * console.log('Backup created:', key);
 * ```
 */
export async function backupD1ToR2(
	_db: D1Database,
	backups: R2Bucket,
	dbName: string
): Promise<string> {
	const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
	const key = `${dbName}/${timestamp}.json`;

	// Create backup marker with metadata
	// Note: Full D1 export requires wrangler CLI or API
	const marker = {
		database: dbName,
		timestamp: new Date().toISOString(),
		type: 'backup-marker',
		note: 'D1 Time Travel available for 30 days. Use wrangler d1 time-travel for restoration.',
		metadata: {
			environment: 'production',
			createdBy: 'r2-storage-module',
		},
	};

	await backups.put(key, JSON.stringify(marker, null, 2), {
		httpMetadata: { contentType: 'application/json' },
		customMetadata: {
			type: 'backup-marker',
			database: dbName,
		},
	});

	return key;
}

/**
 * List D1 backups from R2
 *
 * @example
 * ```typescript
 * const backups = await listD1Backups(env.BACKUPS, 'production-db');
 * console.log('Found', backups.length, 'backups');
 * ```
 */
export async function listD1Backups(
	backups: R2Bucket,
	dbName: string
): Promise<Array<{ key: string; date: Date; size: number }>> {
	const storage = new R2Storage(backups);
	const result = await storage.list({ prefix: `${dbName}/` });

	return result.objects.map((obj) => ({
		key: obj.key,
		date: obj.uploaded,
		size: obj.size,
	}));
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create an R2 storage instance
 *
 * @example
 * ```typescript
 * const storage = createR2Storage(env.FILES);
 * const backups = createR2Storage(env.BACKUPS);
 * ```
 */
export function createR2Storage(bucket: R2Bucket): R2Storage {
	return new R2Storage(bucket);
}

export default {
	R2Storage,
	createR2Storage,
	backupD1ToR2,
	listD1Backups,
};
