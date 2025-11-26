/**
 * Developer Register Command
 *
 * Register as a workflow developer on the WORKWAY platform
 */

import inquirer from 'inquirer';
import { Logger } from '../../utils/logger.js';
import { loadConfig, saveConfig, isAuthenticated } from '../../lib/config.js';
import { createAPIClient } from '../../lib/api-client.js';

export async function developerRegisterCommand(): Promise<void> {
	try {
		Logger.header('Developer Registration');

		// Check if already authenticated
		if (!(await isAuthenticated())) {
			Logger.warn('You need to be logged in first');
			Logger.log('');
			Logger.log('💡 Login with: workway login');
			Logger.log('💡 Or register with: workway login --register');
			process.exit(1);
		}

		const config = await loadConfig();
		const client = createAPIClient(config.apiUrl, config.credentials?.token);

		// Check if already a developer
		const spinner1 = Logger.spinner('Checking developer status...');
		try {
			const profile = await client.getDeveloperProfile();
			spinner1.succeed('Already registered as developer');
			Logger.blank();
			Logger.log(`Company: ${profile.companyName || 'Not set'}`);
			Logger.log('');
			Logger.log('💡 View your profile with: workway developer profile');
			return;
		} catch (error: any) {
			// Not a developer yet, continue with registration
			spinner1.succeed('Ready to register');
		}

		Logger.blank();
		Logger.log('Register as a WORKWAY developer to publish workflows.');
		Logger.blank();

		// Gather developer info
		const answers = await inquirer.prompt([
			{
				type: 'input',
				name: 'companyName',
				message: 'Company or developer name:',
				validate: (input: string) => input.length > 0 || 'Name is required',
			},
			{
				type: 'input',
				name: 'bio',
				message: 'Short bio (optional):',
			},
			{
				type: 'input',
				name: 'websiteUrl',
				message: 'Website URL (optional):',
				validate: (input: string) => {
					if (!input) return true;
					try {
						new URL(input);
						return true;
					} catch {
						return 'Please enter a valid URL';
					}
				},
			},
			{
				type: 'confirm',
				name: 'confirm',
				message: 'Register as a WORKWAY developer?',
				default: true,
			},
		]);

		if (!answers.confirm) {
			Logger.log('Registration cancelled');
			return;
		}

		const spinner2 = Logger.spinner('Registering developer account...');

		try {
			const result = await client.register({
				email: config.credentials?.email || '',
				password: '', // Already authenticated, this is just upgrading role
				companyName: answers.companyName,
				bio: answers.bio || undefined,
				websiteUrl: answers.websiteUrl || undefined,
			});

			spinner2.succeed('Developer account created!');
			Logger.blank();

			Logger.section('Next Steps');
			Logger.log('  1. Create your first workflow: workway workflow init');
			Logger.log('  2. Develop and test: workway workflow dev');
			Logger.log('  3. Publish to marketplace: workway workflow publish');
			Logger.blank();

			Logger.log('💡 Set up Stripe to receive payments: workway developer earnings --setup');

		} catch (error: any) {
			spinner2.fail('Registration failed');
			Logger.error(error.message);
			process.exit(1);
		}

	} catch (error: any) {
		Logger.error(error.message);
		process.exit(1);
	}
}
