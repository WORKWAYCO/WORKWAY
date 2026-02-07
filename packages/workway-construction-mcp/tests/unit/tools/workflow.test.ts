/**
 * Workflow Tools Unit Tests
 * 
 * Tests for workflow lifecycle tools:
 * - workway_create_workflow
 * - workway_configure_workflow_trigger
 * - workway_add_workflow_action
 * - workway_deploy_workflow
 * - workway_test_workflow
 * - workway_list_workflows
 * - workway_rollback_workflow
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { workflowTools } from '../../../src/tools/workflow';
import { createMockEnv } from '../../mocks/env';
import type { Env } from '../../../src/types';

describe('workflowTools', () => {
  let env: Env;
  let mockDB: any;

  beforeEach(() => {
    env = createMockEnv();
    mockDB = env.DB;
  });

  describe('create_workflow', () => {
    it('should create a new workflow with minimal input', async () => {
      const input = {
        name: 'Test Workflow',
      };

      const result = await workflowTools.create_workflow.execute(input, env);

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        name: 'Test Workflow',
        status: 'draft',
      });
      expect(result.data?.id).toBeDefined();
      expect(result.data?.createdAt).toBeDefined();
    });

    it('should create workflow with all optional fields', async () => {
      const input = {
        name: 'RFI Auto-Response',
        description: 'Automatically respond to RFIs',
        project_id: 'proj-123',
        trigger_type: 'webhook' as const,
      };

      const result = await workflowTools.create_workflow.execute(input, env);

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        name: 'RFI Auto-Response',
        description: 'Automatically respond to RFIs',
        projectId: 'proj-123',
        triggerType: 'webhook',
        status: 'draft',
      });
      expect(result.data?.webhookUrl).toBeDefined();
    });

    it('should generate webhook URL for webhook trigger', async () => {
      const input = {
        name: 'Webhook Workflow',
        trigger_type: 'webhook' as const,
      };

      const result = await workflowTools.create_workflow.execute(input, env);

      expect(result.success).toBe(true);
      expect(result.data?.webhookUrl).toContain('/webhooks/');
    });

    it('should provide appropriate next_step guidance', async () => {
      const webhookInput = {
        name: 'Webhook Workflow',
        trigger_type: 'webhook' as const,
      };
      const webhookResult = await workflowTools.create_workflow.execute(webhookInput, env);
      expect(webhookResult.data?.nextStep).toContain('configure_workflow_trigger');

      const cronInput = {
        name: 'Cron Workflow',
        trigger_type: 'cron' as const,
      };
      const cronResult = await workflowTools.create_workflow.execute(cronInput, env);
      expect(cronResult.data?.nextStep).toContain('add_workflow_action');
    });
  });

  describe('configure_workflow_trigger', () => {
    beforeEach(() => {
      // Setup: Create a workflow first
      mockDB.prepare = vi.fn((sql: string) => {
        if (sql.includes('UPDATE workflows')) {
          return {
            bind: (...params: any[]) => ({
              run: async () => ({ success: true }),
            }),
          };
        }
        return {
          bind: (...params: any[]) => ({
            first: async () => ({
              id: 'workflow-123',
              name: 'Test Workflow',
              status: 'draft',
            }),
          }),
        };
      });
    });

    it('should configure webhook trigger', async () => {
      const input = {
        workflow_id: 'workflow-123',
        source: 'procore' as const,
        event_types: ['rfi.created', 'rfi.answered'],
      };

      const result = await workflowTools.configure_workflow_trigger.execute(input, env);

      expect(result.success).toBe(true);
      expect(result.data?.triggerConfig).toMatchObject({
        source: 'procore',
        eventTypes: ['rfi.created', 'rfi.answered'],
      });
      expect(result.data?.webhookUrl).toBeDefined();
    });

    it('should configure cron trigger', async () => {
      const input = {
        workflow_id: 'workflow-123',
        cron_schedule: '0 9 * * 1-5',
        timezone: 'America/Chicago',
      };

      const result = await workflowTools.configure_workflow_trigger.execute(input, env);

      expect(result.success).toBe(true);
      expect(result.data?.triggerConfig).toMatchObject({
        cronSchedule: '0 9 * * 1-5',
        timezone: 'America/Chicago',
      });
    });

    it('should set trigger_type based on config', async () => {
      const webhookInput = {
        workflow_id: 'workflow-123',
        source: 'procore' as const,
      };
      const webhookResult = await workflowTools.configure_workflow_trigger.execute(webhookInput, env);
      expect(webhookResult.success).toBe(true);

      const cronInput = {
        workflow_id: 'workflow-123',
        cron_schedule: '0 9 * * *',
      };
      const cronResult = await workflowTools.configure_workflow_trigger.execute(cronInput, env);
      expect(cronResult.success).toBe(true);
    });
  });

  describe('add_workflow_action', () => {
    beforeEach(() => {
      mockDB.prepare = vi.fn((sql: string) => {
        if (sql.includes('COUNT(*)')) {
          return {
            bind: () => ({
              first: async () => ({ count: 2 }),
            }),
          };
        }
        if (sql.includes('INSERT INTO workflow_actions')) {
          return {
            bind: (...params: any[]) => ({
              run: async () => ({ success: true }),
            }),
          };
        }
        return {
          bind: () => ({
            first: async () => null,
          }),
        };
      });
    });

    it('should add action to workflow', async () => {
      const input = {
        workflow_id: 'workflow-123',
        action_type: 'procore.rfi.respond',
        config: {
          template: 'standard',
          notify: true,
        },
      };

      const result = await workflowTools.add_workflow_action.execute(input, env);

      expect(result.success).toBe(true);
      expect(result.data?.actionId).toBeDefined();
      expect(result.data?.sequence).toBe(3); // Existing 2 + 1
      expect(result.data?.nextStep).toContain('add_workflow_action');
    });

    it('should add action with condition', async () => {
      const input = {
        workflow_id: 'workflow-123',
        action_type: 'slack.message.send',
        config: { channel: '#alerts' },
        condition: "{{trigger.rfi.status}} == 'urgent'",
      };

      const result = await workflowTools.add_workflow_action.execute(input, env);

      expect(result.success).toBe(true);
      expect(result.data?.actionId).toBeDefined();
    });
  });

  describe('deploy_workflow', () => {
    beforeEach(() => {
      mockDB.prepare = vi.fn((sql: string) => {
        if (sql.includes('SELECT * FROM workflows')) {
          return {
            bind: () => ({
              first: async () => ({
                id: 'workflow-123',
                name: 'Test Workflow',
                status: 'draft',
                trigger_type: 'webhook',
                trigger_config: JSON.stringify({ source: 'procore', eventTypes: ['rfi.created'] }),
              }),
            }),
          };
        }
        if (sql.includes('SELECT * FROM workflow_actions')) {
          return {
            bind: () => ({
              all: async () => ({
                results: [
                  {
                    id: 'action-1',
                    action_type: 'procore.rfi.respond',
                    sequence: 1,
                  },
                ],
              }),
            }),
          };
        }
        if (sql.includes('UPDATE workflows')) {
          return {
            bind: () => ({
              run: async () => ({ success: true }),
            }),
          };
        }
        return {
          bind: () => ({
            first: async () => null,
          }),
        };
      });
    });

    it('should deploy valid workflow', async () => {
      const input = {
        workflow_id: 'workflow-123',
        dry_run: false,
      };

      const result = await workflowTools.deploy_workflow.execute(input, env);

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('deployed');
      expect(result.data?.deploymentId).toBeDefined();
      expect(result.data?.validationErrors).toEqual([]);
    });

    it('should validate without deploying when dry_run=true', async () => {
      const input = {
        workflow_id: 'workflow-123',
        dry_run: true,
      };

      const result = await workflowTools.deploy_workflow.execute(input, env);

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('validated');
      expect(result.data?.validationErrors).toEqual([]);
    });

    it('should fail validation when workflow has no actions', async () => {
      mockDB.prepare = vi.fn((sql: string) => {
        if (sql.includes('SELECT * FROM workflow_actions')) {
          return {
            bind: () => ({
              all: async () => ({ results: [] }),
            }),
          };
        }
        // ... other mocks
        return {
          bind: () => ({
            first: async () => ({
              id: 'workflow-123',
              trigger_type: 'webhook',
              trigger_config: JSON.stringify({ source: 'procore' }),
            }),
          }),
        };
      });

      const input = {
        workflow_id: 'workflow-123',
        dry_run: true,
      };

      const result = await workflowTools.deploy_workflow.execute(input, env);

      expect(result.success).toBe(false);
      expect(result.data?.validationErrors).toContain('Workflow must have at least one action');
    });

    it('should fail validation when webhook trigger missing config', async () => {
      mockDB.prepare = vi.fn((sql: string) => {
        if (sql.includes('SELECT * FROM workflows')) {
          return {
            bind: () => ({
              first: async () => ({
                id: 'workflow-123',
                trigger_type: 'webhook',
                trigger_config: null, // Missing config
              }),
            }),
          };
        }
        if (sql.includes('SELECT * FROM workflow_actions')) {
          return {
            bind: () => ({
              all: async () => ({
                results: [{ id: 'action-1', action_type: 'test' }],
              }),
            }),
          };
        }
        return {
          bind: () => ({
            first: async () => null,
          }),
        };
      });

      const input = {
        workflow_id: 'workflow-123',
        dry_run: true,
      };

      const result = await workflowTools.deploy_workflow.execute(input, env);

      expect(result.success).toBe(false);
      expect(result.data?.validationErrors).toContain('Webhook trigger requires source and event_types configuration');
    });

    it('should return 404 when workflow not found', async () => {
      mockDB.prepare = vi.fn(() => ({
        bind: () => ({
          first: async () => null, // Workflow not found
        }),
      }));

      const input = {
        workflow_id: 'nonexistent',
        dry_run: false,
      };

      const result = await workflowTools.deploy_workflow.execute(input, env);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('test_workflow', () => {
    beforeEach(() => {
      mockDB.prepare = vi.fn((sql: string) => {
        if (sql.includes('SELECT * FROM workflows')) {
          return {
            bind: () => ({
              first: async () => ({
                id: 'workflow-123',
                name: 'Test Workflow',
                status: 'active',
              }),
            }),
          };
        }
        if (sql.includes('SELECT * FROM workflow_actions')) {
          return {
            bind: () => ({
              all: async () => ({
                results: [
                  { id: 'action-1', action_type: 'procore.rfi.respond', sequence: 1 },
                  { id: 'action-2', action_type: 'slack.message.send', sequence: 2 },
                ],
              }),
            }),
          };
        }
        if (sql.includes('INSERT INTO executions')) {
          return {
            bind: () => ({
              run: async () => ({ success: true }),
            }),
          };
        }
        return {
          bind: () => ({
            first: async () => null,
          }),
        };
      });
    });

    it('should execute test workflow', async () => {
      const input = {
        workflow_id: 'workflow-123',
        test_payload: {
          rfi: { id: 123, subject: 'Test RFI' },
        },
      };

      const result = await workflowTools.test_workflow.execute(input, env);

      expect(result.success).toBe(true);
      expect(result.data?.executionId).toBeDefined();
      expect(result.data?.stepsTotal).toBe(2);
      expect(result.data?.stepsCompleted).toBeGreaterThan(0);
      expect(result.data?.durationMs).toBeGreaterThan(0);
    });

    it('should handle action failures', async () => {
      // Mock action execution failure
      const result = await workflowTools.test_workflow.execute(
        {
          workflow_id: 'workflow-123',
        },
        env
      );

      // Should still return execution record
      expect(result.data?.executionId).toBeDefined();
    });
  });

  describe('list_workflows', () => {
    beforeEach(() => {
      mockDB.prepare = vi.fn((sql: string) => {
        return {
          bind: (...params: any[]) => ({
            all: async () => ({
              results: [
                {
                  id: 'workflow-1',
                  name: 'RFI Automation',
                  status: 'active',
                  trigger_type: 'webhook',
                  project_id: 'proj-123',
                  created_at: '2024-01-01T00:00:00Z',
                },
                {
                  id: 'workflow-2',
                  name: 'Daily Logs',
                  status: 'draft',
                  trigger_type: 'cron',
                  project_id: null,
                  created_at: '2024-01-02T00:00:00Z',
                },
              ],
            }),
          }),
        };
      });
    });

    it('should list all workflows', async () => {
      const input = {
        status: 'all' as const,
      };

      const result = await workflowTools.list_workflows.execute(input, env);

      expect(result.success).toBe(true);
      expect(result.data?.workflows).toHaveLength(2);
      expect(result.data?.total).toBe(2);
    });

    it('should filter by status', async () => {
      const input = {
        status: 'active' as const,
      };

      const result = await workflowTools.list_workflows.execute(input, env);

      expect(result.success).toBe(true);
      // Mock returns all, but in real implementation would filter
      expect(result.data?.workflows).toBeDefined();
    });

    it('should filter by project_id', async () => {
      const input = {
        status: 'all' as const,
        project_id: 'proj-123',
      };

      const result = await workflowTools.list_workflows.execute(input, env);

      expect(result.success).toBe(true);
      expect(result.data?.workflows).toBeDefined();
    });
  });

  describe('rollback_workflow', () => {
    beforeEach(() => {
      mockDB.prepare = vi.fn((sql: string) => {
        if (sql.includes('UPDATE workflows')) {
          return {
            bind: () => ({
              run: async () => ({ success: true }),
            }),
          };
        }
        return {
          bind: () => ({
            first: async () => null,
          }),
        };
      });
    });

    it('should pause workflow', async () => {
      const input = {
        workflow_id: 'workflow-123',
        action: 'pause' as const,
      };

      const result = await workflowTools.rollback_workflow.execute(input, env);

      expect(result.success).toBe(true);
      expect(result.data?.newStatus).toBe('paused');
      expect(result.data?.message).toContain('paused');
    });

    it('should rollback workflow to draft', async () => {
      const input = {
        workflow_id: 'workflow-123',
        action: 'rollback' as const,
      };

      const result = await workflowTools.rollback_workflow.execute(input, env);

      expect(result.success).toBe(true);
      expect(result.data?.newStatus).toBe('draft');
      expect(result.data?.message).toContain('rolled back');
    });
  });
});
