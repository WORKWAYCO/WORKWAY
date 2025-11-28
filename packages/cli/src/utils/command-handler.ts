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
 * Command handler utilities for consistent error handling
 *
 * DRY: Unifies 20+ identical try-catch blocks into a single utility
 */

import { Logger } from './logger.js';
import { APIError } from '../lib/api-client.js';

/**
 * Wraps a command function with consistent error handling
 *
 * Usage:
 *   .action(handleCommand(async () => { ... }))
 *   .action(handleCommand(async (options) => { ... }))
 */
export function handleCommand<T extends (...args: any[]) => Promise<void>>(
	commandFn: T
): (...args: Parameters<T>) => Promise<void> {
	return async (...args: Parameters<T>): Promise<void> => {
		try {
			await commandFn(...args);
		} catch (error: unknown) {
			handleCommandError(error);
		}
	};
}

/**
 * Centralized error handler for CLI commands
 *
 * Handles:
 * - APIError with unauthorized detection
 * - Generic errors with message extraction
 * - Debug stack traces when DEBUG=true
 */
export function handleCommandError(error: unknown): never {
	if (error instanceof APIError) {
		Logger.error(error.message);

		if (error.isUnauthorized()) {
			Logger.blank();
			Logger.log('Please log in first:');
			Logger.code('workway login');
		}
	} else if (error instanceof Error) {
		Logger.error(error.message);

		if (process.env.DEBUG && error.stack) {
			Logger.debug(error.stack);
		}
	} else {
		Logger.error(String(error));
	}

	process.exit(1);
}
