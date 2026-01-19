/**
 * WORKWAY RLM Bridge
 *
 * Bridge between TypeScript/Node.js and Python RLM implementation.
 * Spawns Python subprocess and communicates via JSON.
 */

import { spawn } from 'child_process';
import type { RLMConfig, RLMResult } from './types';

/**
 * Run an RLM session via Python bridge
 *
 * @param context - The context to analyze (string or list of strings)
 * @param query - The question to answer about the context
 * @param config - RLM configuration options
 * @returns Promise resolving to RLMResult
 */
export async function runRLM(
	context: string | string[],
	query: string,
	config?: RLMConfig,
): Promise<RLMResult> {
	return new Promise((resolve, reject) => {
		// Prepare the command to run Python
		const pythonScript = `
import json
import sys
import asyncio
from workway_rlm import RLMSession, RLMConfig
from workway_rlm.providers import ClaudeProvider

async def main():
    # Read input from stdin
    input_data = json.loads(sys.stdin.read())

    # Extract parameters
    context = input_data['context']
    query = input_data['query']
    config_data = input_data.get('config', {})

    # Create RLM config
    config = RLMConfig(
        root_model=config_data.get('rootModel', 'sonnet'),
        sub_model=config_data.get('subModel', 'haiku'),
        max_iterations=config_data.get('maxIterations', 20),
        max_sub_calls=config_data.get('maxSubCalls', 100),
        max_output_chars=config_data.get('maxOutputChars', 50000),
        track_costs=config_data.get('trackCosts', True),
    )

    # Create provider
    provider = ClaudeProvider()

    # Create session
    session = RLMSession(
        context=context,
        provider=provider,
        config=config,
    )

    # Run query
    result = await session.run(query)

    # Convert result to dict
    output = {
        'success': result.success,
        'answer': result.answer,
        'iterations': result.iterations,
        'subCalls': result.sub_calls,
        'totalInputTokens': result.total_input_tokens,
        'totalOutputTokens': result.total_output_tokens,
        'costUsd': result.cost_usd,
        'trajectory': result.trajectory,
        'error': result.error,
    }

    # Write result to stdout
    print(json.dumps(output))

if __name__ == '__main__':
    asyncio.run(main())
`;

		// Spawn Python process
		const python = spawn('python', ['-c', pythonScript], {
			stdio: ['pipe', 'pipe', 'pipe'],
		});

		let stdout = '';
		let stderr = '';

		// Collect stdout
		python.stdout.on('data', (data) => {
			stdout += data.toString();
		});

		// Collect stderr
		python.stderr.on('data', (data) => {
			stderr += data.toString();
		});

		// Handle process completion
		python.on('close', (code) => {
			if (code !== 0) {
				reject(
					new Error(`Python process exited with code ${code}\nstderr: ${stderr}`),
				);
				return;
			}

			try {
				// Parse JSON result from stdout
				const result: RLMResult = JSON.parse(stdout);
				resolve(result);
			} catch (error) {
				reject(
					new Error(
						`Failed to parse Python output: ${error}\nstdout: ${stdout}\nstderr: ${stderr}`,
					),
				);
			}
		});

		// Handle process errors
		python.on('error', (error) => {
			reject(new Error(`Failed to spawn Python process: ${error.message}`));
		});

		// Send input data to Python via stdin
		const inputData = {
			context,
			query,
			config: config || {},
		};

		python.stdin.write(JSON.stringify(inputData));
		python.stdin.end();
	});
}

/**
 * Check if Python and workway_rlm are available
 *
 * @returns Promise<boolean> - True if Python + RLM are available
 */
export async function checkPythonRLM(): Promise<boolean> {
	return new Promise((resolve) => {
		const python = spawn('python', [
			'-c',
			'import workway_rlm; print("OK")',
		]);

		let stdout = '';

		python.stdout.on('data', (data) => {
			stdout += data.toString();
		});

		python.on('close', (code) => {
			resolve(code === 0 && stdout.trim() === 'OK');
		});

		python.on('error', () => {
			resolve(false);
		});
	});
}
