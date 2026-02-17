/**
 * JobRunner Backend - Entry Point
 *
 * An autonomous AI agent system where job.md files define scheduled tasks
 * that get executed by Claude API (or in demo mode without an API key).
 *
 * This entry point:
 * 1. Initializes the SQLite database
 * 2. Parses job.md files from the jobs directory
 * 3. Syncs parsed jobs to the database
 * 4. Sets up Express server with CORS
 * 5. Mounts API routes
 * 6. Initializes the scheduler for all enabled jobs
 * 7. Watches the jobs directory for hot-reload
 * 8. Starts the server on port 3001
 */

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import { initDb, upsertJob } from "./db.js";
import { parseAllJobs, watchJobs, type JobDefinition } from "./parser.js";
import { initScheduler, updateJobs } from "./scheduler.js";
import apiRouter from "./api.js";
import lifeApiRouter from "./api-life.js";
import { loadConfig, isDemoMode } from "./config/loader.js";
import { runMigrations } from "./db/migrate.js";
import { seed } from "./db/seeds/seed.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PORT = parseInt(process.env.PORT || "3001", 10);
const JOBS_DIR = path.resolve(__dirname, "../../jobs");
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("=".repeat(60));
  console.log("  JobRunner Backend");
  console.log("=".repeat(60));
  console.log();

  // 0. Load config
  console.log("[startup] Loading configuration...");
  const config = loadConfig();
  console.log(`[startup] Mode: ${isDemoMode() ? "DEMO" : "LIVE"}`);

  // 1. Initialize database
  console.log("[startup] Initializing database...");
  initDb();

  // 1b. Run migrations
  console.log("[startup] Running migrations...");
  runMigrations();

  // 1c. Seed data
  console.log("[startup] Seeding data...");
  seed();
  console.log("[startup] Database ready");

  // 2. Parse job.md files
  console.log(`[startup] Loading jobs from: ${JOBS_DIR}`);
  const jobs = parseAllJobs(JOBS_DIR);
  console.log(`[startup] Found ${jobs.length} job(s)`);

  // 3. Sync jobs to database
  for (const job of jobs) {
    syncJobToDb(job);
  }
  console.log(`[startup] Synced ${jobs.length} job(s) to database`);

  // 4. Set up Express
  const app = express();

  app.use(
    cors({
      origin: CORS_ORIGIN,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  );

  app.use(express.json());

  // 5. Mount API routes
  app.use("/api", apiRouter);
  app.use("/api", lifeApiRouter);

  // Health check endpoint
  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      demo_mode: isDemoMode(),
    });
  });

  // 6. Initialize scheduler
  console.log("[startup] Initializing scheduler...");
  initScheduler(jobs);

  // 7. Watch jobs directory for hot-reload
  watchJobs(JOBS_DIR, (updatedJobs) => {
    console.log(`[hot-reload] Jobs changed, reloading ${updatedJobs.length} job(s)`);

    // Sync to database
    for (const job of updatedJobs) {
      syncJobToDb(job);
    }

    // Update scheduler
    updateJobs(updatedJobs);
  });

  // 8. Start server
  app.listen(PORT, () => {
    console.log();
    console.log(`[startup] Server running on http://localhost:${PORT}`);
    console.log(`[startup] CORS enabled for: ${CORS_ORIGIN}`);
    console.log(
      `[startup] Mode: ${process.env.ANTHROPIC_API_KEY ? "LIVE (Claude API)" : "DEMO (mock responses)"}`
    );
    console.log();

    if (jobs.length > 0) {
      console.log("[startup] Registered jobs:");
      for (const job of jobs) {
        console.log(
          `  - ${job.title} [${job.schedule}] ${job.enabled ? "(enabled)" : "(disabled)"}`
        );
      }
    } else {
      console.log(
        `[startup] No .job.md files found in ${JOBS_DIR}`
      );
      console.log(
        "[startup] The server is running with seed data. Add .job.md files to define new jobs."
      );
    }

    console.log();
    console.log("API endpoints:");
    console.log(`  GET  http://localhost:${PORT}/api/jobs`);
    console.log(`  GET  http://localhost:${PORT}/api/jobs/:id`);
    console.log(`  POST http://localhost:${PORT}/api/jobs/:id/run`);
    console.log(`  POST http://localhost:${PORT}/api/jobs/:id/toggle`);
    console.log(`  GET  http://localhost:${PORT}/api/timeline`);
    console.log(`  GET  http://localhost:${PORT}/api/executions/:id`);
    console.log(`  GET  http://localhost:${PORT}/api/approvals`);
    console.log(`  POST http://localhost:${PORT}/api/actions/:id/approve`);
    console.log(`  POST http://localhost:${PORT}/api/actions/:id/veto`);
    console.log(`  GET  http://localhost:${PORT}/health`);
    console.log();
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Sync a parsed job definition to the database.
 */
function syncJobToDb(job: JobDefinition): void {
  upsertJob({
    id: job.id,
    title: job.title,
    schedule: job.schedule,
    goal: job.goal,
    policies: JSON.stringify(job.policies),
    boundaries: JSON.stringify(job.boundaries),
    tools: JSON.stringify(job.tools),
    file_path: job.filePath,
    enabled: job.enabled ? 1 : 0,
  });
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

main().catch((err) => {
  console.error("[startup] Fatal error:", err);
  process.exit(1);
});
