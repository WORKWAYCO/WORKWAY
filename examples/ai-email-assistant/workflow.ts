/**
 * AI Email Assistant Workflow
 *
 * This workflow demonstrates the power of combining Cloudflare Workers AI
 * with traditional integrations to create intelligent automation.
 *
 * Features:
 * - Automatically processes incoming emails
 * - Uses AI to categorize, summarize, and extract action items
 * - Creates organized Notion pages with AI-enhanced content
 * - Sends intelligent Slack notifications
 *
 * Cost: ~$0.02 per email processed (including AI costs)
 * Value: Saves 10+ minutes of manual work per email
 */

import { defineWorkflow, webhook } from '@workway/sdk';
import { createAIClient, AIModels } from '@workway/sdk/workers-ai';

export default defineWorkflow({
  name: 'AI Email Assistant',
  description: 'Process emails with AI to extract insights and organize in Notion',
  version: '1.0.0',

  // This workflow uses AI but is still cost-effective
  pricing: {
    model: 'usage',
    pricePerExecution: 0.05, // 5 cents per email
    description: 'Includes AI processing, perfect for 100-500 emails/month'
  },

  // Required integrations
  integrations: [
    { service: 'gmail', scopes: ['read_emails', 'modify_labels'] },
    { service: 'notion', scopes: ['write_pages', 'read_databases'] },
    { service: 'slack', scopes: ['send_messages'] }
  ],

  // User configuration
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
    emailLabels: {
      type: 'array',
      label: 'Gmail Labels to Process',
      default: ['INBOX'],
      items: { type: 'string' }
    },
    aiModel: {
      type: 'select',
      label: 'AI Model',
      options: ['fast', 'balanced', 'powerful'],
      default: 'balanced',
      description: 'Fast: Llama 2, Balanced: Llama 3, Powerful: Mixtral'
    }
  },

  // Trigger on new Gmail emails
  trigger: webhook({
    service: 'gmail',
    event: 'message.received'
  }),

  async execute({ trigger, inputs, integrations, env }) {
    const email = trigger.data;

    // Initialize Workers AI
    const ai = createAIClient(env);

    // Step 1: Fetch full email content
    const fullEmail = await integrations.gmail.messages.get({
      messageId: email.id,
      format: 'full'
    });

    const emailContent = {
      from: fullEmail.from,
      subject: fullEmail.subject,
      body: fullEmail.body,
      attachments: fullEmail.attachments?.length || 0,
      date: fullEmail.date
    };

    // Step 2: AI Analysis Pipeline
    console.log('🤖 Starting AI analysis...');

    // Select model based on user preference
    const model = inputs.aiModel === 'fast'
      ? AIModels.LLAMA_2_7B
      : inputs.aiModel === 'powerful'
        ? AIModels.MISTRAL_7B
        : AIModels.LLAMA_3_8B;

    // 2a. Categorize the email
    const categorization = await ai.generateText({
      model,
      system: 'You are an email categorization expert. Categorize emails into: Customer Support, Sales, Internal, Marketing, Urgent, or Other.',
      prompt: `Categorize this email:\nFrom: ${emailContent.from}\nSubject: ${emailContent.subject}\nBody: ${emailContent.body.slice(0, 500)}`,
      temperature: 0.3,
      max_tokens: 50,
      cache: true // Cache similar categorizations
    });

    const category = categorization.data?.response || 'Other';

    // 2b. Generate summary
    const summary = await ai.generateText({
      model,
      system: 'You are an expert at summarizing emails concisely. Create a 2-3 sentence summary.',
      prompt: `Summarize this email:\n\n${emailContent.body}`,
      temperature: 0.5,
      max_tokens: 150,
      cache: true
    });

    // 2c. Extract action items
    const actionItems = await ai.generateText({
      model,
      system: 'Extract action items from emails. Return as a JSON array of strings. If no action items, return empty array.',
      prompt: `Extract action items from:\n\n${emailContent.body}`,
      temperature: 0.2,
      max_tokens: 200,
      cache: true
    });

    let parsedActionItems = [];
    try {
      parsedActionItems = JSON.parse(actionItems.data?.response || '[]');
    } catch {
      parsedActionItems = [];
    }

    // 2d. Determine priority using sentiment and content analysis
    const priorityAnalysis = await ai.analyzeSentiment({
      text: emailContent.subject + ' ' + emailContent.body.slice(0, 500)
    });

    const isUrgent =
      category === 'Urgent' ||
      priorityAnalysis.data?.negative > 0.7 ||
      emailContent.subject.toLowerCase().includes('urgent') ||
      emailContent.subject.toLowerCase().includes('asap');

    const priority = isUrgent ? 'High' :
                    category === 'Customer Support' ? 'Medium' :
                    'Low';

    // 2e. Generate smart reply suggestions
    const replyGeneratedResult = await ai.generateText({
      model: AIModels.LLAMA_2_7B, // Use faster model for suggestions
      system: 'Generate 3 brief reply options for this email. Format as JSON array.',
      prompt: `Email: ${emailContent.body.slice(0, 300)}\n\nGenerate 3 reply options:`,
      temperature: 0.8,
      max_tokens: 200
    });

    let smartReplies = [];
    try {
      smartReplies = JSON.parse(replyGeneratedResult.data?.response || '[]');
    } catch {
      smartReplies = ['Acknowledge receipt', 'Request more info', 'Schedule a call'];
    }

    // Step 3: Create enhanced Notion page
    console.log('📝 Creating Notion page...');

    const notionPage = await integrations.notion.pages.create({
      parent: { database_id: inputs.notionDatabaseId },
      properties: {
        'Title': {
          title: [{
            text: { content: `${category}: ${emailContent.subject}` }
          }]
        },
        'Category': {
          select: { name: category }
        },
        'Priority': {
          select: { name: priority }
        },
        'From': {
          email: emailContent.from
        },
        'Date': {
          date: { start: emailContent.date }
        },
        'Status': {
          select: { name: 'New' }
        }
      },
      children: [
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [{ text: { content: '📧 Original Email' } }]
          }
        },
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ text: { content: emailContent.body } }]
          }
        },
        {
          object: 'block',
          type: 'divider',
          divider: {}
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
          type: 'heading_3',
          heading_3: {
            rich_text: [{ text: { content: 'Summary' } }]
          }
        },
        {
          object: 'block',
          type: 'quote',
          quote: {
            rich_text: [{ text: { content: summary.data?.response || 'No summary available' } }]
          }
        },
        {
          object: 'block',
          type: 'heading_3',
          heading_3: {
            rich_text: [{ text: { content: 'Action Items' } }]
          }
        },
        ...parsedActionItems.map(item => ({
          object: 'block' as const,
          type: 'to_do' as const,
          to_do: {
            rich_text: [{ text: { content: item } }],
            checked: false
          }
        })),
        {
          object: 'block',
          type: 'heading_3',
          heading_3: {
            rich_text: [{ text: { content: 'Suggested Replies' } }]
          }
        },
        ...smartReplies.map((reply, i) => ({
          object: 'block' as const,
          type: 'bulleted_list_item' as const,
          bulleted_list_item: {
            rich_text: [{ text: { content: `Option ${i + 1}: ${reply}` } }]
          }
        }))
      ]
    });

    // Step 4: Send Slack notification for urgent emails
    if (priority === 'High') {
      console.log('🚨 Sending urgent notification to Slack...');

      await integrations.slack.chat.postMessage({
        channel: inputs.slackChannel,
        text: `🚨 Urgent Email Received`,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: `🚨 ${category}: ${emailContent.subject}`
            }
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*From:*\n${emailContent.from}`
              },
              {
                type: 'mrkdwn',
                text: `*Priority:*\n${priority}`
              }
            ]
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Summary:*\n${summary.data?.response || 'No summary'}`
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Action Items:*\n${parsedActionItems.map(item => `• ${item}`).join('\n') || 'None'}`
            }
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'View in Notion'
                },
                url: notionPage.url
              },
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'Reply in Gmail'
                },
                url: `https://mail.google.com/mail/#inbox/${email.id}`
              }
            ]
          }
        ]
      });
    }

    // Step 5: Update Gmail labels
    await integrations.gmail.messages.modify({
      messageId: email.id,
      addLabelIds: [`AI_Processed_${category}`],
      removeLabelIds: ['UNREAD']
    });

    // Step 6: Generate embeddings for semantic search (optional)
    const embeddings = await ai.generateEmbeddings({
      text: `${emailContent.subject} ${summary.data?.response}`,
      model: AIModels.BGE_SMALL
    });

    // Store embeddings for future semantic search
    // This enables "find emails similar to this one" functionality
    await integrations.storage?.set(`embedding:${email.id}`, {
      vector: embeddings.data,
      metadata: {
        subject: emailContent.subject,
        category,
        priority,
        date: emailContent.date
      }
    });

    // Return comprehensive result
    return {
      success: true,
      emailId: email.id,
      notionPageId: notionPage.id,
      notionUrl: notionPage.url,
      category,
      priority,
      summary: summary.data?.response,
      actionItems: parsedActionItems,
      suggestedReplies: smartReplies,
      aiCosts: {
        estimated: '$0.02',
        tokens: (categorization.metadata?.tokens || 0) +
                (summary.metadata?.tokens || 0) +
                (actionItems.metadata?.tokens || 0),
        models: [model]
      },
      performance: {
        totalTime: Date.now() - trigger.timestamp,
        cached: categorization.metadata?.cached || false
      }
    };
  },

  // Error handling
  onError: async ({ error, integrations, inputs }) => {
    console.error('Workflow failed:', error);

    // Send error notification
    await integrations.slack?.chat.postMessage({
      channel: inputs.slackChannel,
      text: `❌ Email processing failed: ${error.message}`
    });
  }
});

/**
 * Testing the workflow locally
 */
export async function testWorkflow() {
  const mockEmail = {
    id: 'test-123',
    from: 'customer@example.com',
    subject: 'Urgent: System is down',
    body: 'Our production system has been down for 2 hours. We need immediate assistance. Please check the database connections and restart the servers if necessary. This is affecting all our customers.',
    date: new Date().toISOString()
  };

  console.log('Testing AI Email Assistant with:', mockEmail);

  // Test would run here with mock data
}