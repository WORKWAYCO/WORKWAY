/**
 * @workwayco/harness - Model Routing Tests
 *
 * Tests intelligent model selection based on labels, complexity, and patterns.
 */

import { describe, it, expect } from 'vitest';
import {
  getModelFromConfig,
  escalateModel,
  estimateModelCost,
  calculateCostSavings,
  formatModelSelection,
  DEFAULT_MODEL_ROUTING,
  type ModelRoutingConfig,
} from '../model-routing.js';
import type { ClaudeModelFamily } from '../types.js';

describe('Model Routing', () => {
  describe('getModelFromConfig', () => {
    describe('Priority 1: Explicit Labels', () => {
      it('should use model:haiku label', () => {
        const result = getModelFromConfig(
          DEFAULT_MODEL_ROUTING,
          'Any title',
          ['model:haiku']
        );
        expect(result).toBe('haiku');
      });

      it('should use model:sonnet label', () => {
        const result = getModelFromConfig(
          DEFAULT_MODEL_ROUTING,
          'Any title',
          ['model:sonnet']
        );
        expect(result).toBe('sonnet');
      });

      it('should use model:opus label', () => {
        const result = getModelFromConfig(
          DEFAULT_MODEL_ROUTING,
          'Any title',
          ['model:opus']
        );
        expect(result).toBe('opus');
      });

      it('should prioritize explicit label over complexity', () => {
        const result = getModelFromConfig(
          DEFAULT_MODEL_ROUTING,
          'Architect the system',
          ['model:haiku', 'complexity:complex']
        );
        expect(result).toBe('haiku');
      });
    });

    describe('Priority 2: Complexity Labels', () => {
      it('should use complexity:trivial → haiku', () => {
        const result = getModelFromConfig(
          DEFAULT_MODEL_ROUTING,
          'Any title',
          ['complexity:trivial']
        );
        expect(result).toBe('haiku');
      });

      it('should use complexity:simple → sonnet', () => {
        const result = getModelFromConfig(
          DEFAULT_MODEL_ROUTING,
          'Any title',
          ['complexity:simple']
        );
        expect(result).toBe('sonnet');
      });

      it('should use complexity:standard → sonnet', () => {
        const result = getModelFromConfig(
          DEFAULT_MODEL_ROUTING,
          'Any title',
          ['complexity:standard']
        );
        expect(result).toBe('sonnet');
      });

      it('should use complexity:complex → opus', () => {
        const result = getModelFromConfig(
          DEFAULT_MODEL_ROUTING,
          'Any title',
          ['complexity:complex']
        );
        expect(result).toBe('opus');
      });

      it('should prioritize complexity over pattern matching', () => {
        const result = getModelFromConfig(
          DEFAULT_MODEL_ROUTING,
          'rename file', // Would match haiku pattern
          ['complexity:complex']
        );
        expect(result).toBe('opus');
      });
    });

    describe('Priority 3: Pattern Matching', () => {
      describe('Haiku patterns (fast, cheap)', () => {
        it('should match "rename"', () => {
          const result = getModelFromConfig(
            DEFAULT_MODEL_ROUTING,
            'Rename component to new name'
          );
          expect(result).toBe('haiku');
        });

        it('should match "typo"', () => {
          const result = getModelFromConfig(
            DEFAULT_MODEL_ROUTING,
            'Fix typo in README'
          );
          expect(result).toBe('haiku');
        });

        it('should match "lint"', () => {
          const result = getModelFromConfig(
            DEFAULT_MODEL_ROUTING,
            'Fix lint errors in codebase'
          );
          expect(result).toBe('haiku');
        });

        it('should match "update deps"', () => {
          const result = getModelFromConfig(
            DEFAULT_MODEL_ROUTING,
            'Update deps to latest versions'
          );
          expect(result).toBe('haiku');
        });

        it('should be case-insensitive', () => {
          const result = getModelFromConfig(
            DEFAULT_MODEL_ROUTING,
            'RENAME Component'
          );
          expect(result).toBe('haiku');
        });
      });

      describe('Opus patterns (deep analysis)', () => {
        it('should match "architect"', () => {
          const result = getModelFromConfig(
            DEFAULT_MODEL_ROUTING,
            'Architect the new auth system'
          );
          expect(result).toBe('opus');
        });

        it('should match "refactor"', () => {
          const result = getModelFromConfig(
            DEFAULT_MODEL_ROUTING,
            'Refactor database layer'
          );
          expect(result).toBe('opus');
        });

        it('should match "migrate"', () => {
          const result = getModelFromConfig(
            DEFAULT_MODEL_ROUTING,
            'Migrate database schema'
          );
          expect(result).toBe('opus');
        });

        it('should match "security"', () => {
          const result = getModelFromConfig(
            DEFAULT_MODEL_ROUTING,
            'Security audit of auth flow'
          );
          expect(result).toBe('opus');
        });

        it('should match "performance"', () => {
          const result = getModelFromConfig(
            DEFAULT_MODEL_ROUTING,
            'Performance optimization for queries'
          );
          expect(result).toBe('opus');
        });
      });

      describe('Sonnet patterns (balanced)', () => {
        it('should match "add"', () => {
          const result = getModelFromConfig(
            DEFAULT_MODEL_ROUTING,
            'Add new feature to dashboard'
          );
          expect(result).toBe('sonnet');
        });

        it('should match "fix"', () => {
          const result = getModelFromConfig(
            DEFAULT_MODEL_ROUTING,
            'Fix bug in login flow'
          );
          expect(result).toBe('sonnet');
        });

        it('should match "implement"', () => {
          const result = getModelFromConfig(
            DEFAULT_MODEL_ROUTING,
            'Implement user settings page'
          );
          expect(result).toBe('sonnet');
        });

        it('should match "create"', () => {
          const result = getModelFromConfig(
            DEFAULT_MODEL_ROUTING,
            'Create new dashboard component'
          );
          expect(result).toBe('sonnet');
        });
      });
    });

    describe('Priority 4: Default', () => {
      it('should use default when no patterns match', () => {
        const result = getModelFromConfig(
          DEFAULT_MODEL_ROUTING,
          'Some random task title'
        );
        expect(result).toBe('sonnet');
      });

      it('should use custom default from config', () => {
        const customConfig: ModelRoutingConfig = {
          ...DEFAULT_MODEL_ROUTING,
          default: 'haiku',
        };
        const result = getModelFromConfig(customConfig, 'Random task');
        expect(result).toBe('haiku');
      });
    });

    describe('Priority Hierarchy', () => {
      it('should prioritize label over all else', () => {
        const result = getModelFromConfig(
          DEFAULT_MODEL_ROUTING,
          'Architect system refactor', // opus patterns
          ['model:haiku', 'complexity:complex']
        );
        expect(result).toBe('haiku');
      });

      it('should prioritize complexity over pattern', () => {
        const result = getModelFromConfig(
          DEFAULT_MODEL_ROUTING,
          'rename file', // haiku pattern
          ['complexity:complex']
        );
        expect(result).toBe('opus');
      });

      it('should use pattern when no labels', () => {
        const result = getModelFromConfig(
          DEFAULT_MODEL_ROUTING,
          'Fix typo in docs'
        );
        expect(result).toBe('haiku');
      });
    });
  });

  describe('escalateModel', () => {
    it('should escalate haiku to sonnet', () => {
      const result = escalateModel('haiku', DEFAULT_MODEL_ROUTING);
      expect(result).toBe('sonnet');
    });

    it('should escalate sonnet to opus', () => {
      const result = escalateModel('sonnet', DEFAULT_MODEL_ROUTING);
      expect(result).toBe('opus');
    });

    it('should return null for opus (already highest)', () => {
      const result = escalateModel('opus', DEFAULT_MODEL_ROUTING);
      expect(result).toBeNull();
    });

    it('should respect escalation config', () => {
      const config: ModelRoutingConfig = {
        ...DEFAULT_MODEL_ROUTING,
        escalation: {
          enabled: false,
          maxRetries: 0,
          escalateTo: 'opus',
        },
      };
      const result = escalateModel('haiku', config);
      expect(result).toBeNull();
    });

    it('should use custom escalateTo', () => {
      const config: ModelRoutingConfig = {
        ...DEFAULT_MODEL_ROUTING,
        escalation: {
          enabled: true,
          maxRetries: 2,
          escalateTo: 'sonnet',
        },
      };
      const result = escalateModel('haiku', config);
      expect(result).toBe('sonnet');
    });
  });

  describe('estimateModelCost', () => {
    it('should estimate haiku cost', () => {
      expect(estimateModelCost('haiku')).toBe(0.001);
    });

    it('should estimate sonnet cost', () => {
      expect(estimateModelCost('sonnet')).toBe(0.01);
    });

    it('should estimate opus cost', () => {
      expect(estimateModelCost('opus')).toBe(0.1);
    });

    it('should default to sonnet for unknown', () => {
      expect(estimateModelCost('unknown')).toBe(0.01);
    });
  });

  describe('calculateCostSavings', () => {
    it('should calculate savings from mixed models', () => {
      const tasks: ClaudeModelFamily[] = [
        'haiku', // $0.001
        'haiku', // $0.001
        'sonnet', // $0.01
        'sonnet', // $0.01
        'opus', // $0.1
      ];
      // Actual: 0.122
      // All opus: 0.5
      // Savings: (0.5 - 0.122) / 0.5 = 75.6%
      const savings = calculateCostSavings(tasks);
      expect(savings).toBeCloseTo(75.6, 1);
    });

    it('should return 0 for empty array', () => {
      expect(calculateCostSavings([])).toBe(0);
    });

    it('should return 0 for all opus', () => {
      const tasks: ClaudeModelFamily[] = ['opus', 'opus', 'opus'];
      expect(calculateCostSavings(tasks)).toBe(0);
    });

    it('should calculate 90% savings for all haiku', () => {
      const tasks: ClaudeModelFamily[] = ['haiku', 'haiku', 'haiku'];
      // Actual: 0.003
      // All opus: 0.3
      // Savings: 99%
      const savings = calculateCostSavings(tasks);
      expect(savings).toBeCloseTo(99, 0);
    });
  });

  describe('formatModelSelection', () => {
    it('should format label-based selection', () => {
      const result = formatModelSelection('haiku', 'label');
      expect(result).toBe('HAIKU (explicit label, ~$0.001)');
    });

    it('should format complexity-based selection', () => {
      const result = formatModelSelection('sonnet', 'complexity');
      expect(result).toBe('SONNET (complexity-based, ~$0.010)');
    });

    it('should format pattern-based selection', () => {
      const result = formatModelSelection('opus', 'pattern');
      expect(result).toBe('OPUS (pattern match, ~$0.100)');
    });

    it('should format default selection', () => {
      const result = formatModelSelection('sonnet', 'default');
      expect(result).toBe('SONNET (default, ~$0.010)');
    });
  });

  describe('Real-World Scenarios', () => {
    it('should route rename task to haiku (fast & cheap)', () => {
      const result = getModelFromConfig(
        DEFAULT_MODEL_ROUTING,
        'Rename UserProfile to Profile component'
      );
      expect(result).toBe('haiku');
    });

    it('should route architecture task to opus (deep analysis)', () => {
      const result = getModelFromConfig(
        DEFAULT_MODEL_ROUTING,
        'Design distributed caching architecture'
      );
      expect(result).toBe('opus');
    });

    it('should route feature implementation to sonnet (balanced)', () => {
      const result = getModelFromConfig(
        DEFAULT_MODEL_ROUTING,
        'Add password reset flow to auth'
      );
      expect(result).toBe('sonnet');
    });

    it('should handle complex refactor with explicit label override', () => {
      const result = getModelFromConfig(
        DEFAULT_MODEL_ROUTING,
        'Refactor entire auth system',
        ['model:sonnet'] // Override opus pattern
      );
      expect(result).toBe('sonnet');
    });

    it('should estimate 75% cost savings for typical workload', () => {
      // Typical workload: 50% simple, 25% quick, 25% complex
      const tasks: ClaudeModelFamily[] = [
        ...Array(5).fill('sonnet'),
        ...Array(2).fill('haiku'),
        ...Array(2).fill('sonnet'),
        'opus',
      ];
      const savings = calculateCostSavings(tasks);
      expect(savings).toBeGreaterThan(70);
      expect(savings).toBeLessThan(85);
    });
  });
});
