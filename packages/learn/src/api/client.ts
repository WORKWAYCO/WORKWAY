/**
 * Learn API Client
 *
 * Client for interacting with learn.workway.co
 */

import type {
	LearnerProgress,
	LessonWithContent,
	Path,
	PraxisResult,
	PraxisSubmission,
	WeeklyDigest,
	APIError
} from '../types/index.js';
import type { WorkflowEthos } from '../ethos/schema.js';
import { getAuthHeader, isAuthenticated } from './auth.js';

const LMS_BASE_URL = 'https://learn.workway.co';

export class LearnAPIError extends Error {
	constructor(
		public status: number,
		message: string,
		public code?: string
	) {
		super(message);
		this.name = 'LearnAPIError';
	}
}

export class LearnAPIClient {
	private baseUrl: string;

	constructor(options: { baseUrl?: string } = {}) {
		this.baseUrl = options.baseUrl || LMS_BASE_URL;
	}

	/**
	 * Make an authenticated request to the API
	 */
	private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
		const authHeader = await getAuthHeader();

		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			...(options.headers as Record<string, string>)
		};

		if (authHeader) {
			headers.Authorization = authHeader.Authorization;
		}

		const response = await fetch(`${this.baseUrl}${path}`, {
			...options,
			headers
		});

		if (!response.ok) {
			let errorMessage = 'Request failed';
			let errorCode: string | undefined;

			try {
				const errorData = (await response.json()) as APIError;
				errorMessage = errorData.message || errorMessage;
				errorCode = errorData.code;
			} catch {
				// Use default error message
			}

			throw new LearnAPIError(response.status, errorMessage, errorCode);
		}

		return response.json() as Promise<T>;
	}

	/**
	 * Check if user is authenticated
	 */
	isAuthenticated(): boolean {
		return isAuthenticated();
	}

	// =========================================================================
	// Paths & Lessons
	// =========================================================================

	/**
	 * Get all learning paths
	 */
	async getPaths(): Promise<{ paths: Path[]; totalLessons: number; totalHours: number }> {
		return this.request<{ paths: Path[]; totalLessons: number; totalHours: number }>('/api/paths');
	}

	/**
	 * Get a specific path
	 */
	async getPath(pathId: string): Promise<Path> {
		return this.request<Path>(`/api/paths/${pathId}`);
	}

	/**
	 * Get lesson content
	 */
	async getLesson(pathId: string, lessonId: string): Promise<LessonWithContent> {
		return this.request<LessonWithContent>(`/api/lessons/${pathId}/${lessonId}`);
	}

	// =========================================================================
	// Progress
	// =========================================================================

	/**
	 * Get learner progress
	 */
	async getProgress(): Promise<LearnerProgress> {
		return this.request<LearnerProgress>('/api/progress');
	}

	/**
	 * Mark a lesson as complete
	 */
	async completeLesson(data: {
		pathId: string;
		lessonId: string;
		reflection?: string;
		timeSpentSeconds?: number;
	}): Promise<{
		success: boolean;
		pathProgress?: { completed: number; total: number };
		nextLesson?: { id: string; title: string };
	}> {
		return this.request('/api/progress', {
			method: 'POST',
			body: JSON.stringify({
				pathId: data.pathId,
				lessonId: data.lessonId,
				status: 'completed',
				timeSpentSeconds: data.timeSpentSeconds
			})
		});
	}

	/**
	 * Start a lesson (track visit)
	 */
	async startLesson(pathId: string, lessonId: string): Promise<void> {
		await this.request('/api/progress/start', {
			method: 'POST',
			body: JSON.stringify({ pathId, lessonId })
		});
	}

	// =========================================================================
	// Praxis
	// =========================================================================

	/**
	 * Submit a praxis exercise
	 */
	async submitPraxis(praxisId: string, submission: PraxisSubmission): Promise<PraxisResult> {
		return this.request<PraxisResult>(`/api/praxis/${praxisId}`, {
			method: 'POST',
			body: JSON.stringify(submission)
		});
	}

	// =========================================================================
	// Ethos
	// =========================================================================

	/**
	 * Get ethos from cloud
	 */
	async getEthos(): Promise<{ ethos: WorkflowEthos; isDefault: boolean }> {
		return this.request<{ ethos: WorkflowEthos; isDefault: boolean }>('/api/ethos');
	}

	/**
	 * Sync ethos to cloud
	 */
	async saveEthos(ethos: WorkflowEthos): Promise<{ ethos: WorkflowEthos; success: boolean }> {
		return this.request<{ ethos: WorkflowEthos; success: boolean }>('/api/ethos', {
			method: 'PUT',
			body: JSON.stringify({ ethos })
		});
	}

	// =========================================================================
	// Digest
	// =========================================================================

	/**
	 * Get weekly digest
	 */
	async getDigest(period: 'week' | 'month' = 'week'): Promise<WeeklyDigest> {
		return this.request<WeeklyDigest>(`/api/digest?period=${period}`);
	}
}

// Singleton instance
let clientInstance: LearnAPIClient | null = null;

export function getClient(): LearnAPIClient {
	if (!clientInstance) {
		clientInstance = new LearnAPIClient();
	}
	return clientInstance;
}
