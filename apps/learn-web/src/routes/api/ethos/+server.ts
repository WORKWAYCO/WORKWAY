/**
 * Ethos (Workflow Principles) API
 *
 * GET /api/ethos - Get user's workflow principles
 * PUT /api/ethos - Update user's workflow principles
 *
 * Ethos represents personal commitments to workflow building practices.
 * These principles guide how Claude Code helps with workflow development.
 */

import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

// Default ethos principles for new learners
const DEFAULT_ETHOS = {
  zuhandenheit: {
    category: "zuhandenheit",
    content: "My workflows should be invisible when working correctly",
    context: "Heidegger: The hammer recedes when used well.",
    setAt: null,
  },
  outcome_focus: {
    category: "outcome_focus",
    content: "I describe workflows by what disappears from to-do lists",
    context: "Name the outcome, not the mechanism.",
    setAt: null,
  },
  simplicity: {
    category: "simplicity",
    content: "I remove until it breaks, then add back only essentials",
    context: "Dieter Rams: Weniger, aber besser.",
    setAt: null,
  },
  resilience: {
    category: "resilience",
    content: "My workflows fail gracefully and explain themselves",
    context: "Errors should help, not confuse.",
    setAt: null,
  },
  honesty: {
    category: "honesty",
    content: "I name things for what they do, not what sounds impressive",
    context: "No marketing jargon in code.",
    setAt: null,
  },
};

export const GET: RequestHandler = async ({ locals, platform }) => {
  if (!locals.user) {
    // Return default ethos for unauthenticated users
    return json({ ethos: DEFAULT_ETHOS, isDefault: true });
  }

  const db = platform?.env?.DB;
  if (!db) {
    return json({ ethos: DEFAULT_ETHOS, isDefault: true });
  }

  try {
    // Get learner
    const learner = await db
      .prepare("SELECT * FROM learners WHERE user_id = ?")
      .bind(locals.user.id)
      .first();

    if (!learner) {
      return json({ ethos: DEFAULT_ETHOS, isDefault: true });
    }

    // Get ethos principles
    const ethos = await db
      .prepare("SELECT * FROM learner_ethos WHERE learner_id = ?")
      .bind(learner.id)
      .all();

    if (!ethos.results || ethos.results.length === 0) {
      return json({ ethos: DEFAULT_ETHOS, isDefault: true });
    }

    // Transform to ethos object
    const ethosObject: Record<string, unknown> = {};
    for (const principle of ethos.results as Array<{
      category: string;
      content: string;
      context: string;
      set_at: string;
    }>) {
      ethosObject[principle.category] = {
        category: principle.category,
        content: principle.content,
        context: principle.context,
        setAt: principle.set_at,
      };
    }

    // Merge with defaults for any missing categories
    const mergedEthos = { ...DEFAULT_ETHOS, ...ethosObject };

    return json({ ethos: mergedEthos, isDefault: false });
  } catch (err) {
    console.error("Error fetching ethos:", err);
    return json({ ethos: DEFAULT_ETHOS, isDefault: true });
  }
};

export const PUT: RequestHandler = async ({ request, locals, platform }) => {
  if (!locals.user) {
    throw error(401, "Unauthorized");
  }

  const db = platform?.env?.DB;
  if (!db) {
    throw error(500, "Database not available");
  }

  let body: {
    ethos: Record<
      string,
      { category: string; content: string; context?: string }
    >;
  };
  try {
    body = await request.json();
  } catch {
    throw error(400, "Invalid JSON body");
  }

  if (!body.ethos || typeof body.ethos !== "object") {
    throw error(400, "ethos object is required");
  }

  // Validate categories
  const validCategories = [
    "zuhandenheit",
    "outcome_focus",
    "simplicity",
    "resilience",
    "honesty",
  ];
  for (const category of Object.keys(body.ethos)) {
    if (!validCategories.includes(category)) {
      throw error(400, `Invalid category: ${category}`);
    }
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
        .bind(learnerId, locals.user.id, locals.user.email, null)
        .run();
      learner = { id: learnerId };
    }

    // Upsert each ethos principle
    for (const [category, principle] of Object.entries(body.ethos)) {
      await db
        .prepare(
          `
					INSERT INTO learner_ethos (id, learner_id, category, content, context, set_at)
					VALUES (?, ?, ?, ?, ?, datetime('now'))
					ON CONFLICT (learner_id, category) DO UPDATE SET
						content = excluded.content,
						context = excluded.context,
						set_at = datetime('now')
				`,
        )
        .bind(
          crypto.randomUUID(),
          learner.id,
          category,
          principle.content,
          principle.context ||
            DEFAULT_ETHOS[category as keyof typeof DEFAULT_ETHOS]?.context ||
            null,
        )
        .run();
    }

    // Return updated ethos
    const updatedEthos = await db
      .prepare("SELECT * FROM learner_ethos WHERE learner_id = ?")
      .bind(learner.id)
      .all();

    const ethosObject: Record<string, unknown> = {};
    for (const p of updatedEthos.results as Array<{
      category: string;
      content: string;
      context: string;
      set_at: string;
    }>) {
      ethosObject[p.category] = {
        category: p.category,
        content: p.content,
        context: p.context,
        setAt: p.set_at,
      };
    }

    // Merge with defaults
    const mergedEthos = { ...DEFAULT_ETHOS, ...ethosObject };

    return json({ ethos: mergedEthos, success: true });
  } catch (err) {
    console.error("Error updating ethos:", err);
    throw error(500, "Failed to update ethos");
  }
};
