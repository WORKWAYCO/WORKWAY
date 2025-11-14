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

		Logger.success('Successfully logged out');
		Logger.blank();
		Logger.log('💡 Tip: Run `workway login` to log in again');
	} catch (error: any) {
		Logger.error(`Failed to logout: ${error.message}`);
		process.exit(1);
	}
}
