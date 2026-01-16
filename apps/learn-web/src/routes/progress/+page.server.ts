import type { PageServerLoad } from "./$types";

interface ProgressResponse {
  overall: {
    pathsCompleted: number;
    pathsTotal: number;
    lessonsCompleted: number;
    lessonsTotal: number;
    progressPercent: number;
    totalTimeHours: number;
  };
  paths: Array<{
    pathId: string;
    status: string;
    lessonsCompleted: number;
    lessonsTotal: number;
    startedAt?: string;
    completedAt?: string;
  }>;
  lessons: Array<{
    lessonId: string;
    pathId: string;
    status: string;
    visits: number;
    timeSpentSeconds: number;
    startedAt: string;
    completedAt: string | null;
  }>;
  recentActivity: Array<{
    lessonId: string;
    lessonTitle: string;
    completedAt: string;
  }>;
}

export const load: PageServerLoad = async ({ fetch, locals }) => {
  // If not logged in, return null progress (will show prompt to sign in)
  if (!locals.user) {
    return { progress: null };
  }

  try {
    const response = await fetch("/api/progress");
    if (!response.ok) {
      console.error("Failed to fetch progress:", response.status);
      return { progress: null, error: "Failed to load progress" };
    }
    const progress: ProgressResponse = await response.json();
    return { progress };
  } catch (err) {
    console.error("Error fetching progress:", err);
    return { progress: null, error: "Failed to load progress" };
  }
};
