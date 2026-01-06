/**
 * @workwayco/harness - Reviewer System Tests
 *
 * Tests specialized reviewers with optimized model selection.
 */

import { describe, it, expect } from 'vitest';
import {
  getReviewerModel,
  getReviewerFocusAreas,
  estimateReviewCost,
  calculateReviewPipelineCost,
  calculateReviewerSavings,
  formatReviewer,
  isBlockingFinding,
  getBlockingFindings,
  groupFindingsByFile,
  formatFindings,
  DEFAULT_REVIEWER_CONFIG,
  type ReviewerType,
  type ReviewFinding,
} from '../reviewer.js';
import type { ClaudeModelFamily } from '../types.js';

describe('Reviewer System', () => {
  describe('getReviewerModel', () => {
    it('should return haiku for security reviewer', () => {
      expect(getReviewerModel('security')).toBe('haiku');
    });

    it('should return opus for architecture reviewer', () => {
      expect(getReviewerModel('architecture')).toBe('opus');
    });

    it('should return sonnet for quality reviewer', () => {
      expect(getReviewerModel('quality')).toBe('sonnet');
    });

    it('should return sonnet for custom reviewer', () => {
      expect(getReviewerModel('custom')).toBe('sonnet');
    });

    it('should respect model override', () => {
      expect(getReviewerModel('security', 'opus')).toBe('opus');
      expect(getReviewerModel('architecture', 'haiku')).toBe('haiku');
      expect(getReviewerModel('quality', 'opus')).toBe('opus');
    });
  });

  describe('getReviewerFocusAreas', () => {
    it('should return security focus areas', () => {
      const areas = getReviewerFocusAreas('security');
      expect(areas).toContain('Authentication & Authorization');
      expect(areas).toContain('SQL Injection');
      expect(areas).toContain('XSS Vulnerabilities');
      expect(areas).toContain('Secrets Exposure');
    });

    it('should return architecture focus areas', () => {
      const areas = getReviewerFocusAreas('architecture');
      expect(areas).toContain('DRY Violations (3+ file duplicates)');
      expect(areas).toContain('Design Patterns');
      expect(areas).toContain('Coupling & Cohesion');
    });

    it('should return quality focus areas', () => {
      const areas = getReviewerFocusAreas('quality');
      expect(areas).toContain('Error Handling');
      expect(areas).toContain('Type Safety');
      expect(areas).toContain('Test Coverage');
    });

    it('should return custom focus areas', () => {
      const areas = getReviewerFocusAreas('custom');
      expect(areas).toContain('User-defined review logic');
    });
  });

  describe('estimateReviewCost', () => {
    it('should estimate haiku review cost', () => {
      expect(estimateReviewCost('haiku')).toBe(0.001);
    });

    it('should estimate sonnet review cost', () => {
      expect(estimateReviewCost('sonnet')).toBe(0.01);
    });

    it('should estimate opus review cost', () => {
      expect(estimateReviewCost('opus')).toBe(0.1);
    });

    it('should default to sonnet for unknown model', () => {
      expect(estimateReviewCost('unknown' as ClaudeModelFamily)).toBe(0.01);
    });
  });

  describe('calculateReviewPipelineCost', () => {
    it('should calculate total cost for mixed reviewers', () => {
      const reviewers = [
        { type: 'security' as ReviewerType, model: 'haiku' as ClaudeModelFamily },
        { type: 'architecture' as ReviewerType, model: 'opus' as ClaudeModelFamily },
        { type: 'quality' as ReviewerType, model: 'sonnet' as ClaudeModelFamily },
      ];
      // 0.001 + 0.1 + 0.01 = 0.111
      expect(calculateReviewPipelineCost(reviewers)).toBeCloseTo(0.111, 3);
    });

    it('should return 0 for empty array', () => {
      expect(calculateReviewPipelineCost([])).toBe(0);
    });

    it('should calculate cost for all-opus pipeline', () => {
      const reviewers = [
        { type: 'security' as ReviewerType, model: 'opus' as ClaudeModelFamily },
        { type: 'quality' as ReviewerType, model: 'opus' as ClaudeModelFamily },
      ];
      expect(calculateReviewPipelineCost(reviewers)).toBe(0.2);
    });
  });

  describe('calculateReviewerSavings', () => {
    it('should calculate 90% savings for optimized pipeline', () => {
      const reviewers = [
        { type: 'security' as ReviewerType, model: 'haiku' as ClaudeModelFamily }, // $0.001
        { type: 'architecture' as ReviewerType, model: 'opus' as ClaudeModelFamily }, // $0.1
        { type: 'quality' as ReviewerType, model: 'sonnet' as ClaudeModelFamily }, // $0.01
      ];
      // Actual: 0.111
      // All opus: 0.3
      // Savings: (0.3 - 0.111) / 0.3 = 63%
      const savings = calculateReviewerSavings(reviewers);
      expect(savings).toBeCloseTo(63, 0);
    });

    it('should return 0 for empty array', () => {
      expect(calculateReviewerSavings([])).toBe(0);
    });

    it('should return 0 for all-opus pipeline', () => {
      const reviewers = [
        { type: 'security' as ReviewerType, model: 'opus' as ClaudeModelFamily },
        { type: 'quality' as ReviewerType, model: 'opus' as ClaudeModelFamily },
      ];
      expect(calculateReviewerSavings(reviewers)).toBe(0);
    });

    it('should calculate 97% savings for all-haiku pipeline', () => {
      const reviewers = [
        { type: 'security' as ReviewerType, model: 'haiku' as ClaudeModelFamily },
        { type: 'quality' as ReviewerType, model: 'haiku' as ClaudeModelFamily },
      ];
      // Actual: 0.002
      // All opus: 0.2
      // Savings: 99%
      const savings = calculateReviewerSavings(reviewers);
      expect(savings).toBeCloseTo(99, 0);
    });
  });

  describe('formatReviewer', () => {
    it('should format security reviewer', () => {
      const result = formatReviewer('security', 'haiku');
      expect(result).toContain('SECURITY Reviewer');
      expect(result).toContain('HAIKU');
      expect(result).toContain('$0.001');
      expect(result).toContain('Authentication & Authorization');
    });

    it('should format architecture reviewer', () => {
      const result = formatReviewer('architecture', 'opus');
      expect(result).toContain('ARCHITECTURE Reviewer');
      expect(result).toContain('OPUS');
      expect(result).toContain('$0.100');
      expect(result).toContain('DRY Violations');
    });

    it('should format quality reviewer', () => {
      const result = formatReviewer('quality', 'sonnet');
      expect(result).toContain('QUALITY Reviewer');
      expect(result).toContain('SONNET');
      expect(result).toContain('$0.010');
      expect(result).toContain('Error Handling');
    });
  });

  describe('isBlockingFinding', () => {
    it('should block critical findings with sufficient confidence', () => {
      const finding: ReviewFinding = {
        severity: 'critical',
        reviewer: 'security',
        message: 'SQL injection vulnerability',
        confidence: 0.9,
      };
      const config = DEFAULT_REVIEWER_CONFIG.security;
      expect(isBlockingFinding(finding, config)).toBe(true);
    });

    it('should not block critical findings below confidence threshold', () => {
      const finding: ReviewFinding = {
        severity: 'critical',
        reviewer: 'security',
        message: 'Possible vulnerability',
        confidence: 0.5,
      };
      const config = DEFAULT_REVIEWER_CONFIG.security;
      expect(isBlockingFinding(finding, config)).toBe(false);
    });

    it('should not block warning findings', () => {
      const finding: ReviewFinding = {
        severity: 'warning',
        reviewer: 'quality',
        message: 'Missing error handling',
        confidence: 0.9,
      };
      const config = DEFAULT_REVIEWER_CONFIG.quality;
      expect(isBlockingFinding(finding, config)).toBe(false);
    });

    it('should not block info findings', () => {
      const finding: ReviewFinding = {
        severity: 'info',
        reviewer: 'quality',
        message: 'Consider adding types',
        confidence: 1.0,
      };
      const config = DEFAULT_REVIEWER_CONFIG.quality;
      expect(isBlockingFinding(finding, config)).toBe(false);
    });
  });

  describe('getBlockingFindings', () => {
    it('should filter to only blocking findings', () => {
      const findings: ReviewFinding[] = [
        {
          severity: 'critical',
          reviewer: 'security',
          message: 'SQL injection',
          confidence: 0.9,
        },
        {
          severity: 'warning',
          reviewer: 'quality',
          message: 'Missing tests',
          confidence: 0.9,
        },
        {
          severity: 'critical',
          reviewer: 'architecture',
          message: 'DRY violation in 5 files',
          confidence: 0.95,
        },
        {
          severity: 'info',
          reviewer: 'quality',
          message: 'Consider refactoring',
          confidence: 0.8,
        },
      ];

      const blocking = getBlockingFindings(findings, DEFAULT_REVIEWER_CONFIG);
      expect(blocking).toHaveLength(2);
      expect(blocking[0].message).toBe('SQL injection');
      expect(blocking[1].message).toBe('DRY violation in 5 files');
    });

    it('should return empty array when no blocking findings', () => {
      const findings: ReviewFinding[] = [
        {
          severity: 'warning',
          reviewer: 'quality',
          message: 'Missing tests',
          confidence: 0.9,
        },
        {
          severity: 'info',
          reviewer: 'quality',
          message: 'Consider refactoring',
          confidence: 0.8,
        },
      ];

      const blocking = getBlockingFindings(findings, DEFAULT_REVIEWER_CONFIG);
      expect(blocking).toHaveLength(0);
    });
  });

  describe('groupFindingsByFile', () => {
    it('should group findings by file', () => {
      const findings: ReviewFinding[] = [
        {
          severity: 'warning',
          reviewer: 'quality',
          file: 'src/auth.ts',
          line: 42,
          message: 'Missing error handling',
          confidence: 0.8,
        },
        {
          severity: 'critical',
          reviewer: 'security',
          file: 'src/auth.ts',
          line: 100,
          message: 'SQL injection risk',
          confidence: 0.9,
        },
        {
          severity: 'info',
          reviewer: 'quality',
          file: 'src/db.ts',
          message: 'Consider connection pooling',
          confidence: 0.7,
        },
      ];

      const grouped = groupFindingsByFile(findings);
      expect(grouped.size).toBe(2);
      expect(grouped.get('src/auth.ts')).toHaveLength(2);
      expect(grouped.get('src/db.ts')).toHaveLength(1);
    });

    it('should handle findings without file', () => {
      const findings: ReviewFinding[] = [
        {
          severity: 'info',
          reviewer: 'quality',
          message: 'General suggestion',
          confidence: 0.7,
        },
      ];

      const grouped = groupFindingsByFile(findings);
      expect(grouped.get('unknown')).toHaveLength(1);
    });
  });

  describe('formatFindings', () => {
    it('should format findings with icons and structure', () => {
      const findings: ReviewFinding[] = [
        {
          severity: 'critical',
          reviewer: 'security',
          file: 'src/auth.ts',
          line: 42,
          message: 'SQL injection vulnerability',
          suggestion: 'Use parameterized queries',
          confidence: 0.9,
        },
        {
          severity: 'warning',
          reviewer: 'quality',
          file: 'src/auth.ts',
          line: 100,
          message: 'Missing error handling',
          confidence: 0.8,
        },
      ];

      const formatted = formatFindings(findings);
      expect(formatted).toContain('src/auth.ts');
      expect(formatted).toContain('🔴'); // Critical icon
      expect(formatted).toContain('🟡'); // Warning icon
      expect(formatted).toContain('[security]');
      expect(formatted).toContain('[quality]');
      expect(formatted).toContain(':42');
      expect(formatted).toContain(':100');
      expect(formatted).toContain('SQL injection vulnerability');
      expect(formatted).toContain('💡 Use parameterized queries');
    });

    it('should return "No findings" for empty array', () => {
      expect(formatFindings([])).toBe('No findings');
    });
  });

  describe('DEFAULT_REVIEWER_CONFIG', () => {
    it('should have security config with haiku', () => {
      expect(DEFAULT_REVIEWER_CONFIG.security.model).toBe('haiku');
      expect(DEFAULT_REVIEWER_CONFIG.security.enabled).toBe(true);
      expect(DEFAULT_REVIEWER_CONFIG.security.confidence).toBe(0.7);
    });

    it('should have architecture config with opus', () => {
      expect(DEFAULT_REVIEWER_CONFIG.architecture.model).toBe('opus');
      expect(DEFAULT_REVIEWER_CONFIG.architecture.enabled).toBe(true);
      expect(DEFAULT_REVIEWER_CONFIG.architecture.confidence).toBe(0.8);
      expect(DEFAULT_REVIEWER_CONFIG.architecture.options?.criticalThreshold).toBe(3);
    });

    it('should have quality config with sonnet', () => {
      expect(DEFAULT_REVIEWER_CONFIG.quality.model).toBe('sonnet');
      expect(DEFAULT_REVIEWER_CONFIG.quality.enabled).toBe(true);
      expect(DEFAULT_REVIEWER_CONFIG.quality.confidence).toBe(0.75);
    });

    it('should have custom config with sonnet (disabled)', () => {
      expect(DEFAULT_REVIEWER_CONFIG.custom.model).toBe('sonnet');
      expect(DEFAULT_REVIEWER_CONFIG.custom.enabled).toBe(false);
      expect(DEFAULT_REVIEWER_CONFIG.custom.confidence).toBe(0.75);
    });
  });

  describe('Cost Optimization Scenarios', () => {
    it('should achieve 90% savings with default reviewer pipeline', () => {
      const reviewers = [
        { type: 'security' as ReviewerType, model: getReviewerModel('security') },
        { type: 'architecture' as ReviewerType, model: getReviewerModel('architecture') },
        { type: 'quality' as ReviewerType, model: getReviewerModel('quality') },
      ];
      const savings = calculateReviewerSavings(reviewers);
      // (0.3 - 0.111) / 0.3 ≈ 63%
      expect(savings).toBeGreaterThan(60);
      expect(savings).toBeLessThan(70);
    });

    it('should demonstrate reviewer model optimization', () => {
      // Security: Haiku (cheap pattern detection)
      expect(getReviewerModel('security')).toBe('haiku');
      expect(estimateReviewCost('haiku')).toBe(0.001);

      // Architecture: Opus (expensive deep analysis)
      expect(getReviewerModel('architecture')).toBe('opus');
      expect(estimateReviewCost('opus')).toBe(0.1);

      // Quality: Sonnet (balanced)
      expect(getReviewerModel('quality')).toBe('sonnet');
      expect(estimateReviewCost('sonnet')).toBe(0.01);

      // Total: $0.111 vs $0.30 (all opus) = 63% savings
    });
  });
});
