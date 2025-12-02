/**
 * Error Handler Factory
 *
 * Weniger, aber besser: One error handling pattern for all integrations.
 * Eliminates ~300 lines of duplicate error handling code.
 */

import {
	ActionResult,
	IntegrationError,
	ErrorCode,
	createErrorFromResponse,
} from '@workwayco/sdk';

/**
 * Create an error handler bound to a specific integration
 *
 * @example
 * ```typescript
 * const handleError = createErrorHandler('gmail');
 *
 * // Later in methods:
 * catch (error) {
 *   return handleError(error, 'send-email');
 * }
 * ```
 */
export function createErrorHandler(integrationName: string) {
	return function handleError<T>(
		error: unknown,
		action: string
	): ActionResult<T> {
		if (error instanceof IntegrationError) {
			const integrationErr = error as IntegrationError;
			return ActionResult.error(integrationErr.message, integrationErr.code, {
				integration: integrationName,
				action,
			});
		}

		const errMessage = error instanceof Error ? error.message : String(error);
		return ActionResult.error(
			`Failed to ${action.replace(/-/g, ' ')}: ${errMessage}`,
			ErrorCode.API_ERROR,
			{ integration: integrationName, action }
		);
	};
}

/**
 * Assert response is OK, throw IntegrationError if not
 *
 * @example
 * ```typescript
 * const response = await this.request('/endpoint');
 * await assertResponseOk(response, { integration: 'gmail', action: 'get-email' });
 * const data = await response.json();
 * ```
 */
export async function assertResponseOk(
	response: Response,
	context: { integration: string; action: string }
): Promise<void> {
	if (!response.ok) {
		throw await createErrorFromResponse(response, context);
	}
}

/**
 * Validate that access token is provided
 * Throws IntegrationError if missing
 */
export function validateAccessToken(
	token: unknown,
	integrationName: string
): asserts token is string {
	if (!token || (typeof token === 'string' && token.trim() === '')) {
		throw new IntegrationError(
			ErrorCode.AUTH_MISSING,
			`${integrationName} access token is required`,
			{ integration: integrationName, retryable: false }
		);
	}
}
