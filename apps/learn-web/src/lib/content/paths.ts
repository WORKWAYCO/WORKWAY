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
		description: 'Get your development environment ready in under 2 hours. Install WezTerm, Claude Code, and WORKWAY CLI—everything needed to start building workflows.',
		icon: 'terminal',
		difficulty: 'beginner',
		estimatedHours: 2,
		lessons: [
			{
				id: 'wezterm-setup',
				title: 'WezTerm Installation & Configuration',
				description: 'Install WezTerm and configure it for optimal developer experience.',
				duration: '15 min',
				praxis: 'Install WezTerm and configure it with a monochrome theme. Create ~/.config/wezterm/wezterm.lua with pure black background.'
			},
			{
				id: 'claude-code-setup',
				title: 'Claude Code Setup',
				description: 'Install Claude Code CLI and authenticate with your Anthropic account.',
				duration: '10 min',
				praxis: 'Navigate to a project directory and ask Claude Code: "What patterns are used in the workflows folder?"'
			},
			{
				id: 'neomutt-setup',
				title: 'Neomutt for Email Workflow',
				description: 'Configure Neomutt for terminal-based email management.',
				duration: '20 min',
				praxis: 'Install Neomutt and configure it for Gmail with an app password. Practice navigation with j/k and search with /.'
			},
			{
				id: 'workway-cli',
				title: 'WORKWAY CLI Installation',
				description: 'Install the WORKWAY CLI and connect to your account.',
				duration: '10 min',
				praxis: 'Install the WORKWAY CLI and run: workway --version, workway login, workway whoami. Initialize a test project.'
			},
			{
				id: 'essential-commands',
				title: 'Essential Commands & Shortcuts',
				description: 'Learn the key commands and shortcuts for efficient workflow development.',
				duration: '15 min',
				praxis: 'Add WORKWAY development aliases to your shell config (wd, wdp, wl, gs, cc) and practice keyboard shortcuts.'
			}
		]
	},
	{
		id: 'workflow-foundations',
		title: 'Workflow Foundations',
		description: 'Understand the building blocks that make automations work. Learn patterns for connecting services, handling OAuth, and triggering workflows reliably.',
		icon: 'workflow',
		difficulty: 'beginner',
		estimatedHours: 3,
		lessons: [
			{
				id: 'what-is-workflow',
				title: 'What is a Workflow?',
				description: 'Understand the Zuhandenheit philosophy and how workflows create invisible automation.',
				duration: '15 min',
				praxis: 'Write down three manual tasks and reframe each as an outcome. Apply the Outcome Test: describe value without mentioning technology.'
			},
			{
				id: 'define-workflow-pattern',
				title: 'The defineWorkflow() Pattern',
				description: 'Learn the structure of a WORKWAY workflow and its required components.',
				duration: '25 min',
				praxis: 'Ask Claude Code to show 3 workflow examples from packages/workflows/ and highlight common patterns. Create a minimal workflow skeleton.'
			},
			{
				id: 'integrations-oauth',
				title: 'Integrations & OAuth Providers',
				description: 'Connect external services using the BaseAPIClient pattern.',
				duration: '30 min',
				praxis: 'Ask Claude Code: "Show me how the BaseAPIClient pattern works in packages/integrations/". Map which integrations are available.'
			},
			{
				id: 'config-schemas',
				title: 'Configuration Schemas',
				description: 'Define user inputs, steps, and resource selectors for your workflows.',
				duration: '25 min',
				praxis: 'Design a configSchema for one of your outcome statements. Use sensible defaults and minimize required fields.'
			},
			{
				id: 'triggers',
				title: 'Triggers: Webhooks, Cron, Manual',
				description: 'Learn the different ways workflows can be triggered.',
				duration: '20 min',
				praxis: 'Ask Claude Code to show examples of webhook, schedule, and manual triggers. Practice writing cron expressions.'
			}
		]
	},
	{
		id: 'building-workflows',
		title: 'Building Workflows',
		description: 'Build real automations: sync Gmail to Notion, summarize meetings with AI, connect Slack with your tools. Five hours of hands-on projects you can ship.',
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
				duration: '40 min',
				praxis: 'Create a workflow that chains Zoom → Notion → Slack when a meeting ends. Test each integration call individually.'
			},
			{
				id: 'workers-ai',
				title: 'Using Workers AI for Intelligence',
				description: 'Add AI-powered summarization, classification, and generation.',
				duration: '35 min',
				praxis: 'Add Workers AI summarization to your workflow using generateText() and extractStructured() methods.'
			},
			{
				id: 'error-handling',
				title: 'Error Handling & Retry Patterns',
				description: 'Build resilient workflows that handle failures gracefully.',
				duration: '30 min',
				praxis: 'Add comprehensive error handling with granular try/catch, retry wrapper, and graceful degradation for optional steps.'
			},
			{
				id: 'local-testing',
				title: 'Testing Workflows Locally',
				description: 'Use wrangler dev and mocking for local development.',
				duration: '25 min',
				praxis: 'Set up local testing with mocks. Create a test suite and run workway dev, workway test, and curl commands.'
			}
		]
	},
	{
		id: 'systems-thinking',
		title: 'Systems Thinking',
		description: 'Design compound workflows where one meeting triggers Notion notes, Slack updates, email drafts, and CRM entries—all automatically. Production patterns.',
		icon: 'brain',
		difficulty: 'advanced',
		estimatedHours: 4,
		lessons: [
			{
				id: 'compound-workflows',
				title: 'Compound Workflows',
				description: 'Orchestrate multi-step workflows: Meeting → Notion + Slack + Email + CRM.',
				duration: '45 min',
				praxis: 'Design a compound workflow using Zoom, Notion, Slack, and email. Map sequential vs parallel steps and critical vs optional paths.',
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
				duration: '35 min',
				praxis: 'Create a private workflow with accessGrants, analytics, and audit logging. Deploy and share the install link.'
			},
			{
				id: 'agency-patterns',
				title: 'Agency Workflow Patterns',
				description: 'Create reusable workflow patterns for client deployments.',
				duration: '40 min',
				praxis: 'Create a parameterized workflow template that can be customized per client. Practice the discovery-to-deploy engagement flow.'
			},
			{
				id: 'performance-rate-limiting',
				title: 'Performance & Rate Limiting',
				description: 'Optimize workflows for production scale.',
				duration: '30 min',
				praxis: 'Add performance optimizations: caching for repeated lookups, rate-limited chunking, and performance metrics logging.'
			},
			{
				id: 'monitoring-debugging',
				title: 'Monitoring & Debugging',
				description: 'Use Cloudflare analytics and logs for production troubleshooting.',
				duration: '25 min',
				praxis: 'Add structured logging at key points with context. Configure alerts for error rate, latency, and no executions.'
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
