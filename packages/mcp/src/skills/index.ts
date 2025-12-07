/**
 * WORKWAY Skills
 *
 * Reusable code patterns for common debugging and operational tasks.
 * Skills are designed for progressive disclosure - read SKILL.md in each file
 * to understand what the skill does before importing.
 *
 * ## Available Skills
 *
 * - `debugWorkflow` - Test a workflow end-to-end (webhook → execution → result)
 *
 * @example
 * ```typescript
 * import { skills } from '@workwayco/mcp';
 *
 * // Debug a workflow
 * const result = await skills.debugWorkflow({
 *   workflow: 'error-incident-manager',
 *   testEvent: {
 *     type: 'sentry',
 *     payload: { action: 'created', issue: { id: 'test', title: 'Test' } }
 *   },
 *   database: 'your-d1-id'
 * });
 * ```
 */

export { debugWorkflow } from './debug-workflow.js';
export type { DebugWorkflowInput, DebugWorkflowResult } from './debug-workflow.js';
