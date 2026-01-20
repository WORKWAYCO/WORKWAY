/**
 * Meeting Intelligence - Shared Utilities
 *
 * Common functions used by both public and private meeting-intelligence workflows.
 * DRY Fix: Consolidated from meeting-intelligence/index.ts and meeting-intelligence-private/index.ts
 */

import { AIModels } from '@workwayco/sdk';

// ============================================================================
// TYPES
// ============================================================================

export interface MeetingAnalysis {
	summary: string;
	decisions: string[];
	actionItems: Array<{ task: string; assignee: string | null }>;
	followUps: string[];
	keyTopics: string[];
	sentiment: 'positive' | 'neutral' | 'concerned';
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Maximum characters per Notion block (with buffer) */
export const NOTION_BLOCK_CHAR_LIMIT = 1900;

/** Depth instruction mappings for AI analysis */
export const DEPTH_INSTRUCTIONS: Record<string, string> = {
	brief: 'Keep summary to 2-3 sentences. List only the most critical items.',
	standard: 'Provide thorough summary in 4-6 sentences. Include all notable items.',
	detailed: 'Comprehensive analysis with full context. Include all items discussed.',
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Analyze meeting transcript using AI
 *
 * @param transcript - Meeting transcript text
 * @param topic - Meeting topic/title
 * @param depth - Analysis depth: 'brief' | 'standard' | 'detailed'
 * @param integrations - Workflow integrations object
 * @param env - Environment bindings
 * @returns Parsed meeting analysis or null on failure
 */
export async function analyzeMeeting(
	transcript: string,
	topic: string,
	depth: string,
	integrations: any,
	env: any
): Promise<MeetingAnalysis | null> {
	try {
		const result = await integrations.ai.generateText({
			model: AIModels.LLAMA_3_8B,
			system: `You are a meeting analyst. Analyze the transcript and extract structured insights.

${DEPTH_INSTRUCTIONS[depth] || DEPTH_INSTRUCTIONS.standard}

Return ONLY valid JSON in this format:
{
  "summary": "Brief summary of the meeting",
  "decisions": ["Decision 1", "Decision 2"],
  "actionItems": [
    {"task": "Task description", "assignee": "Person name or null"},
    {"task": "Another task", "assignee": null}
  ],
  "followUps": ["Follow-up item 1", "Follow-up item 2"],
  "keyTopics": ["Topic 1", "Topic 2"],
  "sentiment": "positive" | "neutral" | "concerned"
}`,
			prompt: `Meeting: ${topic}\n\nTranscript:\n${transcript.slice(0, 8000)}`,
			temperature: 0.3,
			max_tokens: 1000,
		});

		const responseText = result.data?.response || '{}';

		// Parse JSON from response
		const jsonMatch = responseText.match(/\{[\s\S]*\}/);
		if (jsonMatch) {
			return JSON.parse(jsonMatch[0]);
		}

		return null;
	} catch (error) {
		console.error('AI analysis failed:', error);
		return null;
	}
}

/**
 * Split transcript into Notion paragraph blocks
 *
 * Respects Notion's character limits and splits at natural boundaries
 * (paragraphs or speaker changes).
 *
 * @param transcript - Meeting transcript text
 * @returns Array of Notion block objects
 */
export function splitTranscriptIntoBlocks(transcript: string): any[] {
	const blocks: any[] = [];

	// Split by paragraphs or speaker changes
	const segments = transcript.split(/\n\n|\n(?=[A-Z][a-z]+:)/);

	let currentBlock = '';

	for (const segment of segments) {
		if (currentBlock.length + segment.length + 1 > NOTION_BLOCK_CHAR_LIMIT) {
			if (currentBlock) {
				blocks.push({
					object: 'block',
					type: 'paragraph',
					paragraph: { rich_text: [{ text: { content: currentBlock } }] },
				});
			}
			currentBlock = segment;
		} else {
			currentBlock = currentBlock ? `${currentBlock}\n${segment}` : segment;
		}
	}

	if (currentBlock) {
		blocks.push({
			object: 'block',
			type: 'paragraph',
			paragraph: { rich_text: [{ text: { content: currentBlock } }] },
		});
	}

	return blocks.length > 0
		? blocks
		: [
				{
					object: 'block',
					type: 'paragraph',
					paragraph: { rich_text: [{ text: { content: 'No transcript available' } }] },
				},
		  ];
}
