/**
 * @workwayco/harness
 *
 * Reviewer System: Specialized reviewers with optimized model selection.
 *
 * Philosophy: The right reviewer at the right cost.
 * - Security: Fast pattern scanning (Haiku, ~$0.001)
 * - Architecture: Deep DRY analysis (Opus, ~$0.10)
 * - Quality: Balanced review (Sonnet, ~$0.01)
 * - Custom: User-defined logic (Sonnet default)
 *
 * Cost optimization: 90% savings vs all-Opus reviews.
 */

import type { ClaudeModelFamily } from './types.js';

/**
 * Reviewer type with specific focus areas.
 */
export type ReviewerType = 'security' | 'architecture' | 'quality' | 'custom';

/**
 * Review finding severity.
 */
export type FindingSeverity = 'critical' | 'warning' | 'info';

/**
 * Review finding from a reviewer.
 */
export interface ReviewFinding {
  /** Finding severity */
  severity: FindingSeverity;
  /** Reviewer that found this */
  reviewer: ReviewerType;
  /** File path if applicable */
  file?: string;
  /** Line number if applicable */
  line?: number;
  /** Finding description */
  message: string;
  /** Suggested fix */
  suggestion?: string;
  /** Confidence score (0-1) */
  confidence: number;
}

/**
 * Review result from a reviewer.
 */
export interface ReviewResult {
  /** Reviewer type */
  reviewer: ReviewerType;
  /** Model used */
  model: ClaudeModelFamily;
  /** Findings from this review */
  findings: ReviewFinding[];
  /** Overall assessment */
  summary: string;
  /** Review duration in ms */
  durationMs: number;
  /** Estimated cost */
  estimatedCost: number;
}

/**
 * Reviewer configuration.
 */
export interface ReviewerConfig {
  /** Model to use for this reviewer */
  model: ClaudeModelFamily;
  /** Enable this reviewer */
  enabled: boolean;
  /** Confidence threshold for blocking findings */
  confidence: number;
  /** Additional reviewer-specific options */
  options?: Record<string, unknown>;
}

/**
 * Get the appropriate model for a reviewer type.
 *
 * Each reviewer has a default model optimized for its task:
 * - Security: Haiku (pattern scanning, fast & cheap)
 * - Architecture: Opus (deep DRY analysis, full context)
 * - Quality: Sonnet (balanced review, conventions)
 * - Custom: Sonnet (safe default)
 *
 * @param type Reviewer type
 * @param override Optional model override from config
 * @returns Selected model
 */
export function getReviewerModel(
  type: ReviewerType,
  override?: ClaudeModelFamily
): ClaudeModelFamily {
  // Config override takes precedence
  if (override) {
    return override;
  }

  // Type-specific defaults
  switch (type) {
    case 'security':
      return 'haiku'; // Fast pattern scanning
    case 'architecture':
      return 'opus'; // Deep analysis with full context
    case 'quality':
      return 'sonnet'; // Balanced review
    case 'custom':
      return 'sonnet'; // Safe default
  }
}

/**
 * Get the focus areas for a reviewer type.
 *
 * @param type Reviewer type
 * @returns Array of focus areas
 */
export function getReviewerFocusAreas(type: ReviewerType): string[] {
  switch (type) {
    case 'security':
      return [
        'Authentication & Authorization',
        'Input Validation',
        'SQL Injection',
        'XSS Vulnerabilities',
        'CSRF Protection',
        'Secrets Exposure',
        'Data Handling',
        'Dependency Security',
      ];

    case 'architecture':
      return [
        'DRY Violations (3+ file duplicates)',
        'Shared Abstractions',
        'Design Patterns',
        'Coupling & Cohesion',
        'Separation of Concerns',
        'Code Organization',
        'Naming Consistency',
        'Module Dependencies',
      ];

    case 'quality':
      return [
        'Error Handling',
        'Edge Cases',
        'Type Safety',
        'Test Coverage',
        'Code Clarity',
        'Performance Considerations',
        'Documentation',
        'Convention Adherence',
      ];

    case 'custom':
      return ['User-defined review logic'];
  }
}

/**
 * Estimate cost for a review.
 *
 * Based on model and typical review sizes:
 * - Haiku: ~$0.001 (focused pattern scanning)
 * - Sonnet: ~$0.01 (balanced review)
 * - Opus: ~$0.10 (full harness diff analysis)
 *
 * @param model Model used for review
 * @returns Estimated cost in USD
 */
export function estimateReviewCost(model: ClaudeModelFamily): number {
  switch (model) {
    case 'haiku':
      return 0.001;
    case 'sonnet':
      return 0.01;
    case 'opus':
      return 0.1;
    default:
      return 0.01;
  }
}

/**
 * Calculate total cost for a review pipeline.
 *
 * @param reviewers Array of reviewer types with their models
 * @returns Total estimated cost
 */
export function calculateReviewPipelineCost(
  reviewers: Array<{ type: ReviewerType; model: ClaudeModelFamily }>
): number {
  return reviewers.reduce((total, { model }) => total + estimateReviewCost(model), 0);
}

/**
 * Calculate cost savings from optimized reviewer routing.
 *
 * Compares actual cost vs all-Opus baseline.
 *
 * @param reviewers Array of reviewer types with their models
 * @returns Savings percentage (0-100)
 */
export function calculateReviewerSavings(
  reviewers: Array<{ type: ReviewerType; model: ClaudeModelFamily }>
): number {
  if (reviewers.length === 0) return 0;

  const actualCost = calculateReviewPipelineCost(reviewers);
  const opusCost = reviewers.length * estimateReviewCost('opus');

  return ((opusCost - actualCost) / opusCost) * 100;
}

/**
 * Get human-readable description of a reviewer.
 *
 * @param type Reviewer type
 * @param model Model used
 * @returns Formatted description
 */
export function formatReviewer(type: ReviewerType, model: ClaudeModelFamily): string {
  const modelName = model.toUpperCase();
  const cost = estimateReviewCost(model).toFixed(3);
  const focusAreas = getReviewerFocusAreas(type);

  return `${type.toUpperCase()} Reviewer → ${modelName} (~$${cost})
Focus: ${focusAreas.slice(0, 3).join(', ')}${focusAreas.length > 3 ? '...' : ''}`;
}

/**
 * Default reviewer configuration.
 */
export const DEFAULT_REVIEWER_CONFIG: Record<ReviewerType, ReviewerConfig> = {
  security: {
    model: 'haiku',
    enabled: true,
    confidence: 0.7,
  },
  architecture: {
    model: 'opus',
    enabled: true,
    confidence: 0.8,
    options: {
      criticalThreshold: 3, // Flag if same pattern in 3+ files
    },
  },
  quality: {
    model: 'sonnet',
    enabled: true,
    confidence: 0.75,
  },
  custom: {
    model: 'sonnet',
    enabled: false,
    confidence: 0.75,
  },
};

/**
 * Check if a finding is blocking (based on severity and confidence).
 *
 * @param finding Review finding
 * @param config Reviewer configuration
 * @returns True if finding should block
 */
export function isBlockingFinding(
  finding: ReviewFinding,
  config: ReviewerConfig
): boolean {
  // Critical findings with sufficient confidence are blocking
  if (finding.severity === 'critical' && finding.confidence >= config.confidence) {
    return true;
  }

  return false;
}

/**
 * Filter findings to only blocking ones.
 *
 * @param findings Array of review findings
 * @param configs Reviewer configurations
 * @returns Filtered array of blocking findings
 */
export function getBlockingFindings(
  findings: ReviewFinding[],
  configs: Record<ReviewerType, ReviewerConfig>
): ReviewFinding[] {
  return findings.filter((finding) => {
    const config = configs[finding.reviewer];
    return isBlockingFinding(finding, config);
  });
}

/**
 * Group findings by file.
 *
 * @param findings Array of review findings
 * @returns Map of file path to findings
 */
export function groupFindingsByFile(
  findings: ReviewFinding[]
): Map<string, ReviewFinding[]> {
  const grouped = new Map<string, ReviewFinding[]>();

  for (const finding of findings) {
    const file = finding.file ?? 'unknown';
    const existing = grouped.get(file) ?? [];
    existing.push(finding);
    grouped.set(file, existing);
  }

  return grouped;
}

/**
 * Format review findings for display.
 *
 * @param findings Array of review findings
 * @returns Formatted string
 */
export function formatFindings(findings: ReviewFinding[]): string {
  if (findings.length === 0) {
    return 'No findings';
  }

  const grouped = groupFindingsByFile(findings);
  const lines: string[] = [];

  for (const [file, fileFindings] of grouped) {
    lines.push(`\n${file}:`);
    for (const finding of fileFindings) {
      const icon = finding.severity === 'critical' ? '🔴' : finding.severity === 'warning' ? '🟡' : 'ℹ️';
      const location = finding.line ? `:${finding.line}` : '';
      lines.push(`  ${icon} [${finding.reviewer}]${location} ${finding.message}`);
      if (finding.suggestion) {
        lines.push(`     💡 ${finding.suggestion}`);
      }
    }
  }

  return lines.join('\n');
}
