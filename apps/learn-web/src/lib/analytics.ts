import { browser } from "$app/environment";

type EventType =
  | "page_view"
  | "lesson_start"
  | "lesson_complete"
  | "praxis_submit"
  | "path_complete";

interface TrackEventOptions {
  eventType: EventType;
  eventData?: Record<string, any>;
  pagePath?: string;
}

export async function trackEvent(options: TrackEventOptions): Promise<void> {
  if (!browser) return;

  const { eventType, eventData, pagePath } = options;

  try {
    await fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType,
        eventData,
        pagePath: pagePath || window.location.pathname,
        referrer: document.referrer || null,
      }),
    });
  } catch (error) {
    // Silently fail - analytics should not break the app
    console.debug("Analytics tracking failed:", error);
  }
}

export function trackPageView(pagePath?: string): void {
  trackEvent({
    eventType: "page_view",
    pagePath,
  });
}

export function trackLessonStart(pathId: string, lessonId: string): void {
  trackEvent({
    eventType: "lesson_start",
    eventData: { pathId, lessonId },
  });
}

export function trackLessonComplete(pathId: string, lessonId: string): void {
  trackEvent({
    eventType: "lesson_complete",
    eventData: { pathId, lessonId },
  });
}

export function trackPraxisSubmit(praxisId: string, score?: number): void {
  trackEvent({
    eventType: "praxis_submit",
    eventData: { praxisId, score },
  });
}

export function trackPathComplete(pathId: string): void {
  trackEvent({
    eventType: "path_complete",
    eventData: { pathId },
  });
}
