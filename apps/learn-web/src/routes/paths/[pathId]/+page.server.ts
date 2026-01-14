import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ fetch, locals, params }) => {
  // If not logged in, return empty progress
  if (!locals.user) {
    return {
      isAuthenticated: false,
      completedLessons: [] as string[],
    };
  }

  try {
    const response = await fetch("/api/progress");
    if (!response.ok) {
      console.error("Failed to fetch progress:", response.status);
      return {
        isAuthenticated: true,
        completedLessons: [] as string[],
      };
    }

    const progress = await response.json();

    // Extract completed lesson IDs for this path
    const completedLessons =
      progress.lessons
        ?.filter(
          (l: { pathId: string; status: string }) =>
            l.pathId === params.pathId && l.status === "completed",
        )
        .map((l: { lessonId: string }) => l.lessonId) || [];

    return {
      isAuthenticated: true,
      completedLessons,
    };
  } catch (err) {
    console.error("Error fetching progress:", err);
    return {
      isAuthenticated: true,
      completedLessons: [] as string[],
    };
  }
};
