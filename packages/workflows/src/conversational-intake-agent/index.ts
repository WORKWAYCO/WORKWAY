/**
 * Conversational Intake Agent
 *
 * Understand user needs from natural language and route appropriately.
 * AI analyzes context, matches to offerings, asks clarifying questions.
 *
 * Zuhandenheit: "The right solution appears" not "I filled out a form"
 *
 * Integrations: Workers AI only (no external API keys)
 * Trigger: Manual (API call)
 */

import { defineWorkflow, manual } from '@workwayco/sdk';
import { AIModels } from '@workwayco/sdk';

// =============================================================================
// TYPES
// =============================================================================

interface RoutingRules {
	show_template: { confidence_threshold: number };
	clarify: { confidence_threshold: number; max_questions: number };
	consultation: { conditions: string[] };
}

interface AIResponse {
	understanding: string;
	confidence: number;
	matched_template?: string;
	matched_reason?: string;
	clarifying_questions?: string[];
	consultation_reason?: string;
}

interface IntakeResponse {
	success: boolean;
	conversation_id: string;
	understanding: string;
	confidence: number;
	action: 'show_template' | 'clarify' | 'consultation';
	matched_template?: string;
	matched_reason?: string;
	clarifying_questions?: string[];
	consultation_reason?: string;
	error?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_ROUTING_RULES: RoutingRules = {
	show_template: { confidence_threshold: 0.8 },
	clarify: { confidence_threshold: 0.5, max_questions: 2 },
	consultation: { conditions: ['custom_integrations', 'enterprise', 'complex'] },
};

const AI_SYSTEM_PROMPT = `You are an intelligent intake agent that understands user needs and matches them to available solutions.

Your task:
1. Analyze the user's natural language description
2. Match to available templates from the provided context ONLY if there's a genuine fit
3. Return a confidence score (0.0-1.0) based on how well the match fits
4. Decide the appropriate action based on confidence

CRITICAL RULES:
- ONLY match to templates that ACTUALLY exist in the context
- If the user's industry/need is NOT covered by any template, set confidence < 0.5
- DO NOT force a bad match - "gym" is NOT "medical-practice", "pet store" is NOT "fashion-boutique"
- It's better to recommend consultation than suggest a poor-fit template

Confidence scoring:
- 0.85-1.0: Perfect match - user's need clearly maps to a template (e.g., "dental practice" → dental-practice)
- 0.7-0.84: Good match but might need clarification on features
- 0.5-0.69: Unclear - ask clarifying questions
- 0.0-0.49: No good template match exists - recommend consultation

For clarifying questions, ask at most 2-3 focused questions that would help narrow down the right solution.

IMPORTANT: Respond ONLY with valid JSON, no markdown code blocks or extra text.

Response format:
{
  "understanding": "Brief 1-2 sentence summary of what the user needs",
  "confidence": 0.85,
  "matched_template": "template-slug-if-matched OR null if no good match",
  "matched_reason": "Why this template fits their needs",
  "clarifying_questions": ["Question 1?", "Question 2?"],
  "consultation_reason": "Why they need custom consultation (if applicable)"
}`;

// =============================================================================
// WORKFLOW DEFINITION
// =============================================================================

export default defineWorkflow({
	name: 'Conversational Intake Agent',
	description: 'Understand user needs from natural language and route appropriately',
	version: '1.0.0',

	// Pathway metadata for Heideggerian discovery model
	pathway: {
		outcomeFrame: 'when_users_describe_needs',

		outcomeStatement: {
			suggestion: 'Want users to describe what they need in plain English?',
			explanation: 'AI understands context, matches to offerings, asks clarifying questions.',
			outcome: 'Users matched to the right solution',
		},

		primaryPair: {
			from: 'http',
			to: 'http',
			workflowId: 'conversational-intake-agent',
			outcome: 'Natural language that routes itself',
		},

		discoveryMoments: [
			{
				trigger: 'pattern_detected',
				integrations: [],
				workflowId: 'conversational-intake-agent',
				priority: 70,
				pattern: {
					action: 'manual_form_filling',
					threshold: 3,
					period: 'week',
				},
			},
		],

		smartDefaults: {
			model: { value: AIModels.LLAMA_3_8B },
		},

		essentialFields: ['user_spec', 'llm_context_url'],

		zuhandenheit: {
			timeToValue: 1,
			worksOutOfBox: true,
			gracefulDegradation: true,
			automaticTrigger: false,
		},
	},

	pricing: {
		model: 'usage',
		pricePerExecution: 0.01,
		description: 'Pay per intake analysis - $0.01 per request',
	},

	integrations: [], // Uses Workers AI only - no external integrations

	config: {
		user_spec: {
			type: 'textarea',
			label: 'User Specification',
			required: true,
			description: 'Natural language description of what the user needs',
		},
		llm_context_url: {
			type: 'text',
			label: 'Context URL',
			required: true,
			description: 'URL to fetch domain context (templates, capabilities)',
		},
		system_prompt: {
			type: 'textarea',
			label: 'System Prompt',
			required: true,
			default: AI_SYSTEM_PROMPT,
			description: 'AI agent persona and behavior instructions',
		},
		routing_rules: {
			type: 'textarea',
			label: 'Routing Rules (JSON)',
			required: false,
			description: 'JSON config for routing thresholds and conditions',
		},
		model: {
			type: 'select',
			label: 'AI Model',
			options: [AIModels.LLAMA_3_8B, AIModels.LLAMA_2_7B],
			default: AIModels.LLAMA_3_8B,
			description: 'Workers AI model for analysis',
		},
	},

	trigger: manual({
		description: 'Trigger via API call with user specification',
	}),

	async execute({ trigger, inputs, integrations, env, storage }) {
		// 1. Generate conversation ID for tracking
		const conversation_id = crypto.randomUUID();

		try {
			// 2. Fetch context from llm_context_url
			let context: string;
			try {
				const contextResponse = await fetch(inputs.llmContextUrl);
				if (!contextResponse.ok) {
					throw new Error(`Context fetch failed: ${contextResponse.status}`);
				}
				context = await contextResponse.text();
			} catch (fetchError) {
				// Graceful degradation - continue without context
				console.warn('Failed to fetch context, proceeding without:', fetchError);
				context = 'No additional context available.';
			}

			// 3. Parse routing rules with defaults
			const routingRules = parseRoutingRules(inputs.routingRules);

			// 4. Extract valid templates from context to prevent hallucination
			const validTemplates = extractValidTemplates(context);

			// 5. Build the AI prompt
			const prompt = buildPrompt(inputs.userSpec, context);

			// 6. Call Workers AI
			const aiResult = await integrations.ai.generateText({
				model: inputs.model || AIModels.LLAMA_3_8B,
				system: inputs.systemPrompt || AI_SYSTEM_PROMPT,
				prompt,
				temperature: 0.3,
				max_tokens: 500,
			});

			// 7. Parse AI response (handle markdown wrapping)
			const parsed = parseAIResponse(aiResult.data?.response || '');

			// 8. Validate template against known valid templates
			const validatedTemplate = validateTemplate(parsed.matched_template, validTemplates);
			const templateWasHallucinated = parsed.matched_template && !validatedTemplate;

			// 9. Determine action based on routing rules and template validity
			const action = determineAction(parsed, routingRules, validTemplates);

			// 10. Build response
			const response: IntakeResponse = {
				success: true,
				conversation_id,
				understanding: parsed.understanding || 'Unable to understand request',
				confidence: parsed.confidence || 0,
				action,
				// Only include template if it's valid (not hallucinated)
				matched_template: action === 'show_template' ? validatedTemplate : undefined,
				matched_reason: action === 'show_template' ? parsed.matched_reason : undefined,
				clarifying_questions:
					action === 'clarify'
						? (parsed.clarifying_questions || [
								// If template was hallucinated, add a clarifying question
								...(templateWasHallucinated ? ['What specific industry or type of business is this for?'] : []),
						  ]).slice(0, routingRules.clarify.max_questions)
						: undefined,
				consultation_reason: action === 'consultation' ? parsed.consultation_reason : undefined,
			};

			// 9. Store conversation for analytics
			await storage.set(`conversation:${conversation_id}`, {
				timestamp: new Date().toISOString(),
				userSpec: inputs.userSpec,
				response,
				model: inputs.model || AIModels.LLAMA_3_8B,
			});

			return response;
		} catch (error) {
			// Graceful error handling
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';

			// Store failed conversation for debugging
			await storage.set(`conversation:${conversation_id}`, {
				timestamp: new Date().toISOString(),
				userSpec: inputs.userSpec,
				error: errorMessage,
			});

			return {
				success: false,
				conversation_id,
				understanding: 'Unable to process request',
				confidence: 0,
				action: 'consultation' as const,
				consultation_reason: 'An error occurred during processing. A human consultation is recommended.',
				error: errorMessage,
			};
		}
	},
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Parse routing rules JSON with defaults
 */
function parseRoutingRules(rulesJson?: string): RoutingRules {
	if (!rulesJson) {
		return DEFAULT_ROUTING_RULES;
	}

	try {
		const parsed = JSON.parse(rulesJson);
		return {
			show_template: {
				confidence_threshold:
					parsed.show_template?.confidence_threshold ??
					DEFAULT_ROUTING_RULES.show_template.confidence_threshold,
			},
			clarify: {
				confidence_threshold:
					parsed.clarify?.confidence_threshold ?? DEFAULT_ROUTING_RULES.clarify.confidence_threshold,
				max_questions: parsed.clarify?.max_questions ?? DEFAULT_ROUTING_RULES.clarify.max_questions,
			},
			consultation: {
				conditions: parsed.consultation?.conditions ?? DEFAULT_ROUTING_RULES.consultation.conditions,
			},
		};
	} catch {
		return DEFAULT_ROUTING_RULES;
	}
}

/**
 * Build the AI prompt with user spec and context
 */
function buildPrompt(userSpec: string, context: string): string {
	return `User needs: ${userSpec}

Available context:
${context}

Analyze the user's needs and respond with a JSON object containing:
- understanding: Brief summary of what they need
- confidence: Your confidence score (0.0-1.0) in matching to a template
- matched_template: Template slug if you found a good match
- matched_reason: Why this template fits
- clarifying_questions: Questions to ask if unsure (max 3)
- consultation_reason: Why custom consultation is needed (if applicable)`;
}

/**
 * Parse AI response, handling markdown code block wrapping
 */
function parseAIResponse(response: string): AIResponse {
	if (!response) {
		return {
			understanding: 'No response from AI',
			confidence: 0,
		};
	}

	// Strip markdown code blocks if present
	let jsonStr = response.trim();

	// Handle ```json ... ``` wrapping
	const jsonBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
	if (jsonBlockMatch) {
		jsonStr = jsonBlockMatch[1].trim();
	}

	// Handle plain ``` ... ``` wrapping
	if (jsonStr.startsWith('```') && jsonStr.endsWith('```')) {
		jsonStr = jsonStr.slice(3, -3).trim();
	}

	try {
		const parsed = JSON.parse(jsonStr);
		return {
			understanding: parsed.understanding || 'Unable to parse understanding',
			confidence: typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0,
			matched_template: parsed.matched_template,
			matched_reason: parsed.matched_reason,
			clarifying_questions: Array.isArray(parsed.clarifying_questions) ? parsed.clarifying_questions : [],
			consultation_reason: parsed.consultation_reason,
		};
	} catch {
		// If JSON parsing fails, try to extract what we can
		return {
			understanding: response.slice(0, 200),
			confidence: 0,
			consultation_reason: 'AI response was not valid JSON',
		};
	}
}

/**
 * Extract valid template slugs from the LLM context
 * Looks for patterns like **template-slug** - "description"
 */
function extractValidTemplates(context: string): Set<string> {
	const templates = new Set<string>();
	
	// Match **template-slug** patterns (markdown bold template names)
	const boldPattern = /\*\*([a-z][a-z0-9-]*)\*\*/g;
	let match;
	while ((match = boldPattern.exec(context)) !== null) {
		// Filter out non-template bold text by checking for typical patterns
		const slug = match[1];
		if (slug.includes('-') || ['crm', 'inventory', 'restaurant'].includes(slug)) {
			templates.add(slug);
		}
	}
	
	return templates;
}

/**
 * Validate that a template slug exists in the valid set
 * Returns the slug if valid, undefined if hallucinated
 */
function validateTemplate(
	template: string | undefined,
	validTemplates: Set<string>
): string | undefined {
	if (!template) return undefined;
	
	const normalized = template.toLowerCase().trim();
	
	// Direct match
	if (validTemplates.has(normalized)) {
		return normalized;
	}
	
	// Try fuzzy matching for common variations
	// e.g., "gym-website" might match "fitness" if we had one
	// For now, strict validation - if it's not in the list, it's hallucinated
	return undefined;
}

/**
 * Determine action based on confidence and routing rules
 */
function determineAction(
	parsed: AIResponse,
	rules: RoutingRules,
	validTemplates?: Set<string>
): 'show_template' | 'clarify' | 'consultation' {
	const { confidence, consultation_reason, matched_template } = parsed;

	// Check for consultation conditions
	if (consultation_reason) {
		const lowerReason = consultation_reason.toLowerCase();
		for (const condition of rules.consultation.conditions) {
			if (lowerReason.includes(condition.toLowerCase())) {
				return 'consultation';
			}
		}
	}

	// Validate template if we have a valid set
	const templateIsValid = validTemplates 
		? validateTemplate(matched_template, validTemplates) !== undefined
		: !!matched_template;

	// High confidence with a VALID matched template -> show it
	if (confidence >= rules.show_template.confidence_threshold && matched_template && templateIsValid) {
		return 'show_template';
	}

	// If AI claimed high confidence but template is invalid (hallucinated), demote to clarify
	if (confidence >= rules.show_template.confidence_threshold && matched_template && !templateIsValid) {
		return 'clarify';
	}

	// Medium confidence -> ask clarifying questions
	if (confidence >= rules.clarify.confidence_threshold) {
		return 'clarify';
	}

	// Low confidence -> consultation
	return 'consultation';
}

// =============================================================================
// METADATA
// =============================================================================

export const metadata = {
	id: 'conversational-intake-agent',
	category: 'productivity',
	featured: false,
	stats: { rating: 0, users: 0, reviews: 0 },
};
