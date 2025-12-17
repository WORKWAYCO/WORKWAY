export interface Lesson {
	id: string;
	title: string;
	description: string;
	duration: string;
	praxis?: string;
	templateWorkflow?: {
		id: string;
		name: string;
		description: string;
	};
}

export interface Path {
	id: string;
	title: string;
	description: string;
	icon: string;
	difficulty: 'beginner' | 'intermediate' | 'advanced';
	estimatedHours: number;
	lessons: Lesson[];
}

export const paths: Path[] = [
	{
		id: 'getting-started',
		title: 'Getting Started',
		description: 'Set up your local development environment with WezTerm, Claude Code, and essential tools.',
		icon: 'terminal',
		difficulty: 'beginner',
		estimatedHours: 2,
		lessons: [
			{
				id: 'wezterm-setup',
				title: 'WezTerm Installation & Configuration',
				description: 'Install WezTerm and configure it for optimal developer experience.',
				duration: '15 min'
			},
			{
				id: 'claude-code-setup',
				title: 'Claude Code Setup',
				description: 'Install Claude Code CLI and authenticate with your Anthropic account.',
				duration: '10 min'
			},
			{
				id: 'neomutt-setup',
				title: 'Neomutt for Email Workflow',
				description: 'Configure Neomutt for terminal-based email management.',
				duration: '20 min'
			},
			{
				id: 'workway-cli',
				title: 'WORKWAY CLI Installation',
				description: 'Install the WORKWAY CLI and connect to your account.',
				duration: '10 min'
			},
			{
				id: 'essential-commands',
				title: 'Essential Commands & Shortcuts',
				description: 'Learn the key commands and shortcuts for efficient workflow development.',
				duration: '15 min'
			}
		]
	},
	{
		id: 'workflow-foundations',
		title: 'Workflow Foundations',
		description: 'Understand the core concepts of WORKWAY: defineWorkflow(), integrations, and triggers.',
		icon: 'workflow',
		difficulty: 'beginner',
		estimatedHours: 3,
		lessons: [
			{
				id: 'what-is-workflow',
				title: 'What is a Workflow?',
				description: 'Understand the Zuhandenheit philosophy and how workflows create invisible automation.',
				duration: '15 min'
			},
			{
				id: 'define-workflow-pattern',
				title: 'The defineWorkflow() Pattern',
				description: 'Learn the structure of a WORKWAY workflow and its required components.',
				duration: '25 min'
			},
			{
				id: 'integrations-oauth',
				title: 'Integrations & OAuth Providers',
				description: 'Connect external services using the BaseAPIClient pattern.',
				duration: '30 min'
			},
			{
				id: 'config-schemas',
				title: 'Configuration Schemas',
				description: 'Define user inputs, steps, and resource selectors for your workflows.',
				duration: '25 min'
			},
			{
				id: 'triggers',
				title: 'Triggers: Webhooks, Cron, Manual',
				description: 'Learn the different ways workflows can be triggered.',
				duration: '20 min'
			}
		]
	},
	{
		id: 'building-workflows',
		title: 'Building Workflows',
		description: 'Hands-on development of real workflows with Gmail, Slack, Zoom, and Workers AI.',
		icon: 'code',
		difficulty: 'intermediate',
		estimatedHours: 5,
		lessons: [
			{
				id: 'first-workflow',
				title: 'Your First Workflow',
				description: 'Build a Gmail to Notion sync workflow from scratch.',
				duration: '45 min',
				praxis: 'Create a workflow that saves starred Gmail messages to a Notion database.',
				templateWorkflow: {
					id: 'int_gmail_to_notion_private',
					name: 'Gmail to Notion',
					description: 'Sync Gmail messages to Notion database'
				}
			},
			{
				id: 'working-with-integrations',
				title: 'Working with Integrations',
				description: 'Connect Slack, Zoom, and Stripe to your workflows.',
				duration: '40 min'
			},
			{
				id: 'workers-ai',
				title: 'Using Workers AI for Intelligence',
				description: 'Add AI-powered summarization, classification, and generation.',
				duration: '35 min'
			},
			{
				id: 'error-handling',
				title: 'Error Handling & Retry Patterns',
				description: 'Build resilient workflows that handle failures gracefully.',
				duration: '30 min'
			},
			{
				id: 'local-testing',
				title: 'Testing Workflows Locally',
				description: 'Use wrangler dev and mocking for local development.',
				duration: '25 min'
			}
		]
	},
	{
		id: 'systems-thinking',
		title: 'Systems Thinking',
		description: 'Advanced patterns for compound workflows, private deployments, and agency architectures.',
		icon: 'brain',
		difficulty: 'advanced',
		estimatedHours: 4,
		lessons: [
			{
				id: 'compound-workflows',
				title: 'Compound Workflows',
				description: 'Orchestrate multi-step workflows: Meeting → Notion + Slack + Email + CRM.',
				duration: '45 min',
				templateWorkflow: {
					id: 'int_meeting_to_notion_sync',
					name: 'Meeting Intelligence',
					description: 'Full meeting workflow with transcripts and follow-ups'
				}
			},
			{
				id: 'private-workflows',
				title: 'Private Workflows & BYOO Patterns',
				description: 'Build organization-specific workflows with access control.',
				duration: '35 min'
			},
			{
				id: 'agency-patterns',
				title: 'Agency Workflow Patterns',
				description: 'Create reusable workflow patterns for client deployments.',
				duration: '40 min'
			},
			{
				id: 'performance-rate-limiting',
				title: 'Performance & Rate Limiting',
				description: 'Optimize workflows for production scale.',
				duration: '30 min'
			},
			{
				id: 'monitoring-debugging',
				title: 'Monitoring & Debugging',
				description: 'Use Cloudflare analytics and logs for production troubleshooting.',
				duration: '25 min'
			}
		]
	}
];

export function getPath(pathId: string): Path | undefined {
	return paths.find((p) => p.id === pathId);
}

export function getLesson(pathId: string, lessonId: string): Lesson | undefined {
	const path = getPath(pathId);
	return path?.lessons.find((l) => l.id === lessonId);
}

export function getNextLesson(pathId: string, currentLessonId: string): Lesson | undefined {
	const path = getPath(pathId);
	if (!path) return undefined;

	const currentIndex = path.lessons.findIndex((l) => l.id === currentLessonId);
	if (currentIndex === -1 || currentIndex === path.lessons.length - 1) return undefined;

	return path.lessons[currentIndex + 1];
}

export function getPreviousLesson(pathId: string, currentLessonId: string): Lesson | undefined {
	const path = getPath(pathId);
	if (!path) return undefined;

	const currentIndex = path.lessons.findIndex((l) => l.id === currentLessonId);
	if (currentIndex <= 0) return undefined;

	return path.lessons[currentIndex - 1];
}
