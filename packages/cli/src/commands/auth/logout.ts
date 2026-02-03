/**
 * Logout command
 *
 * Clear local authentication
 */

import { Logger } from '../../utils/logger.js';
import { clearConfig } from '../../lib/config.js';

export async function logoutCommand(): Promise<void> {
	try {
		// Clear credentials
		await clearConfig();

		Logger.success('Logged out');
		Logger.blank();
		Logger.log('Run `workway login` to sign in again');
	} catch (error: any) {
		Logger.error(`Logout failed: ${error.message}`);
		process.exit(1);
	}
}
