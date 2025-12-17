/**
 * learn_authenticate Tool
 *
 * Authenticate with the Identity Worker using magic link or password.
 */

import {
	isAuthenticated,
	getCurrentUser,
	requestMagicLink,
	loginWithPassword,
	validateMagicLinkToken
} from '../../api/auth.js';
import type { AuthResult } from '../../types/index.js';

export const definition = {
	name: 'learn_authenticate',
	description: 'Authenticate with WORKWAY Learn using magic link or email/password',
	inputSchema: {
		type: 'object' as const,
		properties: {
			method: {
				type: 'string',
				enum: ['check', 'magic_link', 'password', 'token'],
				description:
					'Authentication method: check (check current status), magic_link (send link), password (login), token (verify magic link)'
			},
			email: {
				type: 'string',
				description: 'Email address for authentication'
			},
			password: {
				type: 'string',
				description: 'Password (for password method only)'
			},
			token: {
				type: 'string',
				description: 'Magic link token (for token method only)'
			}
		},
		required: []
	}
};

export interface LearnAuthenticateInput {
	method?: 'check' | 'magic_link' | 'password' | 'token';
	email?: string;
	password?: string;
	token?: string;
}

export async function handler(input: LearnAuthenticateInput): Promise<AuthResult> {
	const method = input.method || 'check';

	switch (method) {
		case 'check': {
			const authenticated = isAuthenticated();
			const user = getCurrentUser();

			if (authenticated && user) {
				return {
					authenticated: true,
					user,
					message: `Authenticated as ${user.email}`,
					nextSteps: [
						'Use learn_status to see your progress',
						'Use learn_lesson to start a lesson'
					]
				};
			}

			return {
				authenticated: false,
				message: 'Not authenticated',
				nextSteps: [
					'Use learn_authenticate with method: "magic_link" and your email',
					'Or use method: "password" with email and password'
				]
			};
		}

		case 'magic_link': {
			if (!input.email) {
				return {
					authenticated: false,
					message: 'Email is required for magic link authentication'
				};
			}

			const result = await requestMagicLink(input.email);

			return {
				authenticated: false,
				message: result.message,
				nextSteps: result.success
					? [
							'Check your email for the magic link',
							'Click the link or use learn_authenticate with method: "token" and the token from the URL'
						]
					: ['Try again with a valid email address']
			};
		}

		case 'password': {
			if (!input.email || !input.password) {
				return {
					authenticated: false,
					message: 'Email and password are required'
				};
			}

			return await loginWithPassword(input.email, input.password);
		}

		case 'token': {
			if (!input.token) {
				return {
					authenticated: false,
					message: 'Token is required for verification'
				};
			}

			return await validateMagicLinkToken(input.token);
		}

		default:
			return {
				authenticated: false,
				message: `Unknown method: ${method}`
			};
	}
}
