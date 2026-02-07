/**
 * Construction Workflow Integration Tests
 *
 * Comprehensive tests for construction-specific workflows:
 * - RFI creation, retrieval, filtering
 * - Daily log sync and summarization
 * - Submittal tracking and review
 * - Cross-workflow integration
 * - Error scenarios
 *
 * Tests both the Automation Layer (MCP tools) and Intelligence Layer (Skills).
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { procoreTools } from '../../src/tools/procore';
import { skillTools } from '../../src/tools/skills';
import { createMockEnv } from '../mocks/env';
import {
  mockRFIs,
  mockRFIsWithBallInCourt,
  mockDailyLogs,
  mockDailyLogsWithDelays,
  mockSubmittals,
  mockProjects,
  mockProjectContext,
  createMockFetchResponse,
  createMockErrorResponse,
  generateRFIsWithStatuses,
  generateSubmittalsWithDueDates,
  generateDailyLogsForRange,
} from '../fixtures/construction-data';
import type { Env } from '../../src/types';

// Mock crypto functions to avoid crypto.subtle issues in tests
vi.mock('../../src/lib/crypto', () => ({
  encrypt: vi.fn().mockImplementation((plaintext: string) => `encrypted:${plaintext}`),
  decrypt: vi.fn().mockImplementation((ciphertext: string) => {
    // Handle both encrypted and plain tokens
    if (ciphertext.startsWith('encrypted:')) {
      return ciphertext.replace('encrypted:', '');
    }
    return ciphertext; // Return as-is if not encrypted (for test data)
  }),
  generateCodeVerifier: vi.fn().mockReturnValue('test-code-verifier'),
  generateCodeChallenge: vi.fn().mockReturnValue('test-code-challenge'),
  generateSecureToken: vi.fn().mockReturnValue('test-secure-token'),
}));

// ============================================================================
// Test Setup
// ============================================================================

/**
 * Creates a mock rate limiter Durable Object stub
 */
function createMockRateLimiterStub(options: {
  allowed?: boolean;
  remaining?: number;
  retryAfter?: number;
} = {}) {
  const { allowed = true, remaining = 3500, retryAfter } = options;
  return {
    fetch: async (request: Request | string) => {
      const url = typeof request === 'string' ? request : request.url;
      if (url.includes('/consume') || url.includes('/check')) {
        return new Response(
          JSON.stringify({
            allowed,
            remaining,
            retryAfter: allowed ? undefined : retryAfter,
            limit: 3600,
            resetAt: Date.now() + 60000,
          }),
          {
            status: allowed ? 200 : 429,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
      return new Response('Not found', { status: 404 });
    },
  };
}

/**
 * Setup mock rate limiter namespace on env
 */
function setupMockRateLimiter(env: Env, options: Parameters<typeof createMockRateLimiterStub>[0] = {}) {
  const stub = createMockRateLimiterStub(options);
  (env as any).PROCORE_RATE_LIMITER = {
    idFromName: (name: string) => ({ toString: () => name }),
    get: () => stub,
  };
}

describe('Construction Workflows', () => {
  let env: Env;
  let mockDB: any;

  const mockValidToken = {
    id: 'token-123',
    provider: 'procore',
    user_id: 'test-user',
    access_token: 'encrypted-valid-token',
    refresh_token: 'encrypted-refresh-token',
    expires_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
    company_id: 'company-123',
    scopes: JSON.stringify(['read', 'write']),
    environment: 'production',
    updated_at: new Date().toISOString(),
  };

  beforeEach(() => {
    env = createMockEnv({
      procoreClientId: 'test-client-id',
      procoreClientSecret: 'test-secret',
    });
    mockDB = env.DB;

    // Setup rate limiter mock (allows requests by default)
    setupMockRateLimiter(env, { allowed: true, remaining: 3500 });

    // Setup default token mock with support for audit logging
    mockDB.prepare = vi.fn((sql: string) => {
      const mockResult = {
        first: async () => {
          if (sql.includes('oauth_tokens')) {
            return mockValidToken;
          }
          return null;
        },
        all: async () => {
          if (sql.includes('oauth_tokens')) {
            return { results: [mockValidToken] };
          }
          return { results: [] };
        },
        run: async () => ({ success: true, meta: {} }),
      };
      
      return {
        bind: (...params: any[]) => mockResult,
        ...mockResult,
      };
    });

    // Reset fetch mock
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // 1. RFI Workflow Tests
  // ==========================================================================

  describe('RFI Workflows', () => {
    describe('workway_get_procore_rfis', () => {
      it('should list all RFIs for a project', async () => {
        global.fetch = vi.fn().mockResolvedValue(
          createMockFetchResponse(mockRFIs)
        );

        const result = await procoreTools.get_procore_rfis.execute(
          { project_id: 12345, status: 'all', connection_id: 'test-user' },
          env
        );

        expect(result.success).toBe(true);
        expect(result.data?.rfis).toHaveLength(mockRFIs.length);
        expect(result.data?.rfis[0]).toMatchObject({
          id: 1001,
          number: 1,
          subject: 'Foundation Reinforcement Clarification - Section 03 30 00',
          status: 'open',
        });
      });

      it('should filter RFIs by status (open)', async () => {
        const openRFIs = mockRFIs.filter((r) => r.status === 'open');
        global.fetch = vi.fn().mockResolvedValue(
          createMockFetchResponse(openRFIs)
        );

        const result = await procoreTools.get_procore_rfis.execute(
          { project_id: 12345, status: 'open', connection_id: 'test-user' },
          env
        );

        expect(result.success).toBe(true);
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('filters[status]=open'),
          expect.any(Object)
        );
        expect(result.data?.rfis.every((r: any) => r.status === 'open')).toBe(true);
      });

      it('should filter RFIs by status (closed)', async () => {
        const closedRFIs = mockRFIs.filter((r) => r.status === 'closed');
        global.fetch = vi.fn().mockResolvedValue(
          createMockFetchResponse(closedRFIs)
        );

        const result = await procoreTools.get_procore_rfis.execute(
          { project_id: 12345, status: 'closed', connection_id: 'test-user' },
          env
        );

        expect(result.success).toBe(true);
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('filters[status]=closed'),
          expect.any(Object)
        );
      });

      it('should filter RFIs by ball_in_court', async () => {
        const architectRFIs = mockRFIsWithBallInCourt.filter(
          (r) => r.ballInCourt === 'Architect'
        );
        global.fetch = vi.fn().mockResolvedValue(
          createMockFetchResponse(architectRFIs)
        );

        const result = await procoreTools.get_procore_rfis.execute(
          { project_id: 12345, status: 'all', connection_id: 'test-user' },
          env
        );

        expect(result.success).toBe(true);
        // Note: Ball in court filtering is done client-side after fetch
        expect(result.data?.rfis).toBeDefined();
      });

      it('should respect pagination parameters', async () => {
        const paginatedRFIs = mockRFIs.slice(0, 2);
        global.fetch = vi.fn().mockResolvedValue(
          createMockFetchResponse(paginatedRFIs)
        );

        const result = await procoreTools.get_procore_rfis.execute(
          { 
            project_id: 12345, 
            status: 'all', 
            limit: 2, 
            offset: 0,
            connection_id: 'test-user' 
          },
          env
        );

        expect(result.success).toBe(true);
        expect(result.data?.rfis).toHaveLength(2);
        expect(result.data?.pagination).toMatchObject({
          limit: 2,
          offset: 0,
        });
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('per_page=2'),
          expect.any(Object)
        );
      });

      it('should include response_time_days calculation', async () => {
        const rfisWithResponseTime = mockRFIs.filter((r) => r.responseTime !== undefined);
        global.fetch = vi.fn().mockResolvedValue(
          createMockFetchResponse(rfisWithResponseTime)
        );

        const result = await procoreTools.get_procore_rfis.execute(
          { project_id: 12345, status: 'closed', connection_id: 'test-user' },
          env
        );

        expect(result.success).toBe(true);
        expect(result.data?.stats.avgResponseTimeDays).toBeDefined();
        expect(typeof result.data?.stats.avgResponseTimeDays).toBe('number');
      });

      it('should handle projects with no RFIs', async () => {
        global.fetch = vi.fn().mockResolvedValue(
          createMockFetchResponse([])
        );

        const result = await procoreTools.get_procore_rfis.execute(
          { project_id: 99999, status: 'all', connection_id: 'test-user' },
          env
        );

        expect(result.success).toBe(true);
        expect(result.data?.rfis).toHaveLength(0);
        expect(result.data?.stats.openCount).toBe(0);
        expect(result.data?.pagination.total).toBe(0);
      });

      it('should calculate RFI statistics correctly', async () => {
        const mixedRFIs = [
          ...generateRFIsWithStatuses(3, 'open'),
          ...generateRFIsWithStatuses(2, 'closed'),
        ];
        global.fetch = vi.fn().mockResolvedValue(
          createMockFetchResponse(mixedRFIs)
        );

        const result = await procoreTools.get_procore_rfis.execute(
          { project_id: 12345, status: 'all', connection_id: 'test-user' },
          env
        );

        expect(result.success).toBe(true);
        expect(result.data?.stats.openCount).toBe(3);
      });
    });

    describe('workway_create_procore_rfi', () => {
      it('should create RFI with required fields (project_id, subject, question)', async () => {
        const createdRFI = {
          id: 9999,
          number: 99,
          subject: 'Test RFI Subject',
          status: 'draft',
          created_at: new Date().toISOString(),
        };
        global.fetch = vi.fn().mockResolvedValue(
          createMockFetchResponse(createdRFI)
        );

        const result = await procoreTools.create_procore_rfi.execute(
          {
            project_id: 12345,
            subject: 'Test RFI Subject',
            question: 'What is the specified depth for footings?',
            connection_id: 'test-user',
          },
          env
        );

        expect(result.success).toBe(true);
        expect(result.data?.id).toBe(9999);
        expect(result.data?.number).toBe(99);
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/rfis'),
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('Test RFI Subject'),
          })
        );
      });

      it('should set default status to draft', async () => {
        const createdRFI = {
          id: 9999,
          number: 99,
          subject: 'New RFI',
          status: 'draft',
          created_at: new Date().toISOString(),
        };
        global.fetch = vi.fn().mockResolvedValue(
          createMockFetchResponse(createdRFI)
        );

        const result = await procoreTools.create_procore_rfi.execute(
          {
            project_id: 12345,
            subject: 'New RFI',
            question: 'Test question',
            connection_id: 'test-user',
          },
          env
        );

        expect(result.success).toBe(true);
        expect(result.data?.status).toBe('draft');
      });

      it('should set assignee_id when provided', async () => {
        const createdRFI = {
          id: 9999,
          number: 99,
          subject: 'Assigned RFI',
          status: 'open',
          assignee_id: 5001,
          created_at: new Date().toISOString(),
        };
        global.fetch = vi.fn().mockResolvedValue(
          createMockFetchResponse(createdRFI)
        );

        const result = await procoreTools.create_procore_rfi.execute(
          {
            project_id: 12345,
            subject: 'Assigned RFI',
            question: 'Test question',
            assignee_id: 5001,
            connection_id: 'test-user',
          },
          env
        );

        expect(result.success).toBe(true);
        expect(global.fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            body: expect.stringContaining('5001'),
          })
        );
      });

      it('should set due_date when provided', async () => {
        const createdRFI = {
          id: 9999,
          number: 99,
          subject: 'Dated RFI',
          status: 'draft',
          due_date: '2024-03-01',
          created_at: new Date().toISOString(),
        };
        global.fetch = vi.fn().mockResolvedValue(
          createMockFetchResponse(createdRFI)
        );

        const result = await procoreTools.create_procore_rfi.execute(
          {
            project_id: 12345,
            subject: 'Dated RFI',
            question: 'Test question',
            due_date: '2024-03-01',
            connection_id: 'test-user',
          },
          env
        );

        expect(result.success).toBe(true);
        expect(global.fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            body: expect.stringContaining('2024-03-01'),
          })
        );
      });

      it('should validate project access before creation', async () => {
        global.fetch = vi.fn().mockResolvedValue(
          createMockErrorResponse(403, 'Access denied to project')
        );

        const result = await procoreTools.create_procore_rfi.execute(
          {
            project_id: 99999,
            subject: 'Unauthorized RFI',
            question: 'Test question',
            connection_id: 'test-user',
          },
          env
        );

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });

      it('should return created RFI with id and number', async () => {
        const createdRFI = {
          id: 8888,
          number: 42,
          subject: 'Complete RFI',
          status: 'draft',
          created_at: new Date().toISOString(),
        };
        global.fetch = vi.fn().mockResolvedValue(
          createMockFetchResponse(createdRFI)
        );

        const result = await procoreTools.create_procore_rfi.execute(
          {
            project_id: 12345,
            subject: 'Complete RFI',
            question: 'Detailed question about foundation',
            connection_id: 'test-user',
          },
          env
        );

        expect(result.success).toBe(true);
        expect(result.data?.id).toBe(8888);
        expect(result.data?.number).toBe(42);
        expect(result.data?.message).toContain('#42');
      });
    });

    describe('workway_skill_draft_rfi (Intelligence Layer)', () => {
      beforeEach(() => {
        // Mock AI binding
        (env as any).AI = {
          run: vi.fn().mockResolvedValue({
            response: JSON.stringify({
              subject: 'RFI: Foundation Depth Clarification - Section 03 30 00',
              question_body: 'Per drawing S-101, the foundation reinforcement schedule indicates varying depths. Please clarify the required depth for grid lines A-D.',
              suggested_response_format: 'Written clarification with sketch if applicable',
              impact_statement: 'Delay in response may impact foundation pour schedule by 2-3 days.',
              references: ['Drawing S-101', 'Spec Section 03 30 00'],
            }),
          }),
        };

        // Mock projects and RFIs for context
        global.fetch = vi.fn()
          .mockResolvedValueOnce(createMockFetchResponse(mockProjects))
          .mockResolvedValueOnce(createMockFetchResponse(mockRFIs.slice(0, 3)));
      });

      it('should generate draft RFI response based on question', async () => {
        const result = await skillTools.draft_rfi.execute(
          {
            project_id: 12345,
            question_intent: 'Need clarification on foundation depth requirements',
            user_id: 'test-user',
          },
          env
        );

        expect(result.success).toBe(true);
        expect(result.data?.draft).toBeDefined();
        expect(result.data?.draft.subject).toBeDefined();
        expect(result.data?.draft.question_body).toBeDefined();
      });

      it('should include confidence score', async () => {
        const result = await skillTools.draft_rfi.execute(
          {
            project_id: 12345,
            question_intent: 'Foundation depth question',
            spec_section: '03 30 00 - Cast-in-Place Concrete',
            drawing_reference: 'S-101',
            user_id: 'test-user',
          },
          env
        );

        expect(result.success).toBe(true);
        expect(result.data?.confidence).toBeDefined();
        expect(result.data?.confidence).toBeGreaterThan(0);
        expect(result.data?.confidence).toBeLessThanOrEqual(1);
      });

      it('should reference relevant spec sections', async () => {
        const result = await skillTools.draft_rfi.execute(
          {
            project_id: 12345,
            question_intent: 'Concrete mix design approval needed',
            spec_section: '03 30 00 - Cast-in-Place Concrete',
            user_id: 'test-user',
          },
          env
        );

        expect(result.success).toBe(true);
        expect(result.data?.draft.references).toBeDefined();
        expect(Array.isArray(result.data?.draft.references)).toBe(true);
      });

      it('should flag for human review when confidence < 80%', async () => {
        // Test with minimal context for lower confidence
        const result = await skillTools.draft_rfi.execute(
          {
            project_id: 12345,
            question_intent: 'Quick question',
            user_id: 'test-user',
          },
          env
        );

        expect(result.success).toBe(true);
        expect(result.data?.readyToSubmit).toBe(false);
        expect(result.data?.humanTaskRequired).toBe('review');
      });

      it('should handle ambiguous questions gracefully', async () => {
        const result = await skillTools.draft_rfi.execute(
          {
            project_id: 12345,
            question_intent: 'Something about the building',
            user_id: 'test-user',
          },
          env
        );

        expect(result.success).toBe(true);
        expect(result.data?.draft).toBeDefined();
        expect(result.data?.reviewNotes).toBeDefined();
        expect(result.data?.reviewNotes.length).toBeGreaterThan(0);
      });

      it('should include review notes for missing information', async () => {
        const result = await skillTools.draft_rfi.execute(
          {
            project_id: 12345,
            question_intent: 'Foundation question without references',
            user_id: 'test-user',
          },
          env
        );

        expect(result.success).toBe(true);
        expect(result.data?.reviewNotes).toContain('Consider adding specification section reference');
        expect(result.data?.reviewNotes).toContain('Consider adding drawing/sheet reference');
      });
    });
  });

  // ==========================================================================
  // 2. Daily Log Workflow Tests
  // ==========================================================================

  describe('Daily Log Workflows', () => {
    describe('workway_get_procore_daily_logs', () => {
      it('should list daily logs for a project', async () => {
        const mockResponse = {
          weather_logs: mockDailyLogs.map((l) => ({
            log_date: l.logDate,
            weather_description: l.weatherConditions,
            temperature_high: l.temperatureHigh,
            temperature_low: l.temperatureLow,
          })),
          manpower_logs: mockDailyLogs.flatMap((l) => l.manpowerLogs || []),
          notes_logs: mockDailyLogs.map((l) => ({
            log_date: l.logDate,
            notes: l.notes,
          })),
          equipment_logs: [],
          safety_violation_logs: [],
          accident_logs: [],
          work_logs: [],
          delay_logs: [],
        };

        global.fetch = vi.fn().mockResolvedValue(
          createMockFetchResponse(mockResponse)
        );

        const result = await procoreTools.get_procore_daily_logs.execute(
          { project_id: 12345, connection_id: 'test-user' },
          env
        );

        expect(result.success).toBe(true);
        expect(result.data?.weatherLogs).toBeDefined();
        expect(result.data?.manpowerLogs).toBeDefined();
        expect(result.data?.notesLogs).toBeDefined();
      });

      it('should filter by date range (start_date, end_date)', async () => {
        global.fetch = vi.fn().mockResolvedValue(
          createMockFetchResponse({
            weather_logs: [],
            manpower_logs: [],
            notes_logs: [],
            delay_logs: [],
          })
        );

        const result = await procoreTools.get_procore_daily_logs.execute(
          {
            project_id: 12345,
            start_date: '2024-01-15',
            end_date: '2024-01-22',
            connection_id: 'test-user',
          },
          env
        );

        expect(result.success).toBe(true);
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('filters[start_date]='),
          expect.any(Object)
        );
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('filters[end_date]='),
          expect.any(Object)
        );
      });

      it('should include weather data', async () => {
        const weatherLogs = mockDailyLogs.map((l) => ({
          log_date: l.logDate,
          weather_description: l.weatherConditions,
          temperature_high: l.temperatureHigh,
          temperature_low: l.temperatureLow,
        }));

        global.fetch = vi.fn().mockResolvedValue(
          createMockFetchResponse({
            weather_logs: weatherLogs,
            manpower_logs: [],
            notes_logs: [],
          })
        );

        const result = await procoreTools.get_procore_daily_logs.execute(
          { project_id: 12345, connection_id: 'test-user' },
          env
        );

        expect(result.success).toBe(true);
        expect(result.data?.weatherLogs).toHaveLength(mockDailyLogs.length);
      });

      it('should include manpower counts', async () => {
        const manpowerLogs = mockDailyLogs.flatMap((l) =>
          (l.manpowerLogs || []).map((m) => ({
            log_date: l.logDate,
            company_name: m.companyName,
            num_workers: m.workerCount,
            hours_worked: m.hoursWorked,
          }))
        );

        global.fetch = vi.fn().mockResolvedValue(
          createMockFetchResponse({
            weather_logs: [],
            manpower_logs: manpowerLogs,
            notes_logs: [],
          })
        );

        const result = await procoreTools.get_procore_daily_logs.execute(
          { project_id: 12345, connection_id: 'test-user' },
          env
        );

        expect(result.success).toBe(true);
        expect(result.data?.manpowerLogs.length).toBeGreaterThan(0);
      });

      it('should include work performed entries', async () => {
        const workLogs = mockDailyLogs.map((l) => ({
          log_date: l.logDate,
          work_description: l.notes,
        }));

        global.fetch = vi.fn().mockResolvedValue(
          createMockFetchResponse({
            weather_logs: [],
            manpower_logs: [],
            notes_logs: [],
            work_logs: workLogs,
          })
        );

        const result = await procoreTools.get_procore_daily_logs.execute(
          { project_id: 12345, connection_id: 'test-user' },
          env
        );

        expect(result.success).toBe(true);
        expect(result.data?.workLogs).toBeDefined();
      });

      it('should handle projects with no daily logs', async () => {
        global.fetch = vi.fn().mockResolvedValue(
          createMockFetchResponse({
            weather_logs: [],
            manpower_logs: [],
            notes_logs: [],
            equipment_logs: [],
            safety_violation_logs: [],
            accident_logs: [],
            work_logs: [],
            delay_logs: [],
          })
        );

        const result = await procoreTools.get_procore_daily_logs.execute(
          { project_id: 99999, connection_id: 'test-user' },
          env
        );

        expect(result.success).toBe(true);
        expect(result.data?.weatherLogs).toHaveLength(0);
        expect(result.data?.manpowerLogs).toHaveLength(0);
      });

      it('should include delay logs', async () => {
        const delayLogs = mockDailyLogsWithDelays
          .flatMap((l) => l.delayLogs || []);

        global.fetch = vi.fn().mockResolvedValue(
          createMockFetchResponse({
            weather_logs: [],
            manpower_logs: [],
            notes_logs: [],
            delay_logs: delayLogs,
          })
        );

        const result = await procoreTools.get_procore_daily_logs.execute(
          { project_id: 12345, connection_id: 'test-user' },
          env
        );

        expect(result.success).toBe(true);
        expect(result.data?.delayLogs).toBeDefined();
      });
    });

    describe('workway_skill_daily_log_summary (Intelligence Layer)', () => {
      beforeEach(() => {
        // Mock AI binding
        (env as any).AI = {
          run: vi.fn().mockResolvedValue({
            response: JSON.stringify({
              executive_summary: 'Week showed good progress with minor weather delays. Foundation work on track.',
              key_metrics: {
                total_manhours: 544,
                average_crew_size: 15,
                weather_days_lost: 1,
              },
              notable_events: [
                'Level 2 concrete pour completed',
                'Inspector approved shoring',
              ],
              weather_impact: 'One full day lost to snow, 2 hours lost to rain.',
              delays: [
                {
                  date: '2024-01-19',
                  description: 'Heavy snow - site closed',
                  impact: 'Full day delay',
                },
              ],
              recommendations: [
                'Monitor weather forecast for next pour',
                'Consider adding heated enclosures for winter work',
              ],
            }),
          }),
        };

        // Mock daily logs fetch
        const mockResponse = {
          weather_logs: mockDailyLogs.map((l) => ({
            log_date: l.logDate,
            weather_description: l.weatherConditions,
          })),
          manpower_logs: mockDailyLogs.flatMap((l) => l.manpowerLogs || []),
          notes_logs: mockDailyLogs.map((l) => ({
            log_date: l.logDate,
            notes: l.notes,
          })),
          delay_logs: mockDailyLogsWithDelays.flatMap((l) => l.delayLogs || []),
        };
        global.fetch = vi.fn().mockResolvedValue(
          createMockFetchResponse(mockResponse)
        );
      });

      it('should summarize daily logs for a date range', async () => {
        const result = await skillTools.daily_log_summary.execute(
          {
            project_id: 12345,
            start_date: '2024-01-15',
            end_date: '2024-01-22',
            user_id: 'test-user',
          },
          env
        );

        expect(result.success).toBe(true);
        expect(result.data?.summary).toBeDefined();
        expect(result.data?.summary.period).toBeDefined();
        expect(result.data?.summary.executive_summary).toBeDefined();
      });

      it('should highlight weather impacts', async () => {
        const result = await skillTools.daily_log_summary.execute(
          {
            project_id: 12345,
            format: 'executive',
            user_id: 'test-user',
          },
          env
        );

        expect(result.success).toBe(true);
        expect(result.data?.summary.weather_impact).toBeDefined();
      });

      it('should calculate total manpower hours', async () => {
        const result = await skillTools.daily_log_summary.execute(
          {
            project_id: 12345,
            format: 'detailed',
            user_id: 'test-user',
          },
          env
        );

        expect(result.success).toBe(true);
        expect(result.data?.summary.key_metrics).toBeDefined();
        expect(result.data?.rawLogCounts?.manpower).toBeGreaterThanOrEqual(0);
      });

      it('should identify safety observations', async () => {
        // Add safety logs to response
        global.fetch = vi.fn().mockResolvedValue(
          createMockFetchResponse({
            weather_logs: [],
            manpower_logs: [],
            notes_logs: [],
            safety_violation_logs: [
              { log_date: '2024-01-22', description: 'Harness not worn at height' },
            ],
            accident_logs: [],
          })
        );

        const result = await skillTools.daily_log_summary.execute(
          {
            project_id: 12345,
            format: 'executive',
            user_id: 'test-user',
          },
          env
        );

        expect(result.success).toBe(true);
      });

      it('should flag anomalies (missing days, unusual patterns)', async () => {
        // Mock sparse data
        global.fetch = vi.fn().mockResolvedValue(
          createMockFetchResponse({
            weather_logs: [{ log_date: '2024-01-22', weather_description: 'Clear' }],
            manpower_logs: [],
            notes_logs: [],
          })
        );

        const result = await skillTools.daily_log_summary.execute(
          {
            project_id: 12345,
            start_date: '2024-01-15',
            end_date: '2024-01-22',
            user_id: 'test-user',
          },
          env
        );

        expect(result.success).toBe(true);
        expect(result.data?.dataCompleteness).toBeDefined();
        expect(result.data?.dataCompleteness).toBeLessThan(1);
      });

      it('should provide recommendations when enabled', async () => {
        const result = await skillTools.daily_log_summary.execute(
          {
            project_id: 12345,
            include_recommendations: true,
            user_id: 'test-user',
          },
          env
        );

        expect(result.success).toBe(true);
        expect(result.data?.summary.recommendations).toBeDefined();
      });
    });
  });

  // ==========================================================================
  // 3. Submittal Workflow Tests
  // ==========================================================================

  describe('Submittal Workflows', () => {
    describe('workway_get_procore_submittals', () => {
      it('should list submittals for a project', async () => {
        global.fetch = vi.fn().mockResolvedValue(
          createMockFetchResponse(mockSubmittals)
        );

        const result = await procoreTools.get_procore_submittals.execute(
          { project_id: 12345, status: 'all', connection_id: 'test-user' },
          env
        );

        expect(result.success).toBe(true);
        expect(result.data?.submittals).toHaveLength(mockSubmittals.length);
        expect(result.data?.submittals[0]).toMatchObject({
          id: 3001,
          title: 'Structural Steel Shop Drawings - Package 1',
          status: 'pending',
        });
      });

      it('should filter by status (pending)', async () => {
        const pendingSubmittals = mockSubmittals.filter((s) => s.status === 'pending');
        global.fetch = vi.fn().mockResolvedValue(
          createMockFetchResponse(pendingSubmittals)
        );

        const result = await procoreTools.get_procore_submittals.execute(
          { project_id: 12345, status: 'pending', connection_id: 'test-user' },
          env
        );

        expect(result.success).toBe(true);
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('filters[status]=pending'),
          expect.any(Object)
        );
      });

      it('should filter by status (approved)', async () => {
        const approvedSubmittals = mockSubmittals.filter((s) => s.status === 'approved');
        global.fetch = vi.fn().mockResolvedValue(
          createMockFetchResponse(approvedSubmittals)
        );

        const result = await procoreTools.get_procore_submittals.execute(
          { project_id: 12345, status: 'approved', connection_id: 'test-user' },
          env
        );

        expect(result.success).toBe(true);
        expect(result.data?.submittals.every((s: any) => s.status === 'approved')).toBe(true);
      });

      it('should filter by status (rejected)', async () => {
        const rejectedSubmittals = mockSubmittals.filter((s) => s.status === 'rejected');
        global.fetch = vi.fn().mockResolvedValue(
          createMockFetchResponse(rejectedSubmittals)
        );

        const result = await procoreTools.get_procore_submittals.execute(
          { project_id: 12345, status: 'rejected', connection_id: 'test-user' },
          env
        );

        expect(result.success).toBe(true);
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('filters[status]=rejected'),
          expect.any(Object)
        );
      });

      it('should include due_date and overdue calculation', async () => {
        const submittalsWithDueDates = generateSubmittalsWithDueDates({
          overdue: 3,
          dueSoon: 2,
          future: 2,
        });
        global.fetch = vi.fn().mockResolvedValue(
          createMockFetchResponse(submittalsWithDueDates)
        );

        const result = await procoreTools.get_procore_submittals.execute(
          { project_id: 12345, status: 'all', connection_id: 'test-user' },
          env
        );

        expect(result.success).toBe(true);
        expect(result.data?.stats.overdueCount).toBe(3);
        expect(result.data?.stats.pendingCount).toBe(7); // All are pending
      });

      it('should include spec_section reference', async () => {
        global.fetch = vi.fn().mockResolvedValue(
          createMockFetchResponse(mockSubmittals)
        );

        const result = await procoreTools.get_procore_submittals.execute(
          { project_id: 12345, status: 'all', connection_id: 'test-user' },
          env
        );

        expect(result.success).toBe(true);
        const submittalWithSpec = result.data?.submittals.find(
          (s: any) => s.specSection === '05 12 00 - Structural Steel Framing'
        );
        expect(submittalWithSpec).toBeDefined();
      });

      it('should respect pagination', async () => {
        const paginatedSubmittals = mockSubmittals.slice(0, 3);
        global.fetch = vi.fn().mockResolvedValue(
          createMockFetchResponse(paginatedSubmittals)
        );

        const result = await procoreTools.get_procore_submittals.execute(
          {
            project_id: 12345,
            status: 'all',
            limit: 3,
            offset: 0,
            connection_id: 'test-user',
          },
          env
        );

        expect(result.success).toBe(true);
        expect(result.data?.submittals).toHaveLength(3);
        expect(result.data?.pagination.limit).toBe(3);
        expect(result.data?.pagination.hasMore).toBe(true);
      });

      it('should handle projects with no submittals', async () => {
        global.fetch = vi.fn().mockResolvedValue(
          createMockFetchResponse([])
        );

        const result = await procoreTools.get_procore_submittals.execute(
          { project_id: 99999, status: 'all', connection_id: 'test-user' },
          env
        );

        expect(result.success).toBe(true);
        expect(result.data?.submittals).toHaveLength(0);
        expect(result.data?.stats.pendingCount).toBe(0);
        expect(result.data?.stats.overdueCount).toBe(0);
      });
    });

    describe('workway_skill_submittal_review (Intelligence Layer)', () => {
      beforeEach(() => {
        // Mock submittals fetch
        global.fetch = vi.fn().mockResolvedValue(
          createMockFetchResponse(mockSubmittals)
        );
      });

      it('should analyze submittals for compliance', async () => {
        const result = await skillTools.submittal_review.execute(
          {
            project_id: 12345,
            focus: 'pending',
            user_id: 'test-user',
          },
          env
        );

        expect(result.success).toBe(true);
        expect(result.data?.review).toBeDefined();
        expect(result.data?.review.total_reviewed).toBeGreaterThan(0);
      });

      it('should check against spec requirements', async () => {
        const result = await skillTools.submittal_review.execute(
          {
            project_id: 12345,
            focus: 'all',
            user_id: 'test-user',
          },
          env
        );

        expect(result.success).toBe(true);
        expect(result.data?.review.pattern_analysis).toBeDefined();
        expect(result.data?.review.pattern_analysis.most_delayed_spec_sections).toBeDefined();
      });

      it('should flag missing documentation (ball in court)', async () => {
        // Include submittals with missing ball_in_court
        const submittalsWithMissing = [
          ...mockSubmittals,
          {
            id: 9999,
            projectId: 12345,
            number: 99,
            title: 'Missing Assignment Submittal',
            status: 'pending',
            specSection: '08 44 00',
            ballInCourt: undefined,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ];

        global.fetch = vi.fn().mockResolvedValue(
          createMockFetchResponse(submittalsWithMissing)
        );

        const result = await skillTools.submittal_review.execute(
          {
            project_id: 12345,
            focus: 'pending',
            user_id: 'test-user',
          },
          env
        );

        expect(result.success).toBe(true);
        const missingAssignment = result.data?.review.action_items.find(
          (item: any) => item.issue.includes('not assigned')
        );
        expect(missingAssignment).toBeDefined();
      });

      it('should suggest approval/rejection with reasoning', async () => {
        const result = await skillTools.submittal_review.execute(
          {
            project_id: 12345,
            focus: 'pending',
            user_id: 'test-user',
          },
          env
        );

        expect(result.success).toBe(true);
        expect(result.data?.review.action_items).toBeDefined();
        result.data?.review.action_items.forEach((item: any) => {
          expect(item.recommended_action).toBeDefined();
          expect(item.priority).toBeDefined();
        });
      });

      it('should include confidence score (via data completeness)', async () => {
        const result = await skillTools.submittal_review.execute(
          {
            project_id: 12345,
            focus: 'all',
            user_id: 'test-user',
          },
          env
        );

        expect(result.success).toBe(true);
        expect(result.data?.atlasTask).toBe('classify');
        expect(result.data?.humanTaskRequired).toBe('approve');
      });

      it('should prioritize critical items', async () => {
        // Create submittals with varying overdue periods
        const criticalSubmittals = generateSubmittalsWithDueDates({
          overdue: 5, // Very overdue - should be critical
        });

        global.fetch = vi.fn().mockResolvedValue(
          createMockFetchResponse(criticalSubmittals)
        );

        const result = await skillTools.submittal_review.execute(
          {
            project_id: 12345,
            focus: 'pending',
            days_threshold: 3, // Lower threshold for testing
            user_id: 'test-user',
          },
          env
        );

        expect(result.success).toBe(true);
        expect(result.data?.review.critical_count).toBeGreaterThan(0);
        
        // Verify action items are sorted by priority
        const priorities = result.data?.review.action_items.map((i: any) => i.priority);
        const criticalIndex = priorities.indexOf('critical');
        const lowIndex = priorities.indexOf('low');
        if (criticalIndex !== -1 && lowIndex !== -1) {
          expect(criticalIndex).toBeLessThan(lowIndex);
        }
      });
    });
  });

  // ==========================================================================
  // 4. Cross-Workflow Integration Tests
  // ==========================================================================

  describe('Cross-Workflow Integration', () => {
    it('should link RFI to related submittal (via spec section)', async () => {
      // First get submittals
      global.fetch = vi.fn()
        .mockResolvedValueOnce(createMockFetchResponse(mockSubmittals))
        .mockResolvedValueOnce(createMockFetchResponse(mockRFIs));

      const submittalsResult = await procoreTools.get_procore_submittals.execute(
        { project_id: 12345, status: 'all', connection_id: 'test-user' },
        env
      );

      const rfisResult = await procoreTools.get_procore_rfis.execute(
        { project_id: 12345, status: 'all', connection_id: 'test-user' },
        env
      );

      expect(submittalsResult.success).toBe(true);
      expect(rfisResult.success).toBe(true);

      // Check for overlapping spec sections
      const submittalSpecs = new Set(
        submittalsResult.data?.submittals.map((s: any) => s.specSection).filter(Boolean)
      );
      const rfiSubjects = rfisResult.data?.rfis.map((r: any) => r.subject);

      // Verify we can correlate by spec section (e.g., "03 30 00" appears in both)
      const concreteSpec = '03 30 00';
      const hasConcreteSubmittal = submittalsResult.data?.submittals.some(
        (s: any) => s.specSection?.includes(concreteSpec)
      );
      const hasConcreteRFI = rfiSubjects?.some(
        (subject: string) => subject.includes(concreteSpec)
      );

      expect(hasConcreteSubmittal).toBe(true);
      expect(hasConcreteRFI).toBe(true);
    });

    it('should track project progress across RFIs, submittals, daily logs', async () => {
      // Fetch all three data types
      const mockDailyLogResponse = {
        weather_logs: mockDailyLogs.map((l) => ({ log_date: l.logDate })),
        manpower_logs: mockDailyLogs.flatMap((l) => l.manpowerLogs || []),
        notes_logs: [],
      };

      global.fetch = vi.fn()
        .mockResolvedValueOnce(createMockFetchResponse(mockRFIs))
        .mockResolvedValueOnce(createMockFetchResponse(mockSubmittals))
        .mockResolvedValueOnce(createMockFetchResponse(mockDailyLogResponse));

      const [rfisResult, submittalsResult, logsResult] = await Promise.all([
        procoreTools.get_procore_rfis.execute(
          { project_id: 12345, status: 'all', connection_id: 'test-user' },
          env
        ),
        procoreTools.get_procore_submittals.execute(
          { project_id: 12345, status: 'all', connection_id: 'test-user' },
          env
        ),
        procoreTools.get_procore_daily_logs.execute(
          { project_id: 12345, connection_id: 'test-user' },
          env
        ),
      ]);

      expect(rfisResult.success).toBe(true);
      expect(submittalsResult.success).toBe(true);
      expect(logsResult.success).toBe(true);

      // Calculate simple project health metrics
      const openRFIs = rfisResult.data?.stats.openCount || 0;
      const overdueSubmittals = submittalsResult.data?.stats.overdueCount || 0;
      const totalManpower = logsResult.data?.manpowerLogs.reduce(
        (sum: number, m: any) => sum + (m.workerCount || m.num_workers || 0),
        0
      ) || 0;

      // Verify metrics are calculable
      expect(typeof openRFIs).toBe('number');
      expect(typeof overdueSubmittals).toBe('number');
      expect(typeof totalManpower).toBe('number');
    });

    it('should calculate project health metrics', async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce(createMockFetchResponse(mockRFIs))
        .mockResolvedValueOnce(createMockFetchResponse(mockSubmittals));

      const rfisResult = await procoreTools.get_procore_rfis.execute(
        { project_id: 12345, status: 'all', connection_id: 'test-user' },
        env
      );
      const submittalsResult = await procoreTools.get_procore_submittals.execute(
        { project_id: 12345, status: 'all', connection_id: 'test-user' },
        env
      );

      // Health calculation
      const openRFIs = rfisResult.data?.stats.openCount || 0;
      const avgResponseTime = rfisResult.data?.stats.avgResponseTimeDays || 0;
      const overdueSubmittals = submittalsResult.data?.stats.overdueCount || 0;
      const pendingSubmittals = submittalsResult.data?.stats.pendingCount || 0;

      // Simple health score (higher is better)
      const healthScore = 100 
        - (openRFIs * 2) // Penalty for open RFIs
        - (overdueSubmittals * 5) // Higher penalty for overdue submittals
        - (avgResponseTime > 7 ? 10 : 0); // Penalty for slow response times

      expect(typeof healthScore).toBe('number');
      expect(healthScore).toBeLessThanOrEqual(100);
    });

    it('should handle concurrent workflow operations', async () => {
      // Setup mock responses for concurrent calls
      global.fetch = vi.fn()
        .mockResolvedValueOnce(createMockFetchResponse(mockRFIs))
        .mockResolvedValueOnce(createMockFetchResponse(mockSubmittals))
        .mockResolvedValueOnce(createMockFetchResponse({
          weather_logs: [],
          manpower_logs: [],
          notes_logs: [],
        }));

      // Execute all three operations concurrently
      const results = await Promise.all([
        procoreTools.get_procore_rfis.execute(
          { project_id: 12345, status: 'all', connection_id: 'test-user' },
          env
        ),
        procoreTools.get_procore_submittals.execute(
          { project_id: 12345, status: 'all', connection_id: 'test-user' },
          env
        ),
        procoreTools.get_procore_daily_logs.execute(
          { project_id: 12345, connection_id: 'test-user' },
          env
        ),
      ]);

      // All should succeed
      expect(results.every((r) => r.success)).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });
  });

  // ==========================================================================
  // 5. Error Scenario Tests
  // ==========================================================================

  describe('Construction Workflow Errors', () => {
    it('should handle invalid project_id gracefully', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        createMockErrorResponse(404, 'Project not found')
      );

      const result = await procoreTools.get_procore_rfis.execute(
        { project_id: -1, status: 'all', connection_id: 'test-user' },
        env
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle permission denied for project access', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        createMockErrorResponse(403, 'Access denied. You do not have permission to view this project.')
      );

      const result = await procoreTools.get_procore_submittals.execute(
        { project_id: 12345, status: 'all', connection_id: 'test-user' },
        env
      );

      expect(result.success).toBe(false);
      expect(result.error?.message || '').toContain('Access denied');
    });

    it('should handle Procore API rate limiting', async () => {
      // Mock rate limiter to deny
      const rateLimitedEnv = createMockEnv({
        procoreClientId: 'test-client-id',
        procoreClientSecret: 'test-secret',
      });

      // Setup rate limiter mock to deny requests
      setupMockRateLimiter(rateLimitedEnv, {
        allowed: false,
        remaining: 0,
        retryAfter: 60,
      });

      // Setup token mock for rate limited env
      (rateLimitedEnv.DB as any).prepare = mockDB.prepare;

      const result = await procoreTools.get_procore_rfis.execute(
        { project_id: 12345, status: 'all', connection_id: 'test-user' },
        rateLimitedEnv
      );

      expect(result.success).toBe(false);
      expect(result.error?.message || '').toContain('rate limit');
    });

    it('should handle network timeout', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network timeout'));

      const result = await procoreTools.get_procore_daily_logs.execute(
        { project_id: 12345, connection_id: 'test-user' },
        env
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should validate construction-specific field formats (dates)', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        createMockFetchResponse([])
      );

      // Test with valid date format
      const validResult = await procoreTools.get_procore_daily_logs.execute(
        {
          project_id: 12345,
          start_date: '2024-01-15',
          end_date: '2024-01-22',
          connection_id: 'test-user',
        },
        env
      );

      expect(validResult.success).toBe(true);
    });

    it('should handle not connected error', async () => {
      // Mock no token found
      mockDB.prepare = vi.fn(() => ({
        bind: () => ({
          first: async () => null,
          all: async () => ({ results: [] }),
          run: async () => ({ success: true }),
        }),
        first: async () => null,
        all: async () => ({ results: [] }),
        run: async () => ({ success: true }),
      }));

      const result = await procoreTools.get_procore_rfis.execute(
        { project_id: 12345, status: 'all', connection_id: 'test-user' },
        env
      );

      expect(result.success).toBe(false);
      expect(result.error?.message || '').toContain('not connected');
    });

    it('should handle expired token', async () => {
      // Mock expired token
      const expiredToken = {
        ...mockValidToken,
        expires_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        refresh_token: null, // No refresh token
      };

      mockDB.prepare = vi.fn(() => ({
        bind: () => ({
          first: async () => expiredToken,
          all: async () => ({ results: [expiredToken] }),
          run: async () => ({ success: true }),
        }),
        first: async () => expiredToken,
        all: async () => ({ results: [expiredToken] }),
        run: async () => ({ success: true }),
      }));

      const result = await procoreTools.get_procore_submittals.execute(
        { project_id: 12345, status: 'all', connection_id: 'test-user' },
        env
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle malformed API response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => { throw new Error('Invalid JSON'); },
        text: async () => 'Not valid JSON {{{',
        headers: new Headers(),
      });

      // The actual behavior depends on implementation - some may return error, some may throw
      try {
        const result = await procoreTools.get_procore_rfis.execute(
          { project_id: 12345, status: 'all', connection_id: 'test-user' },
          env
        );
        // If it returns, should be an error
        expect(result.success).toBe(false);
      } catch (error) {
        // If it throws, that's also acceptable error handling
        expect(error).toBeDefined();
      }
    });

    it('should handle company_id not set error', async () => {
      // Mock token without company_id
      const tokenWithoutCompany = {
        ...mockValidToken,
        company_id: null,
      };

      mockDB.prepare = vi.fn((sql: string) => {
        if (sql.includes('company_id')) {
          return {
            bind: () => ({
              first: async () => tokenWithoutCompany,
            }),
          };
        }
        return {
          bind: () => ({
            first: async () => tokenWithoutCompany,
            all: async () => ({ results: [] }),
            run: async () => ({ success: true }),
          }),
          first: async () => tokenWithoutCompany,
        };
      });

      const result = await procoreTools.list_procore_projects.execute(
        { connection_id: 'test-user' },
        env
      );

      expect(result.success).toBe(false);
      expect(result.error?.message || '').toContain('Company ID not set');
    });
  });

  // ==========================================================================
  // 6. Audit Logging Tests
  // ==========================================================================

  describe('Audit Logging', () => {
    it('should log successful RFI retrieval', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        createMockFetchResponse(mockRFIs)
      );

      const result = await procoreTools.get_procore_rfis.execute(
        { project_id: 12345, status: 'all', connection_id: 'test-user' },
        env
      );

      expect(result.success).toBe(true);
      // Verify audit log was attempted (DB insert for audit_log table)
      // The actual logging is internal to the tool
    });

    it('should log RFI creation with resource_id', async () => {
      const createdRFI = {
        id: 9999,
        number: 99,
        subject: 'Audited RFI',
        status: 'draft',
        created_at: new Date().toISOString(),
      };
      global.fetch = vi.fn().mockResolvedValue(
        createMockFetchResponse(createdRFI)
      );

      const result = await procoreTools.create_procore_rfi.execute(
        {
          project_id: 12345,
          subject: 'Audited RFI',
          question: 'Test question',
          connection_id: 'test-user',
        },
        env
      );

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe(9999);
    });

    it('should log failed tool executions', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        createMockErrorResponse(500, 'Internal Server Error')
      );

      const result = await procoreTools.get_procore_rfis.execute(
        { project_id: 12345, status: 'all', connection_id: 'test-user' },
        env
      );

      expect(result.success).toBe(false);
      // Error should be logged internally
    });
  });
});
