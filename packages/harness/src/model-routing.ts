/**
 * @workwayco/harness
 *
 * Model Routing: Intelligent model selection based on task complexity.
 *
 * Philosophy: Different models for different tasks.
 * - Haiku: Fast, cheap pattern detection (~$0.001)
 * - Sonnet: Balanced reasoning (~$0.01)
 * - Opus: Deep analysis (~$0.10)
 *
 * The right model saves 90% on costs without sacrificing quality.
 */

import type { ClaudeModelFamily } from './types.js';

/**
 * Model routing configuration.
 */
export interface ModelRoutingConfig {
  /** Default model when no patterns match */
  default: ClaudeModelFamily;

  /** Complexity-based routing */
  complexity: {
    trivial: ClaudeModelFamily;
    simple: ClaudeModelFamily;
    standard: ClaudeModelFamily;
    complex: ClaudeModelFamily;
  };

  /** Pattern matching on issue titles */
  patterns: {
    haiku: string[];
    sonnet: string[];
    opus: string[];
  };

  /** Escalation configuration */
  escalation?: {
    enabled: boolean;
    maxRetries: number;
    escalateTo: ClaudeModelFamily;
  };
}

/**
 * Default model routing configuration.
 */
export const DEFAULT_MODEL_ROUTING: ModelRoutingConfig = {
  default: 'sonnet',

  complexity: {
    trivial: 'haiku',
    simple: 'sonnet',
    standard: 'sonnet',
    complex: 'opus',
  },

  patterns: {
    haiku: [
      'rename',
      'typo',
      'comment',
      'import',
      'export',
      'lint',
      'format',
      'cleanup',
      'bump',
      'version',
      'update deps',
      'update dependencies',
    ],
    opus: [
      'architect',
      'design',
      'refactor',
      'migrate',
      'optimize',
      'performance',
      'security',
      'integration',
      'system',
      'scale',
      'architecture',
    ],
    sonnet: [
      'add',
      'update',
      'fix',
      'implement',
      'create',
      'remove',
      'delete',
      'improve',
      'enhance',
    ],
  },

  escalation: {
    enabled: true,
    maxRetries: 2,
    escalateTo: 'opus',
  },
};

/**
 * Get the appropriate model for a task based on configuration.
 *
 * Priority hierarchy (first match wins):
 * 1. Explicit labels (model:haiku, model:sonnet, model:opus)
 * 2. Complexity labels (complexity:trivial, complexity:simple, etc.)
 * 3. Pattern matching on title (case-insensitive substring)
 * 4. Default model (sonnet)
 *
 * @param config Model routing configuration
 * @param title Issue title
 * @param labels Issue labels
 * @returns Selected model
 */
export function getModelFromConfig(
  config: ModelRoutingConfig,
  title: string,
  labels: string[] = []
): ClaudeModelFamily {
  // Priority 1: Explicit model labels
  for (const label of labels) {
    if (label === 'model:haiku') return 'haiku';
    if (label === 'model:sonnet') return 'sonnet';
    if (label === 'model:opus') return 'opus';
  }

  // Priority 2: Complexity labels
  for (const label of labels) {
    if (label === 'complexity:trivial') return config.complexity.trivial;
    if (label === 'complexity:simple') return config.complexity.simple;
    if (label === 'complexity:standard') return config.complexity.standard;
    if (label === 'complexity:complex') return config.complexity.complex;
  }

  // Priority 3: Pattern matching on title
  const normalizedTitle = title.toLowerCase();

  // Check Haiku patterns (highest ROI - cheap and fast)
  for (const pattern of config.patterns.haiku) {
    if (normalizedTitle.includes(pattern.toLowerCase())) {
      return 'haiku';
    }
  }

  // Check Opus patterns (expensive but necessary for complex work)
  for (const pattern of config.patterns.opus) {
    if (normalizedTitle.includes(pattern.toLowerCase())) {
      return 'opus';
    }
  }

  // Check Sonnet patterns (balanced default)
  for (const pattern of config.patterns.sonnet) {
    if (normalizedTitle.includes(pattern.toLowerCase())) {
      return 'sonnet';
    }
  }

  // Priority 4: Default
  return config.default;
}

/**
 * Escalate to a more powerful model after failure.
 *
 * @param currentModel The model that failed
 * @param config Model routing configuration
 * @returns Next model to try, or null if already at highest
 */
export function escalateModel(
  currentModel: ClaudeModelFamily,
  config: ModelRoutingConfig
): ClaudeModelFamily | null {
  if (!config.escalation?.enabled) {
    return null;
  }

  // Escalation ladder: haiku → sonnet → opus
  switch (currentModel) {
    case 'haiku':
      return 'sonnet';
    case 'sonnet':
      return config.escalation.escalateTo;
    case 'opus':
      return null; // Already at highest
    default:
      return null;
  }
}

/**
 * Estimate cost for a model (approximate, in USD).
 *
 * Based on typical task sizes:
 * - Haiku: ~$0.001 per task
 * - Sonnet: ~$0.01 per task
 * - Opus: ~$0.10 per task
 *
 * @param model Model family
 * @returns Estimated cost in USD
 */
export function estimateModelCost(model: ClaudeModelFamily): number {
  switch (model) {
    case 'haiku':
      return 0.001;
    case 'sonnet':
      return 0.01;
    case 'opus':
      return 0.1;
    default:
      return 0.01; // Default to sonnet pricing
  }
}

/**
 * Calculate cost savings from model routing vs always using Opus.
 *
 * @param tasks Array of model selections
 * @returns Savings percentage (0-100)
 */
export function calculateCostSavings(tasks: ClaudeModelFamily[]): number {
  if (tasks.length === 0) return 0;

  const actualCost = tasks.reduce((sum, model) => sum + estimateModelCost(model), 0);
  const opusCost = tasks.length * estimateModelCost('opus');

  return ((opusCost - actualCost) / opusCost) * 100;
}

/**
 * Get human-readable description of model selection.
 *
 * @param model Selected model
 * @param reason Why this model was selected
 * @returns Formatted description
 */
export function formatModelSelection(
  model: ClaudeModelFamily,
  reason: 'label' | 'complexity' | 'pattern' | 'default'
): string {
  const modelName = model.toUpperCase();
  const cost = estimateModelCost(model).toFixed(3);

  switch (reason) {
    case 'label':
      return `${modelName} (explicit label, ~$${cost})`;
    case 'complexity':
      return `${modelName} (complexity-based, ~$${cost})`;
    case 'pattern':
      return `${modelName} (pattern match, ~$${cost})`;
    case 'default':
      return `${modelName} (default, ~$${cost})`;
  }
}
