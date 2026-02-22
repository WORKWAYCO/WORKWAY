/**
 * Judgment Axis Prompts
 *
 * Prompts are served through MCP and used by clients without a dashboard.
 */

import type { MCPPrompt } from '@workway/mcp-core';

function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (value === undefined || value === null) return fallback;
  return JSON.stringify(value);
}

export const judgmentPrompts: MCPPrompt[] = [
  {
    name: 'judgment.review-action',
    description: 'Structured review prompt for policy-gated tool execution.',
    arguments: [
      { name: 'tool_slug', description: 'Tool being evaluated', required: true },
      { name: 'toolkit_slug', description: 'Toolkit context (if any)', required: false },
      { name: 'risk_score', description: 'Estimated risk score (0..1)', required: false },
      { name: 'reason', description: 'Why this decision needs human review', required: false },
    ],
    render: (args) => [
      {
        role: 'system',
        content: {
          type: 'text',
          text: [
            'You are a construction operations governance reviewer.',
            'Assess the proposed action and return one decision: approve or reject.',
            'Justify the decision with compliance and operational impact context.',
          ].join(' '),
        },
      },
      {
        role: 'user',
        content: {
          type: 'text',
          text: [
            `Tool: ${asString(args.tool_slug, 'unknown')}`,
            `Toolkit: ${asString(args.toolkit_slug, 'n/a')}`,
            `Risk score: ${asString(args.risk_score, 'n/a')}`,
            `Reason: ${asString(args.reason, 'n/a')}`,
            'Provide: decision, rationale, required follow-up.',
          ].join('\n'),
        },
      },
    ],
  },
  {
    name: 'judgment.escalation-note',
    description: 'Generate a concise escalation note for pending approval decisions.',
    arguments: [
      { name: 'decision_id', description: 'Decision record ID', required: true },
      { name: 'tool_slug', description: 'Tool/action slug', required: true },
      { name: 'impact', description: 'Operational impact summary', required: false },
      { name: 'deadline', description: 'SLA or timing constraints', required: false },
    ],
    render: (args) => [
      {
        role: 'system',
        content: {
          type: 'text',
          text: 'Write escalation notes for construction PM and compliance stakeholders.',
        },
      },
      {
        role: 'user',
        content: {
          type: 'text',
          text: [
            `Decision ID: ${asString(args.decision_id, 'unknown')}`,
            `Tool: ${asString(args.tool_slug, 'unknown')}`,
            `Impact: ${asString(args.impact, 'n/a')}`,
            `Deadline: ${asString(args.deadline, 'n/a')}`,
            'Output a short escalation note with: context, risk, required approver, and next action.',
          ].join('\n'),
        },
      },
    ],
  },
  {
    name: 'judgment.policy-suggest',
    description: 'Suggest policy updates from repeated decision patterns.',
    arguments: [
      { name: 'tenant_id', description: 'Tenant identifier', required: true },
      { name: 'toolkit_slug', description: 'Toolkit scope', required: false },
      { name: 'pattern_summary', description: 'Observed decision pattern', required: true },
    ],
    render: (args) => [
      {
        role: 'system',
        content: {
          type: 'text',
          text: [
            'You are a governance policy analyst for construction AI operations.',
            'Produce policy suggestions that are explicit, enforceable, and auditable.',
          ].join(' '),
        },
      },
      {
        role: 'user',
        content: {
          type: 'text',
          text: [
            `Tenant: ${asString(args.tenant_id, 'unknown')}`,
            `Toolkit: ${asString(args.toolkit_slug, 'all')}`,
            `Pattern: ${asString(args.pattern_summary, 'n/a')}`,
            'Return proposed rule changes with rationale and expected risk reduction.',
          ].join('\n'),
        },
      },
    ],
  },
];
