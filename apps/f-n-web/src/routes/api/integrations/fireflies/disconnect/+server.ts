import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, platform }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	if (!platform?.env) {
		return json({ error: 'Server configuration error' }, { status: 500 });
	}

	const { DB } = platform.env;

	await DB.prepare('DELETE FROM connected_accounts WHERE user_id = ? AND provider = ?')
		.bind(locals.user.id, 'fireflies')
		.run();

	return json({ success: true });
};
