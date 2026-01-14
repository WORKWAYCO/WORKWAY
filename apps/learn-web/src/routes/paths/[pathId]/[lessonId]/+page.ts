/**
 * Lesson Page Data Loader
 *
 * Loads lesson content during SSR so excerpt is available for meta tags.
 * Zuhandenheit: Meta descriptions emerge from content, not manual entry.
 */

import { error } from "@sveltejs/kit";
import type { PageLoad } from "./$types";
import { getPath, getLesson } from "$lib/content/paths";
import { loadLessonContent, type LessonContent } from "$lib/content/lessons";

export interface PageData {
  pathId: string;
  lessonId: string;
  content: LessonContent;
  lessonsProgress: Record<string, boolean>;
  isAuthenticated: boolean;
}

export const load: PageLoad = async ({ params, data }) => {
  const { pathId, lessonId } = params;

  if (!pathId || !lessonId) {
    throw error(400, "Path and lesson ID required");
  }

  const path = getPath(pathId);
  if (!path) {
    throw error(404, "Path not found");
  }

  const lesson = getLesson(pathId, lessonId);
  if (!lesson) {
    throw error(404, "Lesson not found");
  }

  // Load content with excerpt
  const content = await loadLessonContent(pathId, lessonId);

  // Merge server data (lessonsProgress, isAuthenticated) with client data
  return {
    pathId,
    lessonId,
    content,
    lessonsProgress: data?.lessonsProgress || {},
    isAuthenticated: data?.isAuthenticated || false,
  };
};
