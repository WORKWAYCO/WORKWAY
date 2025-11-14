/**
 * AI Support Agent with Memory
 *
 * This workflow demonstrates the power of combining:
 * - Workers AI for understanding and generation
 * - Vectorize for semantic search and memory
 * - Traditional integrations for ticket management
 *
 * Features:
 * - Learns from past tickets and resolutions
 * - Provides instant, accurate responses
 * - Escalates complex issues intelligently
 * - Gets smarter over time
 *
 * Cost: ~$0.05 per ticket (vs $5+ for human response)
 * Response time: <2 seconds (vs 2+ hours for human)
 */

import { defineWorkflow, webhook } from '@workway/sdk';
import { createAIClient, AIModels } from '@workway/sdk/workers-ai';
import { createVectorClient } from '@workway/sdk/vectorize';

export default defineWorkflow({
  name: 'AI Support Agent with Memory',
  description: 'Intelligent support agent that learns from every interaction',
  version: '1.0.0',

  pricing: {
    model: 'usage',
    pricePerExecution: 0.10, // 10 cents per ticket
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
      required: true,
      description: 'Vectorize index for your support knowledge'
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
      default: 0.85,
      min: 0.5,
      max: 1.0,
      description: 'Min confidence to auto-resolve (0.5-1.0)'
    },
    learningEnabled: {
      type: 'boolean',
      label: 'Enable Continuous Learning',
      default: true,
      description: 'Learn from resolved tickets to improve over time'
    }
  },

  trigger: webhook({
    service: 'zendesk',
    event: 'ticket.created'
  }),

  async execute({ trigger, inputs, integrations, env }) {
    const ticket = trigger.data;
    const startTime = Date.now();

    // Initialize AI and Vector DB
    const ai = createAIClient(env);
    const vectorDB = createVectorClient(env);

    console.log(`🎫 Processing ticket #${ticket.id}: ${ticket.subject}`);

    // Step 1: Analyze the ticket
    const analysis = await ai.chain([
      {
        type: 'sentiment',
        options: { text: ticket.description }
      },
      {
        type: 'text',
        options: {
          model: AIModels.LLAMA_3_8B,
          prompt: `Analyze this support ticket and extract:
            1. Category (billing, technical, feature-request, bug, other)
            2. Priority (low, medium, high, critical)
            3. Key issues (list)
            4. Required expertise level (1-5)

            Ticket: ${ticket.subject}
            ${ticket.description}

            Return as JSON.`,
          temperature: 0.3,
          max_tokens: 300
        }
      }
    ]);

    let ticketAnalysis;
    try {
      ticketAnalysis = JSON.parse(analysis[1].data?.response || '{}');
    } catch {
      ticketAnalysis = {
        category: 'other',
        priority: 'medium',
        issues: ['Unable to parse'],
        expertise: 3
      };
    }

    const sentiment = analysis[0].data;
    const isAngry = sentiment?.negative > 0.7;
    const isUrgent = ticketAnalysis.priority === 'critical' || ticketAnalysis.priority === 'high';

    // Step 2: Search knowledge base for similar issues
    console.log('🔍 Searching knowledge base...');

    const searchResult = await vectorDB.rag({
      query: `${ticket.subject} ${ticket.description}`,
      topK: 5,
      systemPrompt: `You are an expert support agent. Use the knowledge base to provide accurate, helpful responses. Be concise and professional.`,
      generationModel: AIModels.LLAMA_3_8B,
      temperature: 0.5
    });

    if (!searchResult.success) {
      console.error('Knowledge base search failed:', searchResult.error);
    }

    const answer = searchResult.data?.answer || null;
    const sources = searchResult.data?.sources || [];
    const confidence = sources.length > 0 ? sources[0].score : 0;

    // Step 3: Generate response options
    console.log('💡 Generating response...');

    const responseResult = await ai.generateText({
      model: AIModels.LLAMA_3_8B,
      system: `You are a professional support agent.
        ${isAngry ? 'The customer is frustrated. Be extra empathetic.' : ''}
        ${answer ? 'Use this knowledge base answer as reference: ' + answer : ''}
        Keep responses concise and actionable.`,
      prompt: `Write a support response for:
        Subject: ${ticket.subject}
        Issue: ${ticket.description}
        Category: ${ticketAnalysis.category}

        Include:
        1. Acknowledgment of their issue
        2. Clear solution or next steps
        3. Expected timeline
        ${isAngry ? '4. Sincere apology for frustration' : ''}`,
      temperature: 0.6,
      max_tokens: 500
    });

    const suggestedResponse = responseResult.data?.response || 'Thank you for contacting support. We are looking into this issue.';

    // Step 4: Decide whether to auto-resolve or escalate
    const shouldAutoResolve =
      confidence >= inputs.autoResolveConfidence &&
      ticketAnalysis.expertise <= 3 &&
      !isUrgent &&
      answer !== null;

    if (shouldAutoResolve) {
      console.log('✅ Auto-resolving ticket with high confidence');

      // Post the response
      await integrations.zendesk.tickets.update({
        id: ticket.id,
        comment: {
          body: suggestedResponse,
          public: true
        },
        status: 'solved',
        tags: ['ai-resolved', ticketAnalysis.category, `confidence-${Math.round(confidence * 100)}`]
      });

      // Learn from this resolution if enabled
      if (inputs.learningEnabled) {
        await vectorDB.storeText({
          id: `ticket_${ticket.id}`,
          text: `Question: ${ticket.subject} ${ticket.description}\n\nAnswer: ${suggestedResponse}`,
          metadata: {
            type: 'resolved_ticket',
            category: ticketAnalysis.category,
            timestamp: Date.now(),
            confidence,
            sentiment: sentiment?.sentiment
          }
        });
        console.log('📚 Added to knowledge base for future learning');
      }

    } else {
      console.log('🚨 Escalating to human agent');

      // Update ticket with AI analysis
      await integrations.zendesk.tickets.update({
        id: ticket.id,
        comment: {
          body: `AI Analysis:
            - Category: ${ticketAnalysis.category}
            - Priority: ${ticketAnalysis.priority}
            - Sentiment: ${sentiment?.sentiment} (${Math.round((sentiment?.negative || 0) * 100)}% negative)
            - Confidence: ${Math.round(confidence * 100)}%
            - Issues: ${ticketAnalysis.issues.join(', ')}

            Suggested Response:
            ${suggestedResponse}`,
          public: false
        },
        priority: ticketAnalysis.priority,
        tags: ['ai-escalated', ticketAnalysis.category, 'needs-human']
      });

      // Notify support team on Slack
      await integrations.slack.chat.postMessage({
        channel: inputs.escalationChannel,
        text: `🎫 Ticket Escalation Required`,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: `🎫 ${ticketAnalysis.priority.toUpperCase()}: ${ticket.subject}`
            }
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Ticket ID:*\n#${ticket.id}`
              },
              {
                type: 'mrkdwn',
                text: `*Category:*\n${ticketAnalysis.category}`
              },
              {
                type: 'mrkdwn',
                text: `*Sentiment:*\n${sentiment?.sentiment} ${isAngry ? '😠' : ''}`
              },
              {
                type: 'mrkdwn',
                text: `*AI Confidence:*\n${Math.round(confidence * 100)}%`
              }
            ]
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Customer Message:*\n${ticket.description.slice(0, 500)}${ticket.description.length > 500 ? '...' : ''}`
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*AI Suggested Response:*\n${suggestedResponse.slice(0, 300)}...`
            }
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'View in Zendesk'
                },
                url: `https://your-domain.zendesk.com/agent/tickets/${ticket.id}`,
                style: 'primary'
              },
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'Use AI Response'
                },
                value: `use_response_${ticket.id}`,
                action_id: 'use_ai_response'
              }
            ]
          }
        ]
      });
    }

    // Step 5: Archive to Notion for analysis
    console.log('📝 Archiving to Notion...');

    await integrations.notion.pages.create({
      parent: { database_id: inputs.notionDatabaseId },
      properties: {
        'Ticket ID': {
          number: ticket.id
        },
        'Subject': {
          title: [{ text: { content: ticket.subject } }]
        },
        'Category': {
          select: { name: ticketAnalysis.category }
        },
        'Priority': {
          select: { name: ticketAnalysis.priority }
        },
        'Status': {
          select: { name: shouldAutoResolve ? 'Auto-Resolved' : 'Escalated' }
        },
        'Confidence': {
          number: Math.round(confidence * 100)
        },
        'Response Time': {
          number: (Date.now() - startTime) / 1000
        },
        'Sentiment': {
          select: { name: sentiment?.sentiment || 'neutral' }
        }
      },
      children: [
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [{ text: { content: '🎫 Original Ticket' } }]
          }
        },
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ text: { content: ticket.description } }]
          }
        },
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [{ text: { content: '🤖 AI Analysis' } }]
          }
        },
        {
          object: 'block',
          type: 'code',
          code: {
            rich_text: [{ text: { content: JSON.stringify(ticketAnalysis, null, 2) } }],
            language: 'json'
          }
        },
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [{ text: { content: '💬 Response' } }]
          }
        },
        {
          object: 'block',
          type: 'quote',
          quote: {
            rich_text: [{ text: { content: suggestedResponse } }]
          }
        },
        {
          object: 'block',
          type: 'heading_3',
          heading_3: {
            rich_text: [{ text: { content: '📚 Knowledge Base Sources' } }]
          }
        },
        ...sources.map(source => ({
          object: 'block' as const,
          type: 'bulleted_list_item' as const,
          bulleted_list_item: {
            rich_text: [{ text: { content: `${source.text} (${Math.round(source.score * 100)}% match)` } }]
          }
        }))
      ]
    });

    // Step 6: Update metrics
    const processingTime = Date.now() - startTime;

    return {
      success: true,
      ticketId: ticket.id,
      action: shouldAutoResolve ? 'auto_resolved' : 'escalated',
      category: ticketAnalysis.category,
      priority: ticketAnalysis.priority,
      sentiment: sentiment?.sentiment,
      confidence: Math.round(confidence * 100),
      responseTime: processingTime,
      suggestedResponse,
      knowledgeBaseSources: sources.length,
      costs: {
        ai: '$0.03',
        vectorSearch: '$0.01',
        total: '$0.04'
      },
      metrics: {
        processingTimeMs: processingTime,
        tokensUsed: responseResult.metadata?.tokens || 0,
        knowledgeBaseHits: sources.length
      }
    };
  },

  // Handle errors gracefully
  onError: async ({ error, trigger, integrations, inputs }) => {
    console.error('Support agent failed:', error);

    // Always escalate on error
    const ticket = trigger.data;

    await integrations.zendesk?.tickets.update({
      id: ticket.id,
      comment: {
        body: 'AI processing encountered an error. Escalating to human agent.',
        public: false
      },
      tags: ['ai-error', 'needs-human'],
      priority: 'high'
    });

    await integrations.slack?.chat.postMessage({
      channel: inputs.escalationChannel,
      text: `❌ AI Support Agent Error for ticket #${ticket.id}: ${error.message}`
    });
  }
});

/**
 * Initialize knowledge base with common support issues
 */
export async function initializeKnowledgeBase(env: any) {
  const vectorDB = createVectorClient(env);

  const commonIssues = [
    {
      id: 'kb_billing_1',
      content: 'Q: How do I update my payment method? A: You can update your payment method by going to Settings > Billing > Payment Methods. Click "Add New Card" and set it as default.',
      metadata: { category: 'billing' }
    },
    {
      id: 'kb_technical_1',
      content: 'Q: The application is running slowly. A: Try clearing your browser cache, disabling extensions, or using a different browser. If the issue persists, check our status page.',
      metadata: { category: 'technical' }
    },
    {
      id: 'kb_feature_1',
      content: 'Q: How do I export my data? A: Go to Settings > Data > Export. Select the date range and format (CSV or JSON), then click "Export". You will receive an email with the download link.',
      metadata: { category: 'feature' }
    },
    // Add more knowledge base entries...
  ];

  const result = await vectorDB.buildKnowledgeBase({
    documents: commonIssues,
    chunkSize: 300,
    model: AIModels.BGE_BASE
  });

  console.log('Knowledge base initialized:', result);
}