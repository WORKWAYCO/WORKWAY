/**
 * Daily Standup Synthesizer
 *
 * TRUE ZUHANDENHEIT: The tools completely recede.
 * ~10 lines of execute logic, down from 180+.
 *
 * This demonstrates the power of intent-based SDK design:
 * - Developer thinks "get human messages" → `humanOnly: true`
 * - Developer thinks "synthesize standup" → `ai.synthesize(text, { type: 'standup' })`
 * - Developer thinks "save summary" → `notion.createDocument({ template: 'summary' })`
 */

import { defineWorkflow, schedule } from '@workway/sdk';
import { createAIClient } from '@workway/sdk/workers-ai';

// Define the synthesis output schema once
const StandupSchema = {
  themes: 'string[]',
  accomplishments: 'string[]',
  blockers: 'string[]',
  actionItems: 'string[]',
  mood: 'string',
  summary: 'string',
} as const;

export default defineWorkflow({
  name: 'Daily Standup Synthesizer',
  description: 'Synthesize team standup discussions into actionable knowledge',
  version: '2.0.0', // Zuhandenheit version

  pricing: {
    model: 'freemium',
    price: 0,
    freeTier: { executionsPerMonth: 30 }
  },

  integrations: [
    { service: 'slack', scopes: ['read_messages', 'channels:history'] },
    { service: 'notion', scopes: ['write_pages', 'read_databases'] }
  ],

  inputs: {
    standupChannel: {
      type: 'slack_channel_picker',
      label: 'Standup Channel',
      required: true
    },
    notionDatabaseId: {
      type: 'notion_database_picker',
      label: 'Standup Archive',
      required: true
    },
    synthesisDepth: {
      type: 'select',
      label: 'Synthesis Depth',
      options: ['quick', 'standard', 'detailed'],
      default: 'standard'
    },
    lookbackHours: {
      type: 'number',
      label: 'Hours to Look Back',
      default: 24
    }
  },

  trigger: schedule('0 9 * * 1-5'),

  // =========================================================================
  // THE EXECUTE FUNCTION: ~10 LINES OF PURE INTENT
  // =========================================================================
  async execute({ inputs, integrations, env }) {
    const ai = createAIClient(env).for('synthesis', inputs.synthesisDepth || 'standard');
    const today = new Date().toISOString().split('T')[0];

    // 1. Get human messages (tool recedes)
    const messages = await integrations.slack.getMessages({
      channel: inputs.standupChannel,
      since: `${inputs.lookbackHours || 24}h`,
      humanOnly: true,
      limit: 100
    });

    if (!messages.data?.length) {
      return { success: true, data: { synthesized: false, reason: 'No messages found' } };
    }

    // 2. Synthesize (tool recedes)
    const text = messages.data.map((m: any) => `[${m.user}]: ${m.text}`).join('\n\n');
    const synthesis = await ai.synthesize<typeof StandupSchema>(text, {
      type: 'standup',
      output: StandupSchema
    });

    // 3. Save to Notion (tool recedes)
    const page = await integrations.notion.createDocument({
      database: inputs.notionDatabaseId,
      template: 'summary',
      data: {
        title: `Standup Synthesis - ${today}`,
        date: today,
        mood: synthesis.data?.mood as any,
        summary: synthesis.data?.summary,
        sections: {
          themes: synthesis.data?.themes || [],
          accomplishments: synthesis.data?.accomplishments || [],
          blockers: synthesis.data?.blockers || [],
          actionItems: synthesis.data?.actionItems || []
        }
      }
    });

    return {
      success: true,
      data: {
        synthesized: true,
        date: today,
        messagesProcessed: messages.data.length,
        notionUrl: page.data?.url,
        synthesis: synthesis.data
      }
    };
  }
});

/**
 * COMPARISON: Before vs After
 *
 * BEFORE (180+ lines):
 * - Manual timestamp conversion
 * - Manual message filtering
 * - Model name ternaries
 * - 15-line system prompts
 * - JSON parsing with regex fallback
 * - 120 lines of Notion block construction
 *
 * AFTER (~10 lines of intent):
 * - `since: '24h', humanOnly: true`
 * - `ai.for('synthesis', depth)`
 * - `ai.synthesize(text, { type, output })`
 * - `notion.createDocument({ template, data })`
 *
 * The tools have COMPLETELY receded.
 * This is Zuhandenheit achieved.
 */
