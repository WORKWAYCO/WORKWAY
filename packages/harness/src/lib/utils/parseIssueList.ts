/**
 * @workwayco/harness
 *
 * Utility: Parse issue lists from markdown-formatted text.
 * Shared across checkpoint parsing and resume tests.
 */

/**
 * Parse issue IDs from markdown list format.
 *
 * Extracts issue IDs from text like:
 * ```
 * - issue-1
 * - issue-2
 * ```
 *
 * @param text - Markdown list text to parse
 * @returns Array of issue IDs
 */
export function parseIssueList(text: string | undefined): string[] {
  if (!text) return [];
  return text.split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('-'))
    .map(line => line.slice(2).trim());
}
