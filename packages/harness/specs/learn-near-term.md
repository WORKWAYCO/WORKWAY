# Learn WORKWAY: Near-Term Features

Wire up remaining Learn WORKWAY functionality: auth flow and progress tracking.

## Feature: Auth Signup Route

Create `/auth/signup` route that redirects to Identity Worker signup page.

### Acceptance Criteria
- Create `apps/learn-web/src/routes/auth/signup/+page.server.ts`
- Redirect to `https://id.createsomething.space/signup`
- Pass `redirect_uri` query param for return after signup
- Add basic `+page.svelte` with loading state

## Feature: Fix Header Sign Up Button

Update header to link Sign Up button to `/auth/signup` instead of `/auth/login`.

### Acceptance Criteria
- Edit `apps/learn-web/src/routes/+layout.svelte`
- Change Sign Up button href from `/auth/login` to `/auth/signup`
- Both desktop and mobile nav buttons updated

## Feature: Wire Progress Page to API

Connect the progress page UI to the existing `/api/progress` endpoint.

### Acceptance Criteria
- Edit `apps/learn-web/src/routes/progress/+page.svelte`
- Fetch from `/api/progress` endpoint on page load
- Display real progress data (paths, lessons, percentages)
- Handle loading and error states
- Show "No progress yet" for new users

## Feature: Lesson Completion Submission

Add POST request to submit lesson completion when user finishes a lesson.

### Acceptance Criteria
- Edit lesson page at `apps/learn-web/src/routes/paths/[pathId]/[lessonId]/+page.svelte`
- Add "Mark Complete" button at bottom of lesson
- POST to `/api/progress` with `lessonId`, `pathId`, `timeSpent`
- Show success feedback after completion
- Update local state to reflect completion
