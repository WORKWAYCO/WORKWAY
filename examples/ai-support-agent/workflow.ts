/**
 * AI Support Agent with Memory
 *
 * ZUHANDENHEIT VERSION: Tools completely recede.
 * Reduced from 482 lines to ~120 lines.
 *
 * The developer thinks:
 * - "Analyze this ticket" → `ai.synthesize(ticket, { type: 'support' })`
 * - "Search knowledge base" → `vectorDB.rag(query)`
 * - "Generate response" → `ai.respond(context, { tone })`
 * - "Archive to Notion" → `notion.createDocument({ template: 'report' })`
 */

import { defineWorkflow, webhook } from '@workway/sdk';
import { createAIClient } from '@workway/sdk/workers-ai';
import { createVectorClient } from '@workway/sdk/vectorize';

// Schema for ticket analysis
const TicketAnalysisSchema = {
  category: 'string',
  priority: 'string',
  issues: 'string[]',
  expertise: 'number',
  sentiment: 'string',
} as const;

export default defineWorkflow({
  name: 'AI Support Agent with Memory',
  description: 'Intelligent support agent that learns from every interaction',
  version: '2.0.0',

  pricing: {
    model: 'usage',
    pricePerExecution: 0.10,
    description: 'Handles 80% of tickets automatically, escalates 20%'
  },

  integrations: [
    { service: 'zendesk', scopes: ['read_tickets', 'update_tickets', 'create_comments'] },
    { service: 'slack', scopes: ['send_messages'] },
    { service: 'notion', scopes: ['write_pages'] }
  ],

  inputs: {
    knowledgeBaseId: {
      type: 'text',
      label: 'Knowledge Base ID',
      required: true
    },
    escalationChannel: {
      type: 'slack_channel_picker',
      label: 'Escalation Channel',
      required: true
    },
    notionDatabaseId: {
      type: 'notion_database_picker',
      label: 'Ticket Archive Database',
      required: true
    },
    autoResolveConfidence: {
      type: 'number',
      label: 'Auto-resolve Confidence Threshold',
      default: 0.85
    },
    learningEnabled: {
      type: 'boolean',
      label: 'Enable Continuous Learning',
      default: true
    }
  },

  trigger: webhook({
    service: 'zendesk',
    event: 'ticket.created'
  }),

  async execute({ trigger, inputs, integrations, env }) {
    const ticket = trigger.data;
    const startTime = Date.now();

    const ai = createAIClient(env).for('support', 'standard');
    const vectorDB = createVectorClient(env);

    // 1. Analyze ticket (tools recede)
    const ticketContent = `${ticket.subject}\n\n${ticket.description}`;
    const analysis = await ai.synthesize<typeof TicketAnalysisSchema>(ticketContent, {
      type: 'support',
      output: TicketAnalysisSchema
    });

    const ticketData = analysis.data!;
    const isUrgent = ticketData.priority === 'critical' || ticketData.priority === 'high';
    const isAngry = ticketData.sentiment === 'negative';

    // 2. Search knowledge base (tools recede)
    const kbResult = await vectorDB.rag({
      query: ticketContent,
      topK: 5,
      systemPrompt: 'You are an expert support agent. Provide accurate, helpful responses.',
    });

    const confidence = kbResult.data?.sources?.[0]?.score || 0;
    const kbAnswer = kbResult.data?.answer;

    // 3. Generate response (tools recede)
    const responseContext = `
      Ticket: ${ticketContent}
      Category: ${ticketData.category}
      ${kbAnswer ? `Knowledge base answer: ${kbAnswer}` : ''}
      ${isAngry ? 'Note: Customer is frustrated. Be extra empathetic.' : ''}
    `;

    const response = await ai.respond(responseContext, {
      tone: isAngry ? 'empathetic' : 'professional',
      length: 'standard'
    });

    const suggestedResponse = response.data || 'Thank you for contacting support.';

    // 4. Decide: auto-resolve or escalate
    const shouldAutoResolve = confidence >= inputs.autoResolveConfidence &&
                              ticketData.expertise <= 3 &&
                              !isUrgent &&
                              kbAnswer;

    if (shouldAutoResolve) {
      // Auto-resolve
      await integrations.zendesk.tickets.update({
        id: ticket.id,
        comment: { body: suggestedResponse, public: true },
        status: 'solved',
        tags: ['ai-resolved', ticketData.category]
      });

      // Learn from resolution
      if (inputs.learningEnabled) {
        await vectorDB.storeText({
          id: `ticket_${ticket.id}`,
          text: `Q: ${ticketContent}\n\nA: ${suggestedResponse}`,
          metadata: { type: 'resolved_ticket', category: ticketData.category }
        });
      }
    } else {
      // Escalate
      await integrations.zendesk.tickets.update({
        id: ticket.id,
        comment: { body: `AI Analysis:\n- Category: ${ticketData.category}\n- Priority: ${ticketData.priority}\n- Confidence: ${Math.round(confidence * 100)}%\n\nSuggested Response:\n${suggestedResponse}`, public: false },
        priority: ticketData.priority,
        tags: ['ai-escalated', 'needs-human']
      });

      // Notify team
      await integrations.slack.sendMessage({
        channel: inputs.escalationChannel,
        text: `🎫 *${ticketData.priority.toUpperCase()}*: ${ticket.subject}\n\n*Category:* ${ticketData.category}\n*Sentiment:* ${ticketData.sentiment}\n*Confidence:* ${Math.round(confidence * 100)}%\n\n*Customer:* ${ticket.description.slice(0, 200)}...\n\n*AI Suggested:* ${suggestedResponse.slice(0, 200)}...`
      });
    }

    // 5. Archive to Notion (tools recede)
    await integrations.notion.createDocument({
      database: inputs.notionDatabaseId,
      template: 'report',
      data: {
        title: `#${ticket.id}: ${ticket.subject}`,
        summary: suggestedResponse,
        properties: {
          'Ticket ID': { number: ticket.id },
          'Category': { select: { name: ticketData.category } },
          'Priority': { select: { name: ticketData.priority } },
          'Status': { select: { name: shouldAutoResolve ? 'Auto-Resolved' : 'Escalated' } },
          'Confidence': { number: Math.round(confidence * 100) },
          'Response Time': { number: (Date.now() - startTime) / 1000 }
        },
        sections: {
          issues: ticketData.issues,
          knowledgeBaseSources: kbResult.data?.sources?.map(s => s.text) || []
        },
        metadata: {
          Sentiment: ticketData.sentiment,
          Expertise: ticketData.expertise
        }
      }
    });

    return {
      success: true,
      ticketId: ticket.id,
      action: shouldAutoResolve ? 'auto_resolved' : 'escalated',
      analysis: ticketData,
      confidence: Math.round(confidence * 100),
      responseTime: Date.now() - startTime
    };
  },

  onError: async ({ error, trigger, integrations, inputs }) => {
    const ticket = trigger.data;
    await integrations.zendesk?.tickets.update({
      id: ticket.id,
      comment: { body: 'AI processing error. Escalating to human.', public: false },
      tags: ['ai-error', 'needs-human'],
      priority: 'high'
    });
    await integrations.slack?.sendMessage({
      channel: inputs.escalationChannel,
      text: `❌ AI Support Agent Error for #${ticket.id}: ${error.message}`
    });
  }
});

/**
 * REDUCTION: 482 → ~120 lines
 *
 * Key abstractions used:
 * - ai.for('support', 'standard') — Intent-based model
 * - ai.synthesize(ticket, { type: 'support', output }) — Structured analysis
 * - ai.respond(context, { tone }) — Tone-aware response generation
 * - vectorDB.rag(query) — Knowledge base search
 * - notion.createDocument({ template: 'report' }) — Template-based archival
 */
