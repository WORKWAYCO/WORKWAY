/**
 * Meeting Intelligence Workflow
 *
 * ZUHANDENHEIT VERSION: Tools completely recede.
 *
 * The developer thinks:
 * - "Transcribe this recording" → `ai.transcribe(audio)`
 * - "Extract meeting insights" → `ai.synthesize(transcript, { type: 'meeting' })`
 * - "Create tasks from action items" → `linear.createTasks(actionItems)`
 * - "Save meeting notes" → `notion.createDocument({ template: 'meeting' })`
 * - "Notify attendees" → `slack.notifyParticipants(summary)`
 *
 * A common workflow for teams using:
 * - Zoom/Google Meet for recordings
 * - Linear/Asana for task management
 * - Notion for documentation
 * - Slack for notifications
 */

import { defineWorkflow, webhook } from '@workway/sdk';
import { createAIClient } from '@workway/sdk/workers-ai';

// Schema for meeting synthesis
const MeetingSchema = {
  title: 'string',
  summary: 'string',
  attendees: 'string[]',
  decisions: 'string[]',
  actionItems: 'string[]',
  followUps: 'string[]',
  keyTopics: 'string[]',
  sentiment: 'string',
  duration: 'string',
} as const;

export default defineWorkflow({
  name: 'Meeting Intelligence',
  description: 'Transform meeting recordings into actionable knowledge',
  version: '1.0.0',

  pricing: {
    model: 'usage',
    pricePerExecution: 0.25,
    description: 'Includes transcription + AI analysis + task creation'
  },

  integrations: [
    { service: 'zoom', scopes: ['read_recordings'] },
    { service: 'linear', scopes: ['write_issues', 'read_teams'] },
    { service: 'notion', scopes: ['write_pages', 'read_databases'] },
    { service: 'slack', scopes: ['send_messages', 'read_users'] }
  ],

  inputs: {
    notionDatabaseId: {
      type: 'notion_database_picker',
      label: 'Meeting Notes Database',
      required: true
    },
    linearTeamId: {
      type: 'linear_team_picker',
      label: 'Linear Team for Action Items',
      required: true
    },
    slackChannel: {
      type: 'slack_channel_picker',
      label: 'Meeting Summaries Channel',
      required: true
    },
    autoCreateTasks: {
      type: 'boolean',
      label: 'Auto-create Linear tasks from action items',
      default: true
    },
    notifyAttendees: {
      type: 'boolean',
      label: 'DM attendees their action items',
      default: true
    },
    synthesisDepth: {
      type: 'select',
      label: 'Analysis Depth',
      options: ['quick', 'standard', 'detailed'],
      default: 'standard'
    }
  },

  trigger: webhook({
    service: 'zoom',
    event: 'recording.completed'
  }),

  async execute({ trigger, inputs, integrations, env }) {
    const recording = trigger.data;
    const ai = createAIClient(env).for('synthesis', inputs.synthesisDepth || 'standard');

    // 1. Download and transcribe recording (tools recede)
    const audioUrl = recording.download_url;
    const audioBuffer = await fetch(audioUrl).then(r => r.arrayBuffer());

    const transcription = await ai.transcribeAudio({
      audio: audioBuffer,
      language: 'en'
    });

    const transcript = transcription.data?.text || '';

    // 2. Synthesize meeting insights (tools recede)
    const synthesis = await ai.synthesize<typeof MeetingSchema>(transcript, {
      type: 'meeting' as any,
      output: MeetingSchema,
      context: `Meeting: ${recording.topic}\nDate: ${recording.start_time}\nDuration: ${recording.duration} minutes`
    });

    const meeting = synthesis.data!;

    // 3. Create Notion page (tools recede)
    const notionPage = await integrations.notion.createDocument({
      database: inputs.notionDatabaseId,
      template: 'meeting' as any,
      data: {
        title: meeting.title || recording.topic,
        date: recording.start_time,
        summary: meeting.summary,
        properties: {
          'Duration': { number: recording.duration },
          'Attendees': { multi_select: meeting.attendees.map(a => ({ name: a })) },
          'Sentiment': { select: { name: meeting.sentiment } },
          'Status': { select: { name: 'Processed' } }
        },
        sections: {
          decisions: meeting.decisions,
          actionItems: meeting.actionItems,
          followUps: meeting.followUps,
          keyTopics: meeting.keyTopics
        },
        content: transcript
      }
    });

    // 4. Create Linear tasks from action items (tools recede)
    const createdTasks: Array<{ id: string; title: string; url: string }> = [];

    if (inputs.autoCreateTasks && meeting.actionItems.length > 0) {
      for (const item of meeting.actionItems) {
        // Extract assignee if mentioned (e.g., "@john: Review the PR")
        const assigneeMatch = item.match(/^@(\w+):\s*/);
        const assignee = assigneeMatch ? assigneeMatch[1] : undefined;
        const title = assigneeMatch ? item.replace(assigneeMatch[0], '') : item;

        // Linear integration with Zuhandenheit patterns:
        // - assigneeByName resolves user ID automatically
        // - labels accepts names, not IDs
        const task = await integrations.linear.issues.create({
          teamId: inputs.linearTeamId,
          title: title,
          description: `From meeting: ${meeting.title}\n\n${notionPage.data?.url}`,
          assigneeByName: assignee, // Zuhandenheit: no user ID lookup needed
          labels: ['meeting-action-item'] // Zuhandenheit: labels by name
        });

        if (task.success && task.data) {
          createdTasks.push({
            id: task.data.id,
            title: title,
            url: task.data.url
          });
        }
      }
    }

    // 5. Post summary to Slack (tools recede)
    const taskList = createdTasks.length > 0
      ? `\n\n*Action Items (${createdTasks.length} tasks created):*\n${createdTasks.map(t => `• <${t.url}|${t.title}>`).join('\n')}`
      : meeting.actionItems.length > 0
      ? `\n\n*Action Items:*\n${meeting.actionItems.map(i => `• ${i}`).join('\n')}`
      : '';

    await integrations.slack.sendMessage({
      channel: inputs.slackChannel,
      text: `📋 *Meeting Summary: ${meeting.title}*\n\n${meeting.summary}${taskList}\n\n<${notionPage.data?.url}|View full notes in Notion>`
    });

    // 6. DM attendees their specific action items (tools recede)
    if (inputs.notifyAttendees && meeting.actionItems.length > 0) {
      for (const attendee of meeting.attendees) {
        // Find action items assigned to this attendee
        const theirItems = meeting.actionItems.filter(item =>
          item.toLowerCase().includes(attendee.toLowerCase()) ||
          item.startsWith(`@${attendee}`)
        );

        if (theirItems.length > 0) {
          await integrations.slack.sendDirectMessage({
            userByName: attendee,
            text: `👋 You have ${theirItems.length} action item(s) from *${meeting.title}*:\n\n${theirItems.map(i => `• ${i}`).join('\n')}\n\n<${notionPage.data?.url}|View meeting notes>`
          });
        }
      }
    }

    return {
      success: true,
      meeting: {
        title: meeting.title,
        duration: recording.duration,
        attendees: meeting.attendees.length,
        decisions: meeting.decisions.length,
        actionItems: meeting.actionItems.length,
      },
      outputs: {
        notionUrl: notionPage.data?.url,
        tasksCreated: createdTasks.length,
        attendeesNotified: inputs.notifyAttendees ? meeting.attendees.length : 0
      }
    };
  },

  onError: async ({ error, trigger, integrations, inputs }) => {
    await integrations.slack?.sendMessage({
      channel: inputs.slackChannel,
      text: `❌ Failed to process meeting "${trigger.data?.topic}": ${error.message}`
    });
  }
});

/**
 * WHY THIS WORKFLOW?
 *
 * This demonstrates the full Zuhandenheit experience:
 * 1. Multi-service orchestration (Zoom → AI → Notion → Linear → Slack)
 * 2. AI transcription and synthesis
 * 3. Intelligent task extraction and assignment
 * 4. Context-aware notifications
 *
 * The developer never thinks about:
 * - Whisper model parameters
 * - JSON parsing for structured output
 * - Notion block construction
 * - Slack user ID lookups (uses `userByName`)
 * - Linear team/assignee resolution
 *
 * The tools have receded. The developer thinks only in intent.
 */
