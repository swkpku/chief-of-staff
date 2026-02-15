/**
 * Express REST API router for the JobRunner backend.
 */

import { Router, type Request, type Response } from "express";
import {
  getAllJobs,
  getJob,
  toggleJob,
  getExecution,
  getExecutionsByJob,
  getActionsByExecution,
  getTimeline,
} from "./db.js";
import {
  getPendingApprovals,
  approveAction,
  vetoAction,
} from "./approvals.js";
import { triggerJob, isJobRunning } from "./scheduler.js";

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const router = Router();

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

/**
 * GET /api/jobs
 * List all jobs with their current status.
 */
router.get("/jobs", (_req: Request, res: Response) => {
  try {
    const jobs = getAllJobs();
    const enriched = jobs.map((job) => ({
      ...job,
      enabled: !!job.enabled,
      policies: safeParseJSON(job.policies),
      boundaries: safeParseJSON(job.boundaries),
      tools: safeParseJSON(job.tools),
      is_running: isJobRunning(job.id),
    }));
    res.json({ jobs: enriched });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/jobs/:id
 * Get job detail with recent executions.
 */
router.get("/jobs/:id", (req: Request, res: Response) => {
  try {
    const job = getJob(param(req, "id"));
    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }

    const executions = getExecutionsByJob(job.id);
    res.json({
      job: {
        ...job,
        enabled: !!job.enabled,
        policies: safeParseJSON(job.policies),
        boundaries: safeParseJSON(job.boundaries),
        tools: safeParseJSON(job.tools),
        is_running: isJobRunning(job.id),
      },
      executions,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/jobs/:id/run
 * Manually trigger a job execution.
 */
router.post("/jobs/:id/run", async (req: Request, res: Response) => {
  try {
    const job = getJob(param(req, "id"));
    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }

    const result = await triggerJob(param(req, "id"));
    if (result.success) {
      res.json({
        message: `Job "${job.title}" triggered successfully`,
        execution_id: result.executionId,
      });
    } else {
      res.status(409).json({ error: result.error });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/jobs/:id/toggle
 * Enable or disable a job.
 */
router.post("/jobs/:id/toggle", (req: Request, res: Response) => {
  try {
    const updated = toggleJob(param(req, "id"));
    if (!updated) {
      res.status(404).json({ error: "Job not found" });
      return;
    }

    res.json({
      job: {
        ...updated,
        enabled: !!updated.enabled,
        policies: safeParseJSON(updated.policies),
        boundaries: safeParseJSON(updated.boundaries),
        tools: safeParseJSON(updated.tools),
      },
      message: updated.enabled ? "Job enabled" : "Job disabled",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

/**
 * GET /api/timeline
 * Recent activity across all jobs (paginated).
 * Query params: ?limit=20&offset=0
 */
router.get("/timeline", (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 100);
    const offset = Math.max(parseInt(req.query.offset as string, 10) || 0, 0);

    const entries = getTimeline(limit, offset);

    // Enrich with actions for each execution
    const enriched = entries.map((entry) => {
      const actions = getActionsByExecution(entry.id);
      return {
        ...entry,
        actions,
        actions_count: actions.length,
        pending_count: actions.filter((a) => a.status === "pending-approval").length,
      };
    });

    res.json({
      timeline: enriched,
      limit,
      offset,
      has_more: entries.length === limit,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// ---------------------------------------------------------------------------
// Executions
// ---------------------------------------------------------------------------

/**
 * GET /api/executions/:id
 * Get execution detail with all actions.
 */
router.get("/executions/:id", (req: Request, res: Response) => {
  try {
    const execution = getExecution(param(req, "id"));
    if (!execution) {
      res.status(404).json({ error: "Execution not found" });
      return;
    }

    const actions = getActionsByExecution(execution.id);

    // Get the parent job info
    const job = getJob(execution.job_id);

    res.json({
      execution,
      actions,
      job: job
        ? {
            id: job.id,
            title: job.title,
            schedule: job.schedule,
          }
        : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// ---------------------------------------------------------------------------
// Approvals
// ---------------------------------------------------------------------------

/**
 * GET /api/approvals
 * Get all pending approval actions.
 */
router.get("/approvals", (_req: Request, res: Response) => {
  try {
    const approvals = getPendingApprovals();
    res.json({ approvals });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/actions/:id/approve
 * Approve a pending action.
 */
router.post("/actions/:id/approve", (req: Request, res: Response) => {
  try {
    const result = approveAction(param(req, "id"));
    if (result.success) {
      res.json(result);
    } else {
      const status = result.error === "Action not found" ? 404 : 400;
      res.status(status).json(result);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/actions/:id/veto
 * Veto a pending action.
 * Body: { reason?: string }
 */
router.post("/actions/:id/veto", (req: Request, res: Response) => {
  try {
    const reason = req.body?.reason as string | undefined;
    const result = vetoAction(param(req, "id"), reason);
    if (result.success) {
      res.json(result);
    } else {
      const status = result.error === "Action not found" ? 404 : 400;
      res.status(status).json(result);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Safely parse a JSON string, returning null if it fails.
 */
function param(req: Request, name: string): string {
  const v = req.params[name];
  return Array.isArray(v) ? v[0] : v;
}

function safeParseJSON(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export default router;
