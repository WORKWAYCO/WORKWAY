<script lang="ts">
	import { paths } from '$lib/content/paths';
	import { Clock, CheckCircle2, BarChart3, BookOpen, AlertCircle, LogIn } from 'lucide-svelte';

	let { data } = $props();

	// Build a set of completed lesson IDs for quick lookup
	const completedLessonIds = new Set(
		data.progress?.lessons
			.filter((l) => l.status === 'completed')
			.map((l) => l.lessonId) || []
	);

	// Build a map of path progress
	const pathProgressMap = new Map(
		data.progress?.paths.map((p) => [p.pathId, p]) || []
	);
</script>

<svelte:head>
	<title>Your Progress | Learn WORKWAY</title>
	<meta name="description" content="Track your learning progress across all WORKWAY courses. See completed lessons, time spent, and streak." />

	<!-- SEO -->
	<link rel="canonical" href="https://learn.workway.co/progress" />

	<!-- Open Graph -->
	<meta property="og:title" content="Your Progress | Learn WORKWAY" />
	<meta property="og:description" content="Track your learning progress across all WORKWAY courses." />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://learn.workway.co/progress" />
	<meta property="og:site_name" content="Learn WORKWAY" />

	<!-- Twitter -->
	<meta name="twitter:card" content="summary" />
	<meta name="twitter:title" content="Your Progress | Learn WORKWAY" />
	<meta name="twitter:description" content="Track your learning progress across all WORKWAY courses." />

	<!-- Robots: Don't index user-specific pages -->
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="page-container">
	<h1 class="mb-lg">Your Progress</h1>

	{#if !data.progress}
		<!-- Not logged in or error -->
		<div class="card text-center py-xl">
			{#if data.error}
				<AlertCircle size={48} class="text-[var(--color-fg-muted)] mx-auto mb-md" />
				<h2 class="text-xl font-semibold mb-sm">Unable to Load Progress</h2>
				<p class="text-[var(--color-fg-muted)]">{data.error}</p>
			{:else}
				<LogIn size={48} class="text-[var(--color-fg-muted)] mx-auto mb-md" />
				<h2 class="text-xl font-semibold mb-sm">Sign In to Track Progress</h2>
				<p class="text-[var(--color-fg-muted)] mb-lg">
					Create an account to save your learning progress across devices.
				</p>
				<a href="/auth/signup" class="button-primary">
					Sign Up
				</a>
			{/if}
		</div>
	{:else}
		<!-- Stats overview -->
		<div class="grid grid-cols-3 gap-md mb-xl">
			<div class="card">
				<div class="flex items-center gap-sm mb-xs">
					<div class="w-8 h-8 rounded-[var(--radius-sm)] bg-[var(--color-bg-elevated)] flex items-center justify-center">
						<CheckCircle2 size={16} class="text-[var(--color-success)]" />
					</div>
					<span class="text-sm text-[var(--color-fg-muted)]">Completed</span>
				</div>
				<p class="text-2xl font-semibold">
					{data.progress.overall.lessonsCompleted}
					<span class="text-sm font-normal text-[var(--color-fg-muted)]">/ {data.progress.overall.lessonsTotal}</span>
				</p>
			</div>

			<div class="card">
				<div class="flex items-center gap-sm mb-xs">
					<div class="w-8 h-8 rounded-[var(--radius-sm)] bg-[var(--color-bg-elevated)] flex items-center justify-center">
						<BarChart3 size={16} class="text-[var(--color-fg-primary)]" />
					</div>
					<span class="text-sm text-[var(--color-fg-muted)]">Progress</span>
				</div>
				<p class="text-2xl font-semibold">{data.progress.overall.progressPercent}%</p>
			</div>

			<div class="card">
				<div class="flex items-center gap-sm mb-xs">
					<div class="w-8 h-8 rounded-[var(--radius-sm)] bg-[var(--color-bg-elevated)] flex items-center justify-center">
						<Clock size={16} class="text-[var(--color-fg-primary)]" />
					</div>
					<span class="text-sm text-[var(--color-fg-muted)]">Time Spent</span>
				</div>
				<p class="text-2xl font-semibold">
					{Math.floor(data.progress.overall.totalTimeHours)}h {Math.round((data.progress.overall.totalTimeHours % 1) * 60)}m
				</p>
			</div>
		</div>

		<!-- Recent Activity -->
		{#if data.progress.recentActivity.length > 0}
			<h2 class="text-2xl font-semibold mb-md">Recent Activity</h2>
			<div class="card mb-xl">
				<ul class="divide-y divide-[var(--color-border-default)]">
					{#each data.progress.recentActivity as activity}
						<li class="py-sm flex items-center justify-between">
							<div class="flex items-center gap-sm">
								<CheckCircle2 size={16} class="text-[var(--color-success)]" />
								<span>{activity.lessonTitle}</span>
							</div>
							<span class="text-sm text-[var(--color-fg-muted)]">
								{new Date(activity.completedAt).toLocaleDateString()}
							</span>
						</li>
					{/each}
				</ul>
			</div>
		{/if}

		<!-- Path progress -->
		<h2 class="text-2xl font-semibold mb-md">Path Progress</h2>
		<div class="space-y-md">
			{#each paths as path}
				{@const pathProgress = pathProgressMap.get(path.id)}
				{@const completedInPath = pathProgress?.lessonsCompleted || 0}
				{@const pathPercent = Math.round((completedInPath / path.lessons.length) * 100)}

				<a href="/paths/{path.id}" class="card block hover:border-[var(--color-border-strong)] transition-colors">
					<div class="flex items-center justify-between mb-md">
						<div class="flex items-center gap-sm">
							<BookOpen size={20} class="text-[var(--color-fg-primary)]" />
							<h3 class="font-medium">{path.title}</h3>
						</div>
						<span class="text-sm text-[var(--color-fg-muted)]">
							{completedInPath} / {path.lessons.length} lessons
						</span>
					</div>

					<!-- Progress bar -->
					<div class="h-2 bg-[var(--color-bg-pure)] rounded-full overflow-hidden">
						<div
							class="h-full bg-[var(--color-fg-primary)] transition-all duration-500"
							style="width: {pathPercent}%"
						></div>
					</div>

					<!-- Lesson dots -->
					<div class="flex items-center gap-xs mt-md flex-wrap">
						{#each path.lessons as lesson, index}
							{@const isComplete = completedLessonIds.has(lesson.id)}
							<span
								class="w-2 h-2 rounded-full transition-colors {isComplete
									? 'bg-[var(--color-success)]'
									: 'bg-[var(--color-bg-elevated)] hover:bg-[var(--color-fg-muted)]'}"
								title="{index + 1}. {lesson.title}"
							></span>
						{/each}
					</div>
				</a>
			{/each}
		</div>

		<!-- No progress yet message -->
		{#if data.progress.overall.lessonsCompleted === 0}
			<div class="text-center mt-xl">
				<p class="text-[var(--color-fg-muted)] mb-md">
					You haven't completed any lessons yet. Start learning!
				</p>
				<a href="/paths" class="button-primary">
					Browse Learning Paths
				</a>
			</div>
		{/if}
	{/if}
</div>
