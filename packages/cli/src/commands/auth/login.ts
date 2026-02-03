/**
 * Login command
 *
 * Authenticates user with WORKWAY platform
 */

import inquirer from 'inquirer';
import { Logger } from '../../utils/logger.js';
import { saveConfig, loadConfig } from '../../lib/config.js';
import { createAPIClient, APIError } from '../../lib/api-client.js';

export async function loginCommand(): Promise<void> {
	Logger.header('Login to WORKWAY');

	try {
		// Prompt for credentials
		const answers = await inquirer.prompt([
			{
				type: 'input',
				name: 'email',
				message: 'Email:',
				validate: (input: string) => {
					if (!input || !input.includes('@')) {
						return 'Please enter a valid email address';
					}
					return true;
				},
			},
			{
				type: 'password',
				name: 'password',
				message: 'Password:',
				mask: '*',
				validate: (input: string) => {
					if (!input || input.length < 6) {
						return 'Password must be at least 6 characters';
					}
					return true;
				},
			},
		]);

		// Load config to get API URL
		const config = await loadConfig();
		const apiClient = createAPIClient(config.apiUrl);

		// Show spinner
		const spinner = Logger.spinner('Authenticating...');

		try {
			// Login
			const authResponse = await apiClient.login(answers.email, answers.password);

			// Save credentials
			await saveConfig({
				...config,
				credentials: {
					token: authResponse.token,
					userId: authResponse.userId,
					email: authResponse.email,
				},
			});

			spinner.succeed('Logged in');
			Logger.blank();
			Logger.log(`  Account: ${authResponse.email}`);
			Logger.log(`  Role: ${authResponse.role}`);
			Logger.blank();
			Logger.log('Run `workway whoami` to see account details');
		} catch (error) {
			spinner.fail('Login failed');

			if (error instanceof APIError) {
				if (error.isUnauthorized()) {
					Logger.error('Invalid email or password');
				} else {
					Logger.error(error.message);
				}
			} else {
				Logger.error('An unexpected error occurred');
			}

			process.exit(1);
		}
	} catch (error: any) {
		if (error.isTtyError) {
			Logger.error('Prompt could not be rendered in the current environment');
		} else {
			Logger.error(error.message);
		}
		process.exit(1);
	}
}
