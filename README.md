# Chief of Staff

A personal life management agent built on the JobRunner autonomous AI platform. Manages priorities across five life domains: **Email**, **Projects**, **Household**, **Career**, and **Kids**.

## Quick Start

```bash
# 1. Run setup (creates configs, installs deps, runs migrations)
bash scripts/setup.sh

# 2. Start the backend
cd jobrunner/backend && npm run dev

# 3. Start the dashboard (in another terminal)
cd jobrunner/dashboard && npm run dev

# 4. Open http://localhost:5173
```

The app starts in **demo mode** with sample data — no API keys required.

## Architecture

Three-layer separation for open-source safety:

| Layer | Location | Git-tracked |
|-------|----------|-------------|
| Code | `jobrunner/` | Yes |
| User Config | `config/` | No (templates only) |
| User Data | `data/` | No |

### Project Structure

```
chief-of-staff/
  config/
    config.example.yaml       # Template config (tracked)
    sender-rules.example.yaml # Email classification rules (tracked)
    config.yaml               # Your config (gitignored)
    sender-rules.yaml         # Your rules (gitignored)
  data/                        # SQLite DB + tokens (gitignored)
  scripts/
    setup.sh                   # First-run setup
  jobrunner/
    backend/src/
      api-life.ts              # Life management API routes
      config/loader.ts         # YAML config with zod validation
      connectors/              # Gmail, X bookmarks, templates, anomaly
      db/migrations/           # SQL migrations
      db/seeds/                # Template + demo data seeds
      scoring/engine.ts        # Composite scoring + domain balance
    dashboard/src/
      App.tsx                  # Main app with tab navigation
      components/
        BriefingView.tsx       # Daily priorities + domain health
        QuickCapture.tsx       # Cmd+K quick capture bar
        DomainView.tsx         # Per-domain item list
        KnowledgeLog.tsx       # Knowledge entries with filters
        WeeklyReview.tsx       # Activity review + nudges
        SettingsView.tsx       # Connections, templates, goals
    jobs/                      # Job definition .md files
```

## Life Domains

| Domain | Color | Sources |
|--------|-------|---------|
| Email | Blue | Gmail API (metadata only) |
| Projects | Purple | Manual capture, X bookmarks |
| Household | Amber | Templates (bills, maintenance) |
| Career | Green | Manual capture |
| Kids | Red | Templates (appointments, activities) |

## Configuration

Edit `config/config.yaml` to configure:

- **LLM provider**: Anthropic, OpenAI, or Ollama
- **Gmail**: OAuth client ID/secret for email triage
- **X Bookmarks**: Bearer token for bookmark ingestion
- **Scoring weights**: Customize priority scoring
- **Domains**: Add or modify life domains

Edit `config/sender-rules.yaml` to classify email senders to domains.

## Dashboard Views

- **Home**: Today's briefing with top 5 priorities and domain health bars
- **Agents**: Job list, execution timeline, approval queue (original JobRunner)
- **Knowledge**: Chronological log of facts and observations
- **Review**: Weekly activity summary with AI-generated nudges
- **Settings**: Connection status, templates, goals management

## Key Features

### Scoring Engine
Items are ranked by a weighted composite of: deadline proximity, consequence severity, effort (small tasks boosted), domain neglect, and staleness. Domain balance ensures no single domain dominates the top 5.

### Quick Capture
Press **Cmd+K** to capture tasks, facts, or observations. Deterministic parsing detects domain, urgency, due dates, and item type without requiring an LLM.

### Hyper-Focus Detection
Alerts when >80% of completed items in the last 72 hours are from a single domain, with force-boosted items from neglected domains.

### Privacy
- Gmail connector reads **metadata only** (sender, subject, date) — never email bodies
- All personal data stays in `data/` (gitignored)
- Config files with API keys stay in `config/` (gitignored)

## Development

```bash
# Backend dev server (port 3000)
cd jobrunner/backend && npm run dev

# Dashboard dev server (port 5173, proxies API to :3000)
cd jobrunner/dashboard && npm run dev

# Run migrations
cd jobrunner/backend && npm run migrate

# Seed data
cd jobrunner/backend && npm run seed

# Type check
cd jobrunner/backend && npx tsc --noEmit
cd jobrunner/dashboard && npx tsc --noEmit
```

## Testing

```bash
# Run e2e tests (requires dev servers running)
cd jobrunner/dashboard && npx playwright test

# Run specific test file
cd jobrunner/dashboard && npx playwright test e2e/life-management.spec.ts
```

## Job Definitions

Jobs are defined as `.job.md` files in `jobrunner/jobs/`:

| Job | Schedule | Purpose |
|-----|----------|---------|
| email-triage | Every 30min, 8am-10pm | Classify and prioritize emails |
| morning-briefing | Daily 7am | Generate daily priorities and briefing |
| household-check | Daily 7am | Spawn template items, detect anomalies |
| kids-check | Daily 7am | Spawn kid activity items |
| bookmark-digest | Daily 8am | Ingest X bookmarks |
| weekly-review | Sunday 6pm | Generate activity review and nudges |
