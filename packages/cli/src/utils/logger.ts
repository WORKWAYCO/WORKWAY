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
 * Pretty logging utilities for CLI
 */

import chalk from 'chalk';
import ora, { type Ora } from 'ora';

export class Logger {
	/**
	 * Success message (green checkmark)
	 */
	static success(message: string): void {
		console.log(chalk.green('✅'), message);
	}

	/**
	 * Error message (red X)
	 */
	static error(message: string): void {
		console.log(chalk.red('❌'), message);
	}

	/**
	 * Warning message (yellow exclamation)
	 */
	static warn(message: string): void {
		console.log(chalk.yellow('⚠️ '), message);
	}

	/**
	 * Info message (blue info icon)
	 */
	static info(message: string): void {
		console.log(chalk.blue('ℹ️ '), message);
	}

	/**
	 * Debug message (gray)
	 */
	static debug(message: string): void {
		if (process.env.DEBUG) {
			console.log(chalk.gray('🐛'), chalk.gray(message));
		}
	}

	/**
	 * Log without icon
	 */
	static log(message: string): void {
		console.log(message);
	}

	/**
	 * Create a spinner for long-running operations
	 */
	static spinner(text: string): Ora {
		return ora(text).start();
	}

	/**
	 * Print a header
	 */
	static header(text: string): void {
		console.log();
		console.log(chalk.bold.cyan(text));
		console.log(chalk.cyan('='.repeat(text.length)));
		console.log();
	}

	/**
	 * Print a section
	 */
	static section(text: string): void {
		console.log();
		console.log(chalk.bold(text));
		console.log();
	}

	/**
	 * Print a list item
	 */
	static listItem(text: string): void {
		console.log(chalk.gray('  -'), text);
	}

	/**
	 * Print a code block
	 */
	static code(code: string): void {
		console.log();
		console.log(chalk.bgGray.white(` ${code} `));
		console.log();
	}

	/**
	 * Print a blank line
	 */
	static blank(): void {
		console.log();
	}

	/**
	 * Clear the console
	 */
	static clear(): void {
		console.clear();
	}
}
