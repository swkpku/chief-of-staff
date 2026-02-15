# CLAUDE.md

## Project Structure

- `jobrunner/backend/` — Backend API (TypeScript, Express)
- `jobrunner/dashboard/` — Frontend dashboard (React, TypeScript, Vite)
- `jobrunner/jobs/` — Job definition files (`.job.md`)

## Development

- Dashboard dev server: `cd jobrunner/dashboard && npm run dev` (localhost:5173)
- Backend: `cd jobrunner/backend && npm run dev`

## Testing

Whenever a new feature is added or existing functionality is changed, e2e tests must be run. New test cases should be added to cover the changes.

- E2e tests live in `jobrunner/dashboard/e2e/`
- Run with: `cd jobrunner/dashboard && npx playwright test`
- Playwright config: `jobrunner/dashboard/playwright.config.ts`
- Tests target the dev server at localhost:5173 — make sure it's running before testing
