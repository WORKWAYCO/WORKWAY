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
	introduction?: string;
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
		introduction: 'Your terminal is the cockpit for building workflows that run themselves. In this path, you will configure WezTerm for distraction-free development, install Claude Code as your AI pair programmer, set up terminal email with Neomutt, and master the WORKWAY CLI. By the end, you will have a professional development environment where tools recede and outcomes remain.',
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
		introduction: 'Before you build, you need to understand what makes workflows invisible. This path covers the Zuhandenheit philosophy—designing tools that recede from attention—and the technical patterns that make it possible. You will learn the defineWorkflow() structure, connect services through OAuth, design configuration schemas, and set up triggers. These foundations appear in every workflow you will build.',
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
		introduction: 'Theory becomes practice. In this path, you will build real workflows from scratch—starting with a Gmail to Notion sync and progressing to multi-service integrations with Workers AI. Each lesson produces working code you can deploy. You will also learn the patterns that separate fragile automations from production-ready systems: error handling, retry logic, and local testing.',
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
				id: 'common-pitfalls',
				title: 'Common Pitfalls & Solutions',
				description: 'Avoid the most common mistakes when building WORKWAY workflows.',
				duration: '25 min',
				praxis: 'Create a workflow with an intentional pitfall (Node.js API, rate limiting, or missing validation), observe the error, then apply the fix.'
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
		introduction: 'Single automations move data from A to B. Systems thinking means designing complete outcomes that span multiple services, handle failures gracefully, and scale to production workloads. In this path, you will learn to orchestrate compound workflows that turn one event into many coordinated actions, build private workflows with enterprise-grade access controls, apply agency patterns that generate recurring revenue, and master the performance and monitoring techniques that separate hobby projects from production systems.',
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
				id: 'worker-patterns',
				title: 'Worker Patterns',
				description: 'Master the Cloudflare Workers V8 runtime: Web APIs, package compatibility, and execution limits.',
				duration: '30 min',
				praxis: 'Create a content deduplication helper using crypto.subtle for hashing. Apply batch processing patterns within the 50-subrequest limit.'
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
			},
			{
				id: 'design-philosophy',
				title: 'Design Philosophy',
				description: 'Apply Zuhandenheit and Dieter Rams principles to create workflows that recede.',
				duration: '30 min',
				praxis: 'Audit a workflow for design philosophy. Identify configuration that could become defaults. Remove one unnecessary abstraction.'
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
