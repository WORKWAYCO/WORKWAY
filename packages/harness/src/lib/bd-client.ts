/**
 * Beads CLI Client
 *
 * Shared utility for executing bd commands across the harness package.
 * Provides consistent error handling and path resolution.
 *
 * DRY Fix: Consolidated from beads.ts, hook-queue.ts, and molecule.ts
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

/**
 * Find the bd CLI path.
 * Falls back to common locations if not in PATH.
 */
async function findBdPath(): Promise<string> {
	// Try PATH first
	try {
		const { stdout } = await execAsync('which bd');
		return stdout.trim();
	} catch {
		// Fall back to common locations
		const commonPaths = [
			'/opt/homebrew/bin/bd',
			'/usr/local/bin/bd',
			`${process.env.HOME}/.local/bin/bd`,
		];

		for (const path of commonPaths) {
			try {
				await execAsync(`test -x ${path}`);
				return path;
			} catch {
				continue;
			}
		}

		throw new Error('bd CLI not found. Install it or add to PATH.');
	}
}

// Cache the bd path
let bdPath: string | null = null;

/**
 * Execute a bd command and return the result.
 *
 * @param args - Command arguments (string or array)
 * @param cwd - Working directory (defaults to process.cwd())
 * @returns Command output (stdout, trimmed)
 *
 * @example
 * // String args
 * await bd('list --status=open', '/path/to/repo');
 *
 * // Array args
 * await bd(['list', '--status=open'], '/path/to/repo');
 */
export async function bd(args: string | string[], cwd?: string): Promise<string> {
	try {
		// Find bd path on first use
		if (!bdPath) {
			bdPath = await findBdPath();
		}

		// Convert array to string if needed
		const argsString = Array.isArray(args) ? args.join(' ') : args;

		const { stdout } = await execAsync(`${bdPath} ${argsString}`, {
			cwd: cwd || process.cwd(),
			env: { ...process.env },
		});

		return stdout.trim();
	} catch (error) {
		const err = error as { stderr?: string; message: string };
		throw new Error(`bd command failed: ${err.stderr || err.message}`);
	}
}

/**
 * Reset the cached bd path.
 * Useful for testing or when bd is reinstalled.
 */
export function resetBdPath(): void {
	bdPath = null;
}
