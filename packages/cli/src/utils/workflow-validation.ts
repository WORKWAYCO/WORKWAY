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

import path from 'path';
import fs from 'fs-extra';
import { Logger } from './logger.js';

/**
 * Validates that the current directory is a workflow project
 *
 * DRY: Consolidates workflow.ts existence checks from:
 * - dev.ts
 * - build.ts
 * - test.ts
 * - run.ts
 * - publish.ts
 *
 * @param options Configuration options
 * @returns true if valid, exits process if not
 */
export async function validateWorkflowProject(options: {
	/** Custom hint message for creating the file (default: workflow init hint) */
	createHint?: string;
	/** Whether to exit process on failure (default: true) */
	exitOnFailure?: boolean;
} = {}): Promise<boolean> {
	const workflowPath = path.join(process.cwd(), 'workflow.ts');

	if (await fs.pathExists(workflowPath)) {
		return true;
	}

	Logger.error('No workflow.ts found in current directory');
	Logger.log('');
	Logger.log('💡 Run this command from a workflow project directory');
	Logger.log(options.createHint || '💡 Or create a new workflow with: workway workflow init');

	if (options.exitOnFailure !== false) {
		process.exit(1);
	}

	return false;
}

/**
 * Gets the path to workflow.ts in the current directory
 */
export function getWorkflowPath(): string {
	return path.join(process.cwd(), 'workflow.ts');
}
