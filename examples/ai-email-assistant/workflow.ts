/**
 * AI Email Assistant
 *
 * ZUHANDENHEIT VERSION: Tools completely recede.
 * Reduced from 399 lines to ~80 lines.
 *
 * The developer thinks:
 * - "Analyze this email" → `ai.synthesize(email, { type: 'email' })`
 * - "Save to Notion" → `notion.createDocument({ template: 'report' })`
 * - "Notify if urgent" → `slack.sendMessage()`
 */

import { defineWorkflow, webhook } from '@workway/sdk';
import { createAIClient } from '@workway/sdk/workers-ai';

// Schema for email analysis
const EmailAnalysisSchema = {
  category: 'string',
  priority: 'string',
  summary: 'string',
  actionItems: 'string[]',
  suggestedReplies: 'string[]',
  sentiment: 'string',
} as const;

export default defineWorkflow({
  name: 'AI Email Assistant',
  description: 'Process emails with AI to extract insights and organize in Notion',
  version: '2.0.0',

  pricing: {
    model: 'usage',
    pricePerExecution: 0.05,
    description: 'Includes AI processing, perfect for 100-500 emails/month'
  },

  integrations: [
    { service: 'gmail', scopes: ['read_emails', 'modify_labels'] },
    { service: 'notion', scopes: ['write_pages', 'read_databases'] },
    { service: 'slack', scopes: ['send_messages'] }
  ],

  inputs: {
    notionDatabaseId: {
      type: 'notion_database_picker',
      label: 'Notion Database for Emails',
      required: true
    },
    slackChannel: {
      type: 'slack_channel_picker',
      label: 'Slack Channel for Important Emails',
      required: true
    },
    aiDepth: {
      type: 'select',
      label: 'AI Analysis Depth',
      options: ['quick', 'standard', 'detailed'],
      default: 'standard'
    }
  },

  trigger: webhook({
    service: 'gmail',
    event: 'message.received'
  }),

  async execute({ trigger, inputs, integrations, env }) {
    const email = trigger.data;
    const ai = createAIClient(env).for('analysis', inputs.aiDepth || 'standard');

    // 1. Get full email content
    const fullEmail = await integrations.gmail.messages.get({
      messageId: email.id,
      format: 'full'
    });

    const emailContent = `From: ${fullEmail.from}\nSubject: ${fullEmail.subject}\n\n${fullEmail.body}`;

    // 2. AI Analysis (tools recede)
    const analysis = await ai.synthesize<typeof EmailAnalysisSchema>(emailContent, {
      type: 'email',
      output: EmailAnalysisSchema,
      context: 'Categorize as: Customer Support, Sales, Internal, Marketing, Urgent, or Other. Extract action items and suggest replies.'
    });

    const data = analysis.data!;
    const isUrgent = data.priority === 'high' || data.category === 'Urgent';

    // 3. Save to Notion (tools recede)
    const notionPage = await integrations.notion.createDocument({
      database: inputs.notionDatabaseId,
      template: 'report',
      data: {
        title: `${data.category}: ${fullEmail.subject}`,
        summary: data.summary,
        properties: {
          'Category': { select: { name: data.category } },
          'Priority': { select: { name: data.priority } },
          'From': { email: fullEmail.from },
          'Date': { date: { start: new Date().toISOString().split('T')[0] } },
          'Status': { select: { name: 'New' } }
        },
        sections: {
          actionItems: data.actionItems,
          suggestedReplies: data.suggestedReplies
        },
        metadata: {
          Sentiment: data.sentiment,
          'Email ID': email.id
        }
      }
    });

    // 4. Notify on Slack if urgent
    if (isUrgent) {
      await integrations.slack.sendMessage({
        channel: inputs.slackChannel,
        text: `🚨 *${data.category}*: ${fullEmail.subject}\n\n*From:* ${fullEmail.from}\n*Summary:* ${data.summary}\n\n<${notionPage.data?.url}|View in Notion>`
      });
    }

    // 5. Update Gmail labels
    await integrations.gmail.messages.modify({
      messageId: email.id,
      addLabelIds: [`AI_${data.category}`],
      removeLabelIds: ['UNREAD']
    });

    return {
      success: true,
      emailId: email.id,
      notionUrl: notionPage.data?.url,
      analysis: data,
      notified: isUrgent
    };
  },

  onError: async ({ error, integrations, inputs }) => {
    await integrations.slack?.sendMessage({
      channel: inputs.slackChannel,
      text: `❌ Email processing failed: ${error.message}`
    });
  }
});

/**
 * REDUCTION: 399 → ~80 lines
 *
 * Key abstractions used:
 * - ai.for('analysis', depth) — Intent-based model
 * - ai.synthesize(content, { type: 'email', output }) — Structured extraction
 * - notion.createDocument({ template: 'report' }) — Template-based creation
 */
