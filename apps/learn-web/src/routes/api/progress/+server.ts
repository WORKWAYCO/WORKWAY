import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { paths } from "$lib/content/paths";
import { createReadHelper } from "@workwayco/sdk";

// Lesson title lookup from paths
const LESSON_TITLES: Record<string, string> = {};
for (const path of paths) {
  for (const lesson of path.lessons) {
    LESSON_TITLES[lesson.id] = lesson.title;
  }
}

// Path lesson counts
const PATH_LESSON_COUNTS: Record<string, number> = {};
for (const path of paths) {
  PATH_LESSON_COUNTS[path.id] = path.lessons.length;
}

const TOTAL_PATHS = paths.length;
const TOTAL_LESSONS = paths.reduce((sum, p) => sum + p.lessons.length, 0);

export const GET: RequestHandler = async ({ locals, platform }) => {
  if (!locals.user) {
    throw error(401, "Unauthorized");
  }

  const db = platform?.env?.DB;
  if (!db) {
    throw error(500, "Database not available");
  }

  // Use eventual consistency for progress reads (dashboard/display data)
  const read = createReadHelper(db, "eventual");

  try {
    // Get learner (eventual consistency - display data)
    const learner = await read.first<{ id: string }>(
      "SELECT * FROM learners WHERE user_id = ?",
      [locals.user.id]
    );

    if (!learner) {
      // Return empty progress for new learners
      return json({
        overall: {
          pathsCompleted: 0,
          pathsTotal: TOTAL_PATHS,
          lessonsCompleted: 0,
          lessonsTotal: TOTAL_LESSONS,
          progressPercent: 0,
          totalTimeHours: 0,
        },
        paths: paths.map((p) => ({
          pathId: p.id,
          status: "not_started",
          lessonsCompleted: 0,
          lessonsTotal: p.lessons.length,
        })),
        lessons: [],
        recentActivity: [],
      });
    }

    // Get path progress (eventual consistency)
    const pathProgressResults = await read.query<{
      path_id: string;
      status: string;
      started_at: string | null;
      completed_at: string | null;
    }>("SELECT * FROM path_progress WHERE learner_id = ?", [learner.id]);

    // Get lesson progress (eventual consistency)
    const lessonResults = await read.query<{
      lesson_id: string;
      path_id: string;
      status: string;
      time_spent_seconds: number;
      completed_at: string | null;
      started_at: string | null;
      visits: number;
    }>("SELECT * FROM lesson_progress WHERE learner_id = ?", [learner.id]);

    // Calculate stats
    const completedLessons = lessonResults.filter(
      (l) => l.status === "completed",
    );
    const totalTimeSeconds = lessonResults.reduce(
      (sum, l) => sum + (l.time_spent_seconds || 0),
      0,
    );

    // Build path progress with lesson counts
    const pathProgressMap = new Map<
      string,
      { status: string; startedAt: string | null; completedAt: string | null }
    >();
    for (const p of pathProgressResults) {
      pathProgressMap.set(p.path_id, {
        status: p.status,
        startedAt: p.started_at,
        completedAt: p.completed_at,
      });
    }

    // Count completed lessons per path
    const completedPerPath = new Map<string, number>();
    for (const lesson of completedLessons) {
      const count = completedPerPath.get(lesson.path_id) || 0;
      completedPerPath.set(lesson.path_id, count + 1);
    }

    // Build paths array
    const pathsProgress = paths.map((p) => {
      const progress = pathProgressMap.get(p.id);
      const lessonsCompleted = completedPerPath.get(p.id) || 0;
      const lessonsTotal = p.lessons.length;

      // Determine status
      let status = progress?.status || "not_started";
      if (lessonsCompleted === lessonsTotal && lessonsTotal > 0) {
        status = "completed";
      } else if (lessonsCompleted > 0) {
        status = "in_progress";
      }

      return {
        pathId: p.id,
        status,
        lessonsCompleted,
        lessonsTotal,
        startedAt: progress?.startedAt,
        completedAt: progress?.completedAt,
      };
    });

    // Calculate completed paths
    const completedPaths = pathsProgress.filter(
      (p) => p.status === "completed",
    ).length;

    // Build lessons array
    const lessons = lessonResults.map((l) => ({
      lessonId: l.lesson_id,
      pathId: l.path_id,
      status: l.status,
      visits: l.visits,
      timeSpentSeconds: l.time_spent_seconds,
      startedAt: l.started_at,
      completedAt: l.completed_at,
    }));

    // Recent activity (last 5 completed lessons)
    const recentActivity = completedLessons
      .filter((l) => l.completed_at)
      .sort(
        (a, b) =>
          new Date(b.completed_at!).getTime() -
          new Date(a.completed_at!).getTime(),
      )
      .slice(0, 5)
      .map((l) => ({
        lessonId: l.lesson_id,
        lessonTitle: LESSON_TITLES[l.lesson_id] || l.lesson_id,
        completedAt: l.completed_at!,
      }));

    return json({
      overall: {
        pathsCompleted: completedPaths,
        pathsTotal: TOTAL_PATHS,
        lessonsCompleted: completedLessons.length,
        lessonsTotal: TOTAL_LESSONS,
        progressPercent: Math.round(
          (completedLessons.length / TOTAL_LESSONS) * 100,
        ),
        totalTimeHours: Math.round((totalTimeSeconds / 3600) * 10) / 10,
      },
      paths: pathsProgress,
      lessons,
      recentActivity,
    });
  } catch (err) {
    console.error("Error fetching progress:", err);
    throw error(500, "Failed to fetch progress");
  }
};

export const POST: RequestHandler = async ({ request, locals, platform }) => {
  if (!locals.user) {
    throw error(401, "Unauthorized");
  }

  const db = platform?.env?.DB;
  if (!db) {
    throw error(500, "Database not available");
  }

  const body = (await request.json()) as {
    pathId?: string;
    lessonId?: string;
    status?: string;
    timeSpentSeconds?: number;
  };
  const { pathId, lessonId, status, timeSpentSeconds } = body;

  if (!pathId || !lessonId) {
    throw error(400, "pathId and lessonId are required");
  }

  try {
    // Get or create learner
    let learner = await db
      .prepare("SELECT * FROM learners WHERE user_id = ?")
      .bind(locals.user.id)
      .first();

    if (!learner) {
      const learnerId = crypto.randomUUID();
      await db
        .prepare(
          "INSERT INTO learners (id, user_id, email, display_name) VALUES (?, ?, ?, ?)",
        )
        .bind(
          learnerId,
          locals.user.id,
          locals.user.email,
          locals.user.displayName || null,
        )
        .run();
      learner = { id: learnerId };
    }

    // Update or insert lesson progress
    const existingProgress = await db
      .prepare(
        "SELECT * FROM lesson_progress WHERE learner_id = ? AND path_id = ? AND lesson_id = ?",
      )
      .bind(learner.id, pathId, lessonId)
      .first();

    if (existingProgress) {
      await db
        .prepare(
          `
					UPDATE lesson_progress
					SET status = ?,
						visits = visits + 1,
						time_spent_seconds = time_spent_seconds + ?,
						completed_at = CASE WHEN ? = 'completed' THEN datetime('now') ELSE completed_at END
					WHERE id = ?
				`,
        )
        .bind(
          status || existingProgress.status,
          timeSpentSeconds || 0,
          status,
          existingProgress.id,
        )
        .run();
    } else {
      await db
        .prepare(
          `
					INSERT INTO lesson_progress (id, learner_id, path_id, lesson_id, status, visits, time_spent_seconds, started_at, completed_at)
					VALUES (?, ?, ?, ?, ?, 1, ?, datetime('now'), CASE WHEN ? = 'completed' THEN datetime('now') ELSE NULL END)
				`,
        )
        .bind(
          crypto.randomUUID(),
          learner.id,
          pathId,
          lessonId,
          status || "in_progress",
          timeSpentSeconds || 0,
          status,
        )
        .run();
    }

    // Update path progress if needed
    if (status === "completed") {
      // Check if path progress exists
      const existingPathProgress = await db
        .prepare(
          "SELECT * FROM path_progress WHERE learner_id = ? AND path_id = ?",
        )
        .bind(learner.id, pathId)
        .first();

      if (!existingPathProgress) {
        await db
          .prepare(
            `
						INSERT INTO path_progress (id, learner_id, path_id, status, started_at)
						VALUES (?, ?, ?, 'in_progress', datetime('now'))
					`,
          )
          .bind(crypto.randomUUID(), learner.id, pathId)
          .run();
      }
    }

    return json({ success: true });
  } catch (err) {
    console.error("Error updating progress:", err);
    throw error(500, "Failed to update progress");
  }
};
