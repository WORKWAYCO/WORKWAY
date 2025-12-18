/**
 * @workwayco/harness
 *
 * Spec Parser: Convert markdown PRD documents into structured features.
 *
 * Expected format:
 * ```markdown
 * # Project Title
 *
 * ## Overview
 * Description of the project...
 *
 * ## Features
 *
 * ### Category Name
 * - [ ] Feature title
 *   - Acceptance criterion 1
 *   - Acceptance criterion 2
 * - [ ] Another feature
 * ```
 */

import { marked } from 'marked';
import type { Feature, ParsedSpec } from './types.js';

// ─────────────────────────────────────────────────────────────────────────────
// Token Types (from marked)
// ─────────────────────────────────────────────────────────────────────────────

interface Token {
  type: string;
  raw: string;
  text?: string;
  depth?: number;
  items?: ListItem[];
  tokens?: Token[];
}

interface ListItem {
  type: 'list_item';
  raw: string;
  text: string;
  task: boolean;
  checked: boolean;
  tokens: Token[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Priority Inference
// ─────────────────────────────────────────────────────────────────────────────

const PRIORITY_KEYWORDS: Record<number, string[]> = {
  0: ['critical', 'urgent', 'blocker', 'p0', 'must-have', 'required'],
  1: ['important', 'high', 'p1', 'should-have'],
  2: ['medium', 'normal', 'p2', 'default'],
  3: ['low', 'nice-to-have', 'p3', 'could-have'],
  4: ['optional', 'maybe', 'p4', 'wishlist'],
};

/**
 * Infer priority from text content.
 */
function inferPriority(text: string): number {
  const lower = text.toLowerCase();

  for (const [priority, keywords] of Object.entries(PRIORITY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        return parseInt(priority, 10);
      }
    }
  }

  return 2; // Default priority
}

// ─────────────────────────────────────────────────────────────────────────────
// ID Generation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a slug ID from text.
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

// ─────────────────────────────────────────────────────────────────────────────
// Parser
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse a markdown spec into structured features.
 */
export function parseSpec(markdown: string): ParsedSpec {
  const tokens = marked.lexer(markdown);

  let title = '';
  let overview = '';
  const features: Feature[] = [];
  let currentCategory = '';
  let featureIndex = 0;

  // First pass: find title and overview
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i] as Token;

    // H1 is the title
    if (token.type === 'heading' && token.depth === 1) {
      title = token.text || '';
    }

    // "Overview" section
    if (token.type === 'heading' && token.depth === 2 && token.text?.toLowerCase() === 'overview') {
      // Collect paragraphs until next heading
      for (let j = i + 1; j < tokens.length; j++) {
        const next = tokens[j] as Token;
        if (next.type === 'heading') break;
        if (next.type === 'paragraph') {
          overview += (overview ? '\n\n' : '') + (next.text || '');
        }
      }
    }
  }

  // Second pass: find features
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i] as Token;

    // H3 is a category
    if (token.type === 'heading' && token.depth === 3) {
      currentCategory = token.text || 'General';
    }

    // Lists contain features
    if (token.type === 'list' && token.items) {
      for (const item of token.items) {
        // Check if it's a task item (checkbox)
        const featureText = extractText(item);
        if (!featureText) continue;

        featureIndex++;
        const featureId = `feature-${featureIndex}-${slugify(featureText)}`;

        // Extract acceptance criteria (sub-items)
        const acceptanceCriteria: string[] = [];
        if (item.tokens) {
          for (const subToken of item.tokens) {
            if ((subToken as Token).type === 'list' && (subToken as Token).items) {
              for (const subItem of (subToken as Token).items!) {
                const criterionText = extractText(subItem);
                if (criterionText) {
                  acceptanceCriteria.push(criterionText);
                }
              }
            }
          }
        }

        // Infer dependencies from same category (first feature blocks others)
        const dependsOn: string[] = [];
        const categoryFeatures = features.filter((f) => f.category === currentCategory);
        if (categoryFeatures.length > 0) {
          // Depend on the first feature in the category
          dependsOn.push(categoryFeatures[0].id);
        }

        // Generate labels
        const labels = [slugify(currentCategory)].filter(Boolean);

        features.push({
          id: featureId,
          title: featureText,
          description: acceptanceCriteria.length > 0
            ? `Acceptance criteria:\n${acceptanceCriteria.map((c) => `- ${c}`).join('\n')}`
            : '',
          priority: inferPriority(featureText),
          dependsOn,
          acceptanceCriteria,
          labels,
          category: currentCategory,
        });
      }
    }
  }

  return {
    title: title || 'Untitled Project',
    overview: overview || 'No overview provided.',
    features,
  };
}

/**
 * Extract plain text from a list item.
 */
function extractText(item: ListItem): string {
  // Get the first line of text
  let text = item.text || '';

  // Remove checkbox syntax
  text = text.replace(/^\[[ x]\]\s*/i, '');

  // Take only the first line
  text = text.split('\n')[0].trim();

  return text;
}

/**
 * Format a parsed spec as a summary string.
 */
export function formatSpecSummary(spec: ParsedSpec): string {
  const lines: string[] = [];

  lines.push(`📋 ${spec.title}`);
  lines.push('');
  lines.push(spec.overview.slice(0, 200) + (spec.overview.length > 200 ? '...' : ''));
  lines.push('');
  lines.push(`Features: ${spec.features.length}`);

  // Group by category
  const categories = new Map<string, Feature[]>();
  for (const feature of spec.features) {
    const cat = feature.category || 'General';
    const existing = categories.get(cat) || [];
    categories.set(cat, [...existing, feature]);
  }

  for (const [category, features] of categories) {
    lines.push(`  ${category}: ${features.length} features`);
  }

  return lines.join('\n');
}

/**
 * Validate a spec has required content.
 */
export function validateSpec(spec: ParsedSpec): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!spec.title || spec.title === 'Untitled Project') {
    errors.push('Spec must have a title (# Title)');
  }

  if (spec.features.length === 0) {
    errors.push('Spec must have at least one feature');
  }

  for (const feature of spec.features) {
    if (!feature.title) {
      errors.push(`Feature ${feature.id} has no title`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
