/**
 * @workwayco/harness
 *
 * Redirect: Detect human steering through Beads issue changes.
 * Enables reactive steering without interrupting flow.
 */

import { BeadsStore } from '@workwayco/beads';
import type { Issue } from '@workwayco/beads';
import type { Redirect, RedirectType } from './types.js';

// ─────────────────────────────────────────────────────────────────────────────
// Snapshot
// ─────────────────────────────────────────────────────────────────────────────

export interface BeadsSnapshot {
  /** Snapshot timestamp */
  timestamp: string;
  /** Issue states at snapshot time */
  issues: Map<string, { priority: number; status: string }>;
  /** P0/P1 issue IDs at snapshot time */
  urgentIds: Set<string>;
}

/**
 * Take a snapshot of current Beads state.
 */
export async function takeSnapshot(cwd: string): Promise<BeadsSnapshot> {
  const store = new BeadsStore(cwd);
  const issues = await store.getAllIssues();

  const issueMap = new Map<string, { priority: number; status: string }>();
  const urgentIds = new Set<string>();

  for (const issue of issues) {
    issueMap.set(issue.id, {
      priority: issue.priority,
      status: issue.status,
    });

    if (issue.priority <= 1 && issue.status !== 'closed') {
      urgentIds.add(issue.id);
    }
  }

  return {
    timestamp: new Date().toISOString(),
    issues: issueMap,
    urgentIds,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Redirect Detection
// ─────────────────────────────────────────────────────────────────────────────

export interface RedirectCheckResult {
  /** Detected redirects */
  redirects: Redirect[];
  /** New snapshot */
  newSnapshot: BeadsSnapshot;
  /** Should pause? */
  shouldPause: boolean;
  /** Pause reason if should pause */
  pauseReason: string | null;
}

/**
 * Check for redirects since last snapshot.
 */
export async function checkForRedirects(
  oldSnapshot: BeadsSnapshot,
  harnessId: string,
  cwd: string
): Promise<RedirectCheckResult> {
  const store = new BeadsStore(cwd);
  const currentIssues = await store.getAllIssues();
  const now = new Date().toISOString();

  const redirects: Redirect[] = [];
  let shouldPause = false;
  let pauseReason: string | null = null;

  // Build new snapshot
  const newIssueMap = new Map<string, { priority: number; status: string }>();
  const newUrgentIds = new Set<string>();

  for (const issue of currentIssues) {
    newIssueMap.set(issue.id, {
      priority: issue.priority,
      status: issue.status,
    });

    if (issue.priority <= 1 && issue.status !== 'closed') {
      newUrgentIds.add(issue.id);
    }

    // Check for pause request
    if (
      issue.labels?.includes('pause') &&
      issue.labels?.includes(`harness:${harnessId}`) &&
      issue.status !== 'closed'
    ) {
      shouldPause = true;
      pauseReason = issue.title;
      redirects.push({
        type: 'pause_requested',
        issueId: issue.id,
        description: `Pause requested: ${issue.title}`,
        detectedAt: now,
      });
    }
  }

  // Check for priority escalations (P2+ → P0/P1)
  for (const [id, oldState] of oldSnapshot.issues) {
    const newState = newIssueMap.get(id);
    if (!newState) continue;

    // Priority escalation
    if (oldState.priority > 1 && newState.priority <= 1) {
      const issue = currentIssues.find((i) => i.id === id);
      redirects.push({
        type: 'priority_change',
        issueId: id,
        description: `Priority escalated P${oldState.priority} → P${newState.priority}: ${issue?.title || id}`,
        detectedAt: now,
      });
    }

    // Issue closed externally (not by harness)
    if (oldState.status !== 'closed' && newState.status === 'closed') {
      const issue = currentIssues.find((i) => i.id === id);
      redirects.push({
        type: 'issue_closed',
        issueId: id,
        description: `Issue closed: ${issue?.title || id}`,
        detectedAt: now,
      });
    }
  }

  // Check for new urgent issues
  for (const id of newUrgentIds) {
    if (!oldSnapshot.urgentIds.has(id) && !oldSnapshot.issues.has(id)) {
      const issue = currentIssues.find((i) => i.id === id);
      redirects.push({
        type: 'new_urgent',
        issueId: id,
        description: `New urgent issue: ${issue?.title || id}`,
        detectedAt: now,
      });
    }
  }

  return {
    redirects,
    newSnapshot: {
      timestamp: now,
      issues: newIssueMap,
      urgentIds: newUrgentIds,
    },
    shouldPause,
    pauseReason,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Redirect Formatting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if any redirects require immediate action.
 */
export function requiresImmediateAction(redirects: Redirect[]): boolean {
  return redirects.some(
    (r) => r.type === 'pause_requested' || r.type === 'new_urgent'
  );
}

/**
 * Format redirects as notes string.
 */
export function formatRedirectNotes(redirects: Redirect[]): string {
  if (redirects.length === 0) return '';

  return redirects.map((r) => r.description).join('\n');
}

/**
 * Log a redirect for display.
 */
export function logRedirect(redirect: Redirect): string {
  const icons: Record<RedirectType, string> = {
    priority_change: '⬆️',
    new_urgent: '🚨',
    issue_closed: '✓',
    pause_requested: '⏸',
  };

  return `${icons[redirect.type]} ${redirect.description}`;
}
