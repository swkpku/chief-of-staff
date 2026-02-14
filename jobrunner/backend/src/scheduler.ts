/**
 * Job scheduler - uses node-cron to schedule and manage job executions.
 */

import cron from "node-cron";
import type { JobDefinition } from "./parser.js";
import { executeJob } from "./executor.js";
import { getDb } from "./db.js";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/** Map of job ID to active cron task */
const scheduledTasks: Map<string, cron.ScheduledTask> = new Map();

/** Map of job ID to its definition (for triggering) */
const jobDefinitions: Map<string, JobDefinition> = new Map();

/** Set of currently executing job IDs (prevent concurrent runs) */
const runningJobs: Set<string> = new Set();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialize the scheduler with a list of jobs.
 * Schedules all enabled jobs and computes next run times.
 */
export function initScheduler(jobs: JobDefinition[]): void {
  console.log(`[scheduler] Initializing with ${jobs.length} job(s)`);

  // Clear any existing schedules
  for (const [id, task] of scheduledTasks) {
    task.stop();
    scheduledTasks.delete(id);
  }
  jobDefinitions.clear();

  // Schedule each enabled job
  for (const job of jobs) {
    jobDefinitions.set(job.id, job);
    if (job.enabled) {
      scheduleJob(job);
    }
  }
}

/**
 * Schedule a single job's cron task.
 */
export function scheduleJob(job: JobDefinition): void {
  // Validate cron expression
  if (!cron.validate(job.schedule)) {
    console.error(`[scheduler] Invalid cron expression for job "${job.title}": ${job.schedule}`);
    return;
  }

  // Remove existing schedule if any
  unscheduleJob(job.id);

  // Store definition
  jobDefinitions.set(job.id, job);

  // Create cron task
  const task = cron.schedule(job.schedule, async () => {
    await runJob(job.id);
  });

  scheduledTasks.set(job.id, task);

  // Compute and store next run time
  updateNextRun(job.id, job.schedule);

  console.log(`[scheduler] Scheduled "${job.title}" with cron: ${job.schedule}`);
}

/**
 * Remove a job's cron task.
 */
export function unscheduleJob(jobId: string): void {
  const existing = scheduledTasks.get(jobId);
  if (existing) {
    existing.stop();
    scheduledTasks.delete(jobId);
    console.log(`[scheduler] Unscheduled job: ${jobId}`);
  }
}

/**
 * Manually trigger a job execution immediately.
 * Returns the execution result.
 */
export async function triggerJob(
  jobId: string
): Promise<{ success: boolean; executionId?: string; error?: string }> {
  const job = jobDefinitions.get(jobId);
  if (!job) {
    return { success: false, error: `Job not found: ${jobId}` };
  }

  return runJob(jobId);
}

/**
 * Update job definitions (e.g., after file changes).
 * Re-schedules jobs as needed.
 */
export function updateJobs(jobs: JobDefinition[]): void {
  console.log(`[scheduler] Updating ${jobs.length} job(s)`);

  // Track which jobs still exist
  const currentIds = new Set(jobs.map((j) => j.id));

  // Remove jobs that no longer exist
  for (const [id] of scheduledTasks) {
    if (!currentIds.has(id)) {
      unscheduleJob(id);
      jobDefinitions.delete(id);
    }
  }

  // Add or update jobs
  for (const job of jobs) {
    const existing = jobDefinitions.get(job.id);
    jobDefinitions.set(job.id, job);

    if (job.enabled) {
      // Re-schedule if new or if schedule changed
      if (!existing || existing.schedule !== job.schedule) {
        scheduleJob(job);
      }
    } else {
      // Disable: unschedule
      unscheduleJob(job.id);
    }
  }
}

/**
 * Get the list of all scheduled job IDs.
 */
export function getScheduledJobIds(): string[] {
  return Array.from(scheduledTasks.keys());
}

/**
 * Check if a job is currently running.
 */
export function isJobRunning(jobId: string): boolean {
  return runningJobs.has(jobId);
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

/**
 * Run a job, handling concurrency and error cases.
 */
async function runJob(
  jobId: string
): Promise<{ success: boolean; executionId?: string; error?: string }> {
  // Prevent concurrent runs of the same job
  if (runningJobs.has(jobId)) {
    console.warn(`[scheduler] Job "${jobId}" is already running, skipping`);
    return { success: false, error: "Job is already running" };
  }

  const job = jobDefinitions.get(jobId);
  if (!job) {
    return { success: false, error: `Job definition not found: ${jobId}` };
  }

  runningJobs.add(jobId);
  console.log(`[scheduler] Running job: ${job.title}`);

  try {
    const result = await executeJob(job);

    console.log(
      `[scheduler] Job "${job.title}" finished: ${result.status} (${result.actionsCount} actions, ${result.pendingApprovals} pending)`
    );

    // Update next run time
    updateNextRun(jobId, job.schedule);

    return { success: true, executionId: result.executionId };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[scheduler] Job "${job.title}" failed:`, errorMessage);
    return { success: false, error: errorMessage };
  } finally {
    runningJobs.delete(jobId);
  }
}

/**
 * Compute and store the next run time for a job based on its cron schedule.
 *
 * This is a simplified computation that estimates the next run based on
 * parsing the cron expression. For complex expressions, it provides a
 * reasonable approximation.
 */
function updateNextRun(jobId: string, schedule: string): void {
  try {
    const nextRun = computeNextRun(schedule);
    if (nextRun) {
      getDb()
        .prepare("UPDATE jobs SET next_run = ? WHERE id = ?")
        .run(nextRun.toISOString(), jobId);
    }
  } catch {
    // Non-critical, just log
    console.warn(`[scheduler] Could not compute next run for job ${jobId}`);
  }
}

/**
 * Compute the next run time from a cron expression.
 *
 * Handles common patterns:
 * - "* /N * * *" (every N hours)
 * - "M H * * *" (daily at H:M)
 * - "M H * * D" (specific days at H:M)
 */
function computeNextRun(schedule: string): Date | null {
  const parts = schedule.trim().split(/\s+/);
  if (parts.length < 5) return null;

  const now = new Date();
  const [minute, hour, _dayOfMonth, _month, dayOfWeek] = parts;

  // Simple case: every N minutes or hours
  if (hour.startsWith("*/")) {
    const interval = parseInt(hour.substring(2), 10);
    if (!isNaN(interval)) {
      const next = new Date(now);
      next.setMinutes(parseInt(minute, 10) || 0, 0, 0);
      // Find next occurrence
      while (next <= now) {
        next.setHours(next.getHours() + interval);
      }
      return next;
    }
  }

  if (minute.startsWith("*/")) {
    const interval = parseInt(minute.substring(2), 10);
    if (!isNaN(interval)) {
      const next = new Date(now);
      next.setSeconds(0, 0);
      const currentMinute = now.getMinutes();
      const nextMinute = Math.ceil(currentMinute / interval) * interval;
      next.setMinutes(nextMinute);
      if (next <= now) {
        next.setMinutes(next.getMinutes() + interval);
      }
      return next;
    }
  }

  // Fixed time: "M H * * *" or "M H * * 1-5"
  const h = parseInt(hour, 10);
  const m = parseInt(minute, 10);
  if (!isNaN(h) && !isNaN(m)) {
    const next = new Date(now);
    next.setHours(h, m, 0, 0);

    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }

    // If day-of-week is specified, advance to the next matching day
    if (dayOfWeek !== "*") {
      const allowedDays = parseDayOfWeek(dayOfWeek);
      if (allowedDays.length > 0) {
        let attempts = 0;
        while (!allowedDays.includes(next.getDay()) && attempts < 7) {
          next.setDate(next.getDate() + 1);
          attempts++;
        }
      }
    }

    return next;
  }

  // Fallback: next hour
  const fallback = new Date(now);
  fallback.setHours(fallback.getHours() + 1, 0, 0, 0);
  return fallback;
}

/**
 * Parse a day-of-week cron field into an array of day numbers (0=Sun, 6=Sat).
 */
function parseDayOfWeek(field: string): number[] {
  const days: number[] = [];

  for (const part of field.split(",")) {
    if (part.includes("-")) {
      const [start, end] = part.split("-").map((s) => parseInt(s, 10));
      if (!isNaN(start) && !isNaN(end)) {
        for (let d = start; d <= end; d++) {
          days.push(d);
        }
      }
    } else {
      const d = parseInt(part, 10);
      if (!isNaN(d)) {
        days.push(d);
      }
    }
  }

  return days;
}
