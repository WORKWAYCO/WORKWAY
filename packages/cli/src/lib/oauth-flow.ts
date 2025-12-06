/**
 * Copyright 2024 WORKWAY
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Local OAuth Callback Server
 *
 * Starts a temporary HTTP server to handle OAuth callbacks
 */

import express from 'express';
import type { Server } from 'http';
import open from 'open';
import { Logger } from '../utils/logger.js';

export interface OAuthFlowOptions {
	provider: string;
	authUrl: string;
	callbackPort?: number;
	state?: string;
}

export interface OAuthFlowResult {
	code: string;
	state?: string;
}

/**
 * Local OAuth callback server
 */
export class OAuthCallbackServer {
	private server: Server | null = null;
	private app: express.Application;
	private port: number;

	constructor(port: number = 3456) {
		this.port = port;
		this.app = express();
	}

	/**
	 * Start OAuth flow
	 *
	 * 1. Start local server
	 * 2. Open browser to auth URL
	 * 3. Wait for callback
	 * 4. Return authorization code
	 */
	async startFlow(options: OAuthFlowOptions): Promise<OAuthFlowResult> {
		const { provider, authUrl, state } = options;

		Logger.info(`Starting OAuth flow for ${provider}...`);
		Logger.blank();

		return new Promise((resolve, reject) => {
			let resolved = false;

			// Set up callback route
			this.app.get('/callback', (req, res) => {
				const code = req.query.code as string;
				const returnedState = req.query.state as string;
				const error = req.query.error as string;

				if (error) {
					res.send(this.getErrorPage(provider, error));
					if (!resolved) {
						resolved = true;
						this.stop();
						reject(new Error(`OAuth error: ${error}`));
					}
					return;
				}

				if (!code) {
					res.send(this.getErrorPage(provider, 'No authorization code received'));
					if (!resolved) {
						resolved = true;
						this.stop();
						reject(new Error('No authorization code received'));
					}
					return;
				}

				// Validate state if provided
				if (state && returnedState !== state) {
					res.send(this.getErrorPage(provider, 'Invalid state parameter'));
					if (!resolved) {
						resolved = true;
						this.stop();
						reject(new Error('State mismatch - possible CSRF attack'));
					}
					return;
				}

				// Success!
				res.send(this.getSuccessPage(provider));

				if (!resolved) {
					resolved = true;
					// Give browser time to render page before closing server
					setTimeout(() => {
						this.stop();
						resolve({ code, state: returnedState });
					}, 1000);
				}
			});

			// Health check route
			this.app.get('/health', (req, res) => {
				res.json({ status: 'ok', provider });
			});

			// Start server - SECURITY: bind to localhost only to prevent OAuth hijacking
			// on shared networks. Never bind to 0.0.0.0 for OAuth callbacks.
			this.server = this.app.listen(this.port, '127.0.0.1', () => {
				Logger.success(`Local server started on http://localhost:${this.port}`);
				Logger.info('Opening browser for authorization...');
				Logger.blank();

				// Open browser
				open(authUrl).catch((error) => {
					Logger.warn('Could not open browser automatically');
					Logger.log('');
					Logger.log('Please open this URL manually:');
					Logger.code(authUrl);
					Logger.blank();
				});
			});

			// Handle server errors
			this.server.on('error', (error: any) => {
				if (error.code === 'EADDRINUSE') {
					if (!resolved) {
						resolved = true;
						reject(new Error(`Port ${this.port} is already in use. Please close other applications using this port.`));
					}
				} else {
					if (!resolved) {
						resolved = true;
						reject(error);
					}
				}
			});

			// Timeout after 5 minutes
			setTimeout(() => {
				if (!resolved) {
					resolved = true;
					this.stop();
					reject(new Error('OAuth flow timeout - no response received after 5 minutes'));
				}
			}, 5 * 60 * 1000);
		});
	}

	/**
	 * Stop server
	 */
	stop(): void {
		if (this.server) {
			this.server.close();
			this.server = null;
		}
	}

	/**
	 * Success page HTML
	 */
	private getSuccessPage(provider: string): string {
		return `
<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>OAuth Success - WORKWAY</title>
	<style>
		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
			display: flex;
			align-items: center;
			justify-content: center;
			min-height: 100vh;
			margin: 0;
			background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		}
		.container {
			background: white;
			padding: 48px;
			border-radius: 12px;
			box-shadow: 0 20px 60px rgba(0,0,0,0.3);
			text-align: center;
			max-width: 400px;
		}
		.icon {
			font-size: 64px;
			margin-bottom: 24px;
		}
		h1 {
			color: #2d3748;
			margin: 0 0 16px 0;
			font-size: 28px;
		}
		p {
			color: #718096;
			margin: 0 0 24px 0;
			line-height: 1.6;
		}
		.provider {
			display: inline-block;
			background: #f7fafc;
			padding: 8px 16px;
			border-radius: 6px;
			font-weight: 600;
			color: #4a5568;
			margin-bottom: 24px;
		}
		.note {
			font-size: 14px;
			color: #a0aec0;
		}
	</style>
</head>
<body>
	<div class="container">
		<div class="icon">✅</div>
		<h1>Authorization Successful!</h1>
		<div class="provider">${provider}</div>
		<p>Your ${provider} account has been connected successfully.</p>
		<p class="note">You can close this window and return to the terminal.</p>
	</div>
</body>
</html>
		`;
	}

	/**
	 * Error page HTML
	 */
	private getErrorPage(provider: string, error: string): string {
		return `
<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>OAuth Error - WORKWAY</title>
	<style>
		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
			display: flex;
			align-items: center;
			justify-content: center;
			min-height: 100vh;
			margin: 0;
			background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
		}
		.container {
			background: white;
			padding: 48px;
			border-radius: 12px;
			box-shadow: 0 20px 60px rgba(0,0,0,0.3);
			text-align: center;
			max-width: 400px;
		}
		.icon {
			font-size: 64px;
			margin-bottom: 24px;
		}
		h1 {
			color: #2d3748;
			margin: 0 0 16px 0;
			font-size: 28px;
		}
		p {
			color: #718096;
			margin: 0 0 24px 0;
			line-height: 1.6;
		}
		.error {
			display: inline-block;
			background: #fff5f5;
			padding: 8px 16px;
			border-radius: 6px;
			color: #c53030;
			margin-bottom: 24px;
			font-family: monospace;
		}
		.note {
			font-size: 14px;
			color: #a0aec0;
		}
	</style>
</head>
<body>
	<div class="container">
		<div class="icon">❌</div>
		<h1>Authorization Failed</h1>
		<div class="error">${error}</div>
		<p>Could not connect your ${provider} account.</p>
		<p class="note">Please close this window and try again from the terminal.</p>
	</div>
</body>
</html>
		`;
	}
}

/**
 * Start OAuth flow with local server
 */
export async function startOAuthFlow(options: OAuthFlowOptions): Promise<OAuthFlowResult> {
	const server = new OAuthCallbackServer(options.callbackPort);

	try {
		return await server.startFlow(options);
	} catch (error) {
		server.stop();
		throw error;
	}
}
