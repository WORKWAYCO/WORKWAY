/**
 * @workwayco/beads
 *
 * Agent-native task management for WORKWAY.
 * The tool recedes; the work remains.
 *
 * @example
 * ```typescript
 * import { BeadsStore } from '@workwayco/beads';
 *
 * const store = new BeadsStore();
 *
 * // Initialize
 * await store.init({ project: 'my-project' });
 *
 * // Create an issue
 * const issue = await store.createIssue({
 *   title: 'Fix login bug',
 *   type: 'bug',
 *   priority: 1,
 *   labels: ['urgent'],
 * });
 *
 * // Get ready issues
 * const ready = await store.getReadyIssues();
 *
 * // Close an issue
 * await store.closeIssue(issue.id);
 * ```
 */

export { BeadsStore, store } from './store.js';

export type {
  Issue,
  IssueStatus,
  IssueType,
  Priority,
  Dependency,
  DependencyType,
  BeadsConfig,
  RobotPriorityOutput,
  RobotInsightsOutput,
  StoreEvent,
  StoreEventType,
} from './types.js';

export { DEFAULT_CONFIG } from './types.js';
