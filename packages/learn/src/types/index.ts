/**
 * WORKWAY Learn Types
 *
 * Core type definitions for the learning package.
 */

// ============================================================================
// Learning Progress Types
// ============================================================================

export type LessonStatus = 'not_started' | 'in_progress' | 'completed';
export type PathStatus = 'not_started' | 'in_progress' | 'completed';

export interface Lesson {
	id: string;
	title: string;
	description: string;
	duration: string;
	pathId: string;
	pathTitle: string;
	content?: string;
	praxis?: {
		prompt: string;
		templateWorkflow?: {
			id: string;
			name: string;
		};
	};
}

export interface LessonHeading {
	level: number;
	text: string;
	id: string;
}

export interface LessonWithContent extends Lesson {
	content: string;
	headings: LessonHeading[];
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

export interface LessonProgress {
	lessonId: string;
	pathId: string;
	status: LessonStatus;
	visits: number;
	timeSpentSeconds: number;
	startedAt?: string;
	completedAt?: string;
	reflection?: string;
}

export interface PathProgress {
	pathId: string;
	status: PathStatus;
	lessonsCompleted: number;
	lessonsTotal: number;
	startedAt?: string;
	completedAt?: string;
}

export interface LearnerProgress {
	overall: {
		pathsCompleted: number;
		pathsTotal: number;
		lessonsCompleted: number;
		lessonsTotal: number;
		progressPercent: number;
		totalTimeHours: number;
		praxisCompleted: number;
	};
	paths: PathProgress[];
	lessons: LessonProgress[];
	recentActivity: Array<{
		lessonId: string;
		lessonTitle: string;
		completedAt: string;
	}>;
}

// ============================================================================
// Authentication Types
// ============================================================================

export interface User {
	id: string;
	email: string;
	tier: 'free' | 'pro' | 'enterprise';
}

export interface Credentials {
	accessToken: string;
	refreshToken: string;
	expiresAt: string;
	user: User;
}

export interface AuthResult {
	authenticated: boolean;
	user?: User;
	message: string;
	nextSteps?: string[];
}

// ============================================================================
// Praxis Types
// ============================================================================

export interface PraxisSubmission {
	evidence: string;
	reflection?: string;
	timeSpentMinutes?: number;
}

export interface PraxisResult {
	success: boolean;
	feedback: string;
	nextSteps?: string[];
	badges?: string[];
	lessonId?: string;
	pathId?: string;
	submittedAt?: string;
}

// ============================================================================
// Analysis Types
// ============================================================================

export interface WorkflowAnalysis {
	overall: {
		score: number;
		grade: 'A' | 'B' | 'C' | 'D' | 'F';
		summary: string;
	};
	patterns: {
		defineWorkflow: { present: boolean; valid: boolean; notes: string };
		integrations: {
			listed: string[];
			properlyTyped: boolean;
			baseAPIClientPattern: boolean;
			notes: string;
		};
		configSchema: { present: boolean; valid: boolean; sensibleDefaults: boolean; notes: string };
		errorHandling: {
			hasOnError: boolean;
			gracefulDegradation: boolean;
			notes: string;
		};
		triggers: { type: string; valid: boolean; notes: string };
	};
	zuhandenheit: {
		score: number;
		toolRecession: string;
		outcomeFocus: string;
		recommendations: string[];
	};
	suggestions: Array<{
		priority: 'high' | 'medium' | 'low';
		category: string;
		suggestion: string;
		codeExample?: string;
	}>;
	relatedLessons: Array<{
		pathId: string;
		lessonId: string;
		title: string;
		relevance: string;
	}>;
}

// ============================================================================
// Recommendation Types
// ============================================================================

export interface Recommendation {
	pathId: string;
	lessonId: string;
	title: string;
	rationale: string;
	estimatedTime: string;
	priority: 'immediate' | 'soon' | 'when_ready';
}

export interface SkillGap {
	skill: string;
	currentLevel: 'beginner' | 'intermediate' | 'advanced';
	targetLevel: 'intermediate' | 'advanced' | 'expert';
	lessons: string[];
}

// ============================================================================
// Digest Types
// ============================================================================

export interface WeeklyDigest {
	period: { start: string; end: string };
	summary: {
		lessonsCompleted: number;
		praxisSubmitted: number;
		totalTimeHours: number;
		streakDays: number;
	};
	achievements: Array<{
		type: 'path_completed' | 'praxis_passed' | 'streak' | 'milestone';
		title: string;
		earnedAt: string;
	}>;
	highlights: Array<{
		type: 'lesson' | 'praxis' | 'insight';
		title: string;
		summary: string;
	}>;
	weeklyGoals: {
		suggested: string[];
		carryOver: string[];
	};
	ethosReflection?: {
		principleInFocus: string;
		applicationNotes: string;
	};
}

// ============================================================================
// Cache Types
// ============================================================================

export interface CachedLesson extends LessonWithContent {
	cachedAt: string;
}

export interface PendingCompletion {
	pathId: string;
	lessonId: string;
	reflection?: string;
	timeSpentSeconds?: number;
	queuedAt: string;
}

// ============================================================================
// API Types
// ============================================================================

export interface APIError {
	status: number;
	message: string;
	code?: string;
}
