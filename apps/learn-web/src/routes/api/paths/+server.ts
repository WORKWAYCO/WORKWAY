/**
 * Learning Paths API
 *
 * GET /api/paths - Get all learning paths with lesson metadata
 *
 * Returns structured learning paths without full content (use /api/lessons for content).
 * Uses edge caching since this content changes rarely.
 */

import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { paths } from "$lib/content/paths";
import { createEdgeCache } from "@workwayco/sdk";

// Edge cache for paths (content changes rarely)
const pathsCache = createEdgeCache("learn-paths");

export const GET: RequestHandler = async () => {
  // Try to get from edge cache first (5 minute TTL)
  const cached = await pathsCache.get<{
    paths: typeof apiPaths;
    totalLessons: number;
    totalHours: number;
  }>("all-paths");

  if (cached) {
    return json(cached);
  }

  // Transform paths for API response (exclude any internal data)
  const apiPaths = paths.map((path) => ({
    id: path.id,
    title: path.title,
    description: path.description,
    icon: path.icon,
    difficulty: path.difficulty,
    estimatedHours: path.estimatedHours,
    lessonCount: path.lessons.length,
    lessons: path.lessons.map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      description: lesson.description,
      duration: lesson.duration,
      hasPraxis: !!lesson.praxis,
      hasTemplateWorkflow: !!lesson.templateWorkflow,
    })),
  }));

  const response = {
    paths: apiPaths,
    totalLessons: apiPaths.reduce((sum, p) => sum + p.lessonCount, 0),
    totalHours: apiPaths.reduce((sum, p) => sum + p.estimatedHours, 0),
  };

  // Cache the response at the edge (5 minutes)
  await pathsCache.set("all-paths", response, { ttlSeconds: 300 });

  return json(response);
};
