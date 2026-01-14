import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export interface PropertyMapping {
	duration?: string;      // Notion property name for number field
	participants?: string;  // Notion property name for multi_select OR rich_text
	participantsType?: 'multi_select' | 'rich_text';  // Type of participants field
	keywords?: string;      // Notion property name for multi_select
	date?: string;          // Notion property name for date
	url?: string;           // Notion property name for URL field (Fireflies URL)
}

// GET: Fetch saved mapping for a database
export const GET: RequestHandler = async ({ url, locals, platform }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	if (!platform?.env) {
		return json({ error: 'Server configuration error' }, { status: 500 });
	}

	const databaseId = url.searchParams.get('databaseId');

	if (!databaseId) {
		return json({ error: 'Database ID is required' }, { status: 400 });
	}

	const { DB } = platform.env;

	try {
		const row = await DB.prepare(
			'SELECT mappings, auto_sync_enabled, last_auto_sync_at FROM property_mappings WHERE user_id = ? AND database_id = ?'
		)
			.bind(locals.user.id, databaseId)
			.first<{ mappings: string; auto_sync_enabled: number; last_auto_sync_at: string | null }>();

		if (!row) {
			return json({ mapping: null, autoSyncEnabled: false });
		}

		return json({ 
			mapping: JSON.parse(row.mappings) as PropertyMapping,
			autoSyncEnabled: row.auto_sync_enabled === 1,
			lastAutoSyncAt: row.last_auto_sync_at
		});
	} catch (error) {
		console.error('Error fetching property mapping:', error);
		return json({ error: 'Failed to fetch property mapping' }, { status: 500 });
	}
};

// POST: Save/update mapping for a database
export const POST: RequestHandler = async ({ request, locals, platform }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	if (!platform?.env) {
		return json({ error: 'Server configuration error' }, { status: 500 });
	}

	const body = await request.json().catch(() => ({}));
	const { databaseId, mapping, autoSyncEnabled } = body as { 
		databaseId?: string; 
		mapping?: PropertyMapping;
		autoSyncEnabled?: boolean;
	};

	if (!databaseId) {
		return json({ error: 'Database ID is required' }, { status: 400 });
	}

	if (!mapping || typeof mapping !== 'object') {
		return json({ error: 'Mapping object is required' }, { status: 400 });
	}

	const { DB } = platform.env;

	try {
		// Check if mapping exists
		const existing = await DB.prepare(
			'SELECT id FROM property_mappings WHERE user_id = ? AND database_id = ?'
		)
			.bind(locals.user.id, databaseId)
			.first();

		const mappingsJson = JSON.stringify(mapping);
		const autoSync = autoSyncEnabled ? 1 : 0;

		if (existing) {
			// Update existing
			await DB.prepare(
				'UPDATE property_mappings SET mappings = ?, auto_sync_enabled = ?, updated_at = datetime("now") WHERE user_id = ? AND database_id = ?'
			)
				.bind(mappingsJson, autoSync, locals.user.id, databaseId)
				.run();
		} else {
			// Create new
			await DB.prepare(
				'INSERT INTO property_mappings (id, user_id, database_id, mappings, auto_sync_enabled) VALUES (?, ?, ?, ?, ?)'
			)
				.bind(crypto.randomUUID(), locals.user.id, databaseId, mappingsJson, autoSync)
				.run();
		}

		return json({ success: true });
	} catch (error) {
		console.error('Error saving property mapping:', error);
		return json({ error: 'Failed to save property mapping' }, { status: 500 });
	}
};
