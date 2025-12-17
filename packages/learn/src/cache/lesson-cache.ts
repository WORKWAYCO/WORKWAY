/**
 * Lesson Cache
 *
 * Caches lesson content for offline access and faster loading.
 * Cache TTL: 24 hours
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { CachedLesson, LessonWithContent } from '../types/index.js';

const CONFIG_DIR = join(homedir(), '.workway');
const CACHE_DIR = join(CONFIG_DIR, 'learn-cache', 'lessons');
const CACHE_TTL_HOURS = 24;

/**
 * Ensure cache directory exists
 */
function ensureCacheDir(pathId: string): void {
	const dir = join(CACHE_DIR, pathId);
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}
}

/**
 * Get cache file path
 */
function getCachePath(pathId: string, lessonId: string): string {
	return join(CACHE_DIR, pathId, `${lessonId}.json`);
}

/**
 * Check if cache entry is expired
 */
function isExpired(cachedAt: string): boolean {
	const age = Date.now() - new Date(cachedAt).getTime();
	return age > CACHE_TTL_HOURS * 60 * 60 * 1000;
}

/**
 * Get cached lesson
 */
export function getCachedLesson(pathId: string, lessonId: string): CachedLesson | null {
	const cachePath = getCachePath(pathId, lessonId);

	if (!existsSync(cachePath)) {
		return null;
	}

	try {
		const content = readFileSync(cachePath, 'utf-8');
		const cached = JSON.parse(content) as CachedLesson;

		if (isExpired(cached.cachedAt)) {
			// Cache expired, remove it
			unlinkSync(cachePath);
			return null;
		}

		return cached;
	} catch {
		return null;
	}
}

/**
 * Cache a lesson
 */
export function cacheLesson(lesson: LessonWithContent): CachedLesson {
	ensureCacheDir(lesson.pathId);

	const cached: CachedLesson = {
		...lesson,
		cachedAt: new Date().toISOString()
	};

	const cachePath = getCachePath(lesson.pathId, lesson.id);
	writeFileSync(cachePath, JSON.stringify(cached, null, 2), 'utf-8');

	return cached;
}

/**
 * Get all cached lessons
 */
export function getAllCachedLessons(): CachedLesson[] {
	if (!existsSync(CACHE_DIR)) {
		return [];
	}

	const lessons: CachedLesson[] = [];

	try {
		const pathDirs = readdirSync(CACHE_DIR, { withFileTypes: true });

		for (const pathDir of pathDirs) {
			if (!pathDir.isDirectory()) continue;

			const lessonFiles = readdirSync(join(CACHE_DIR, pathDir.name));

			for (const file of lessonFiles) {
				if (!file.endsWith('.json')) continue;

				const content = readFileSync(join(CACHE_DIR, pathDir.name, file), 'utf-8');
				const cached = JSON.parse(content) as CachedLesson;

				if (!isExpired(cached.cachedAt)) {
					lessons.push(cached);
				}
			}
		}
	} catch {
		// Ignore errors
	}

	return lessons;
}

/**
 * Clear all cached lessons
 */
export function clearLessonCache(): void {
	if (!existsSync(CACHE_DIR)) return;

	try {
		const pathDirs = readdirSync(CACHE_DIR, { withFileTypes: true });

		for (const pathDir of pathDirs) {
			if (!pathDir.isDirectory()) continue;

			const lessonFiles = readdirSync(join(CACHE_DIR, pathDir.name));

			for (const file of lessonFiles) {
				unlinkSync(join(CACHE_DIR, pathDir.name, file));
			}
		}
	} catch {
		// Ignore errors
	}
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { count: number; oldestAt: string | null; size: number } {
	const lessons = getAllCachedLessons();

	if (lessons.length === 0) {
		return { count: 0, oldestAt: null, size: 0 };
	}

	const oldest = lessons.reduce((min, l) => (l.cachedAt < min ? l.cachedAt : min), lessons[0].cachedAt);

	// Rough size estimate
	const size = lessons.reduce((sum, l) => sum + (l.content?.length || 0), 0);

	return { count: lessons.length, oldestAt: oldest, size };
}
