/**
 * WASM Validator Integration
 *
 * This module provides a unified API for workflow validation that:
 * 1. Attempts to load the high-performance Rust/WASM validator
 * 2. Falls back to the TypeScript validator if WASM is unavailable
 *
 * The WASM validator is 10-50x faster due to pre-compiled regex patterns.
 *
 * Usage:
 *   const { validate, isWasmAvailable } = await loadValidator();
 *   const result = await validate(content);
 */

import path from 'path';
import { fileURLToPath } from 'url';
import type { ValidationResult } from './workflow-validator.js';
import { validateWorkflowFile as validateTS, benchmarkValidation as benchmarkTS } from './workflow-validator.js';

// Track which validator is in use
let validatorType: 'wasm' | 'typescript' = 'typescript';
let wasmModule: WasmValidatorModule | null = null;
let wasmLoadError: Error | null = null;

/**
 * WASM module interface
 */
interface WasmValidatorModule {
	validate_workflow_wasm: (content: string) => ValidationResult;
	get_version: () => string;
	health_check: () => boolean;
}

/**
 * Try to load the WASM validator module
 */
async function loadWasmModule(): Promise<WasmValidatorModule | null> {
	if (wasmModule !== null) {
		return wasmModule;
	}

	if (wasmLoadError !== null) {
		// Already tried and failed
		return null;
	}

	try {
		// Try to load from pkg-node directory relative to this file
		const __dirname = path.dirname(fileURLToPath(import.meta.url));
		const wasmPath = path.resolve(__dirname, '../../rust-validator/pkg-node/workway_validator.js');

		// Dynamic import
		const module = await import(wasmPath);
		wasmModule = module;
		validatorType = 'wasm';
		return module;
	} catch (error) {
		wasmLoadError = error as Error;
		return null;
	}
}

/**
 * Check if WASM validator is available
 */
export async function isWasmAvailable(): Promise<boolean> {
	const module = await loadWasmModule();
	if (module) {
		try {
			return module.health_check();
		} catch {
			return false;
		}
	}
	return false;
}

/**
 * Get the current validator type
 */
export function getValidatorType(): 'wasm' | 'typescript' {
	return validatorType;
}

/**
 * Get the WASM validator version (or null if not available)
 */
export async function getWasmVersion(): Promise<string | null> {
	const module = await loadWasmModule();
	if (module) {
		try {
			return module.get_version();
		} catch {
			return null;
		}
	}
	return null;
}

/**
 * Validate workflow content using WASM (with TS fallback)
 *
 * @param content - The workflow file content
 * @returns ValidationResult
 */
export async function validateWorkflowContent(content: string): Promise<ValidationResult> {
	const module = await loadWasmModule();

	if (module) {
		try {
			const result = module.validate_workflow_wasm(content);
			return result;
		} catch (error) {
			// WASM validation failed, fall back to TypeScript
			console.warn('WASM validation failed, falling back to TypeScript:', error);
			validatorType = 'typescript';
		}
	}

	// TypeScript validation requires a file path, so we need to write to a temp file
	// or use a different approach. For content-only validation, we'll adapt.
	// For now, return a minimal result indicating we need file-based validation.
	return {
		valid: false,
		errors: [{
			type: 'error',
			code: 'CONTENT_VALIDATION_NOT_SUPPORTED',
			message: 'Content-only validation not supported in TypeScript fallback. Use validateWorkflowFileHybrid() instead.',
		}],
		warnings: [],
	};
}

/**
 * Validate a workflow file using WASM (with TS fallback)
 *
 * This is the main API for the CLI to use.
 *
 * @param workflowPath - Path to the workflow file
 * @returns ValidationResult with optional benchmark data
 */
export async function validateWorkflowFileHybrid(workflowPath: string): Promise<ValidationResult> {
	const module = await loadWasmModule();

	if (module) {
		try {
			// Read file content
			const fs = await import('fs-extra');
			const content = await fs.default.readFile(workflowPath, 'utf-8');

			// Validate with WASM
			const result = module.validate_workflow_wasm(content);
			return result;
		} catch (error) {
			// WASM validation failed, fall back to TypeScript
			console.warn('WASM validation failed, falling back to TypeScript:', error);
			validatorType = 'typescript';
		}
	}

	// Fall back to TypeScript validator
	return validateTS(workflowPath);
}

/**
 * Benchmark validation performance
 *
 * Compares WASM vs TypeScript validator performance.
 */
export async function benchmarkValidators(
	workflowPath: string,
	iterations = 10
): Promise<{
	wasmAvailable: boolean;
	wasm?: { totalMs: number; avgMs: number };
	typescript: { totalMs: number; avgMs: number };
	speedup?: number;
}> {
	const fs = await import('fs-extra');
	const content = await fs.default.readFile(workflowPath, 'utf-8');

	// Benchmark TypeScript
	const tsResult = await benchmarkTS([workflowPath], iterations);
	const tsAvg = tsResult.avgPerFile;

	// Try WASM benchmark
	const module = await loadWasmModule();
	if (module) {
		try {
			const wasmStart = performance.now();
			for (let i = 0; i < iterations; i++) {
				module.validate_workflow_wasm(content);
			}
			const wasmEnd = performance.now();
			const wasmTotal = wasmEnd - wasmStart;
			const wasmAvg = wasmTotal / iterations;

			return {
				wasmAvailable: true,
				wasm: { totalMs: wasmTotal, avgMs: wasmAvg },
				typescript: { totalMs: tsResult.totalMs, avgMs: tsAvg },
				speedup: tsAvg / wasmAvg,
			};
		} catch (error) {
			console.warn('WASM benchmark failed:', error);
		}
	}

	return {
		wasmAvailable: false,
		typescript: { totalMs: tsResult.totalMs, avgMs: tsAvg },
	};
}

/**
 * Get validator info for CLI display
 */
export async function getValidatorInfo(): Promise<{
	type: 'wasm' | 'typescript';
	version?: string;
	wasmError?: string;
}> {
	const module = await loadWasmModule();

	if (module) {
		try {
			return {
				type: 'wasm',
				version: module.get_version(),
			};
		} catch {
			// Fall through
		}
	}

	return {
		type: 'typescript',
		wasmError: wasmLoadError?.message,
	};
}
