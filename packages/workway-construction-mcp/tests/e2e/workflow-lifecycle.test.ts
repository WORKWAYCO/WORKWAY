/**
 * End-to-End Workflow Lifecycle Tests
 * 
 * Tests complete workflow creation → configuration → deployment → execution flow
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { workflowTools } from '../../src/tools/workflow';
import { createMockEnv } from '../mocks/env';
import type { Env } from '../../src/types';

describe('E2E: Workflow Lifecycle', () => {
  let env: Env;
  let workflowId: string;
  let dbState: Record<string, any[]>;

  beforeEach(() => {
    dbState = {
      workflows: [],
      workflow_actions: [],
      executions: [],
    };

    env = createMockEnv({
      dbData: dbState,
    });

    // Mock database operations to use dbState
    env.DB.prepare = vi.fn((sql: string) => {
      if (sql.includes('INSERT INTO workflows')) {
        return {
          bind: (...params: any[]) => {
            const workflow = {
              id: params[0],
              name: params[1],
              description: params[2],
              project_id: params[3],
              trigger_type: params[4],
              status: params[5],
              created_at: params[6],
              updated_at: params[7],
            };
            dbState.workflows.push(workflow);
            return {
              run: async () => ({ success: true }),
            };
          },
        };
      }

      if (sql.includes('UPDATE workflows')) {
        return {
          bind: (...params: any[]) => {
            const workflow = dbState.workflows.find((w: any) => w.id === params[params.length - 1]);
            if (workflow) {
              Object.assign(workflow, {
                trigger_config: params[0],
                trigger_type: params[1] || workflow.trigger_type,
                status: params[0]?.includes('active') ? 'active' : workflow.status,
                updated_at: params[1] || new Date().toISOString(),
              });
            }
            return {
              run: async () => ({ success: true }),
            };
          },
        };
      }

      if (sql.includes('SELECT * FROM workflows')) {
        return {
          bind: (...params: any[]) => ({
            first: async () => dbState.workflows.find((w: any) => w.id === params[0]) || null,
          }),
        };
      }

      if (sql.includes('INSERT INTO workflow_actions')) {
        return {
          bind: (...params: any[]) => {
            const action = {
              id: params[0],
              workflow_id: params[1],
              action_type: params[2],
              action_config: params[3],
              sequence: params[4],
              condition: params[5],
            };
            dbState.workflow_actions.push(action);
            return {
              run: async () => ({ success: true }),
            };
          },
        };
      }

      if (sql.includes('SELECT * FROM workflow_actions')) {
        return {
          bind: (...params: any[]) => ({
            all: async () => ({
              results: dbState.workflow_actions
                .filter((a: any) => a.workflow_id === params[0])
                .sort((a: any, b: any) => a.sequence - b.sequence),
            }),
          }),
        };
      }

      if (sql.includes('COUNT(*)')) {
        return {
          bind: (...params: any[]) => ({
            first: async () => ({
              count: dbState.workflow_actions.filter((a: any) => a.workflow_id === params[0]).length,
            }),
          }),
        };
      }

      if (sql.includes('INSERT INTO executions')) {
        return {
          bind: (...params: any[]) => {
            const execution = {
              id: params[0],
              workflow_id: params[1],
              status: params[2],
              started_at: params[3],
              completed_at: params[4],
              input_data: params[5],
              output_data: params[6],
              error: params[7],
            };
            dbState.executions.push(execution);
            return {
              run: async () => ({ success: true }),
            };
          },
        };
      }

      return {
        bind: (...params: any[]) => ({
          first: async () => null,
          all: async () => ({ results: [] }),
          run: async () => ({ success: true }),
        }),
      };
    });
  });

  it('should complete full workflow lifecycle', async () => {
    // Step 1: Create workflow
    const createResult = await workflowTools.create_workflow.execute(
      {
        name: 'RFI Auto-Response',
        description: 'Automatically respond to RFIs',
        project_id: 'proj-123',
        trigger_type: 'webhook',
      },
      env
    );

    expect(createResult.success).toBe(true);
    workflowId = createResult.data!.id as string;
    expect(dbState.workflows).toHaveLength(1);

    // Step 2: Configure trigger
    const configureResult = await workflowTools.configure_trigger.execute(
      {
        workflow_id: workflowId,
        source: 'procore',
        event_types: ['rfi.created'],
      },
      env
    );

    expect(configureResult.success).toBe(true);
    const workflow = dbState.workflows[0];
    expect(workflow.trigger_config).toBeDefined();

    // Step 3: Add actions
    const action1Result = await workflowTools.add_action.execute(
      {
        workflow_id: workflowId,
        action_type: 'ai.search_similar_rfis',
        config: { similarity_threshold: 0.7 },
      },
      env
    );

    expect(action1Result.success).toBe(true);
    expect(dbState.workflow_actions).toHaveLength(1);

    const action2Result = await workflowTools.add_action.execute(
      {
        workflow_id: workflowId,
        action_type: 'procore.rfi.respond',
        config: { template: 'standard' },
      },
      env
    );

    expect(action2Result.success).toBe(true);
    expect(dbState.workflow_actions).toHaveLength(2);

    // Step 4: Deploy workflow
    const deployResult = await workflowTools.deploy.execute(
      {
        workflow_id: workflowId,
        dry_run: false,
      },
      env
    );

    expect(deployResult.success).toBe(true);
    expect(deployResult.data?.status).toBe('deployed');
    expect(dbState.workflows[0].status).toBe('active');

    // Step 5: Test workflow
    const testResult = await workflowTools.test.execute(
      {
        workflow_id: workflowId,
        test_payload: {
          event: 'rfi.created',
          rfi: { id: 123, subject: 'Test RFI' },
        },
      },
      env
    );

    expect(testResult.success).toBe(true);
    expect(testResult.data?.executionId).toBeDefined();
    expect(testResult.data?.stepsTotal).toBe(2);
    expect(dbState.executions).toHaveLength(1);
  });

  it('should handle workflow rollback', async () => {
    // Create and deploy workflow
    const createResult = await workflowTools.create_workflow.execute(
      {
        name: 'Test Workflow',
        trigger_type: 'cron',
      },
      env
    );

    workflowId = createResult.data!.id as string;

    await workflowTools.add_action.execute(
      {
        workflow_id: workflowId,
        action_type: 'test.action',
        config: {},
      },
      env
    );

    await workflowTools.deploy.execute(
      {
        workflow_id: workflowId,
        dry_run: false,
      },
      env
    );

    expect(dbState.workflows[0].status).toBe('active');

    // Rollback to draft
    const rollbackResult = await workflowTools.rollback.execute(
      {
        workflow_id: workflowId,
        action: 'rollback',
      },
      env
    );

    expect(rollbackResult.success).toBe(true);
    expect(dbState.workflows[0].status).toBe('draft');
  });

  it('should validate workflow before deployment', async () => {
    // Create workflow without actions
    const createResult = await workflowTools.create_workflow.execute(
      {
        name: 'Incomplete Workflow',
      },
      env
    );

    workflowId = createResult.data!.id as string;

    // Try to deploy without actions (should fail)
    const deployResult = await workflowTools.deploy.execute(
      {
        workflow_id: workflowId,
        dry_run: true,
      },
      env
    );

    expect(deployResult.success).toBe(false);
    expect(deployResult.data?.validationErrors).toContain('Workflow must have at least one action');
  });

  it('should list workflows with filters', async () => {
    // Create multiple workflows
    await workflowTools.create_workflow.execute(
      { name: 'Workflow 1', trigger_type: 'webhook' },
      env
    );
    await workflowTools.create_workflow.execute(
      { name: 'Workflow 2', trigger_type: 'cron' },
      env
    );

    // List all workflows
    const listResult = await workflowTools.list_workflows.execute(
      { status: 'all' },
      env
    );

    expect(listResult.success).toBe(true);
    expect(listResult.data?.workflows.length).toBeGreaterThanOrEqual(2);
  });
});
