import Database from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db: Database.Database;

// ---------------------------------------------------------------------------
// Database lifecycle
// ---------------------------------------------------------------------------

export function getDb(): Database.Database {
  if (!db) {
    const dataDir = path.join(__dirname, "..", "data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    db = new Database(path.join(dataDir, "jobrunner.db"));
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
  }
  return db;
}

export function initDb(): void {
  const database = getDb();

  database.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      schedule TEXT NOT NULL,
      goal TEXT NOT NULL,
      policies TEXT,
      boundaries TEXT,
      tools TEXT,
      file_path TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      last_run TEXT,
      next_run TEXT
    );

    CREATE TABLE IF NOT EXISTS executions (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      status TEXT NOT NULL CHECK(status IN ('running','completed','failed','awaiting-approval')),
      summary TEXT,
      error TEXT
    );

    CREATE TABLE IF NOT EXISTS actions (
      id TEXT PRIMARY KEY,
      execution_id TEXT NOT NULL REFERENCES executions(id),
      description TEXT NOT NULL,
      tool TEXT,
      status TEXT NOT NULL CHECK(status IN ('executed','pending-approval','approved','vetoed')),
      boundary_violation TEXT,
      result TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // Seed if empty
  const count = database.prepare("SELECT COUNT(*) as cnt FROM executions").get() as { cnt: number };
  if (count.cnt === 0) {
    seedDatabase(database);
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface JobRow {
  id: string;
  title: string;
  schedule: string;
  goal: string;
  policies: string | null;
  boundaries: string | null;
  tools: string | null;
  file_path: string;
  enabled: number;
  last_run: string | null;
  next_run: string | null;
}

export interface ExecutionRow {
  id: string;
  job_id: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  summary: string | null;
  error: string | null;
}

export interface ActionRow {
  id: string;
  execution_id: string;
  description: string;
  tool: string | null;
  status: string;
  boundary_violation: string | null;
  result: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Job CRUD
// ---------------------------------------------------------------------------

export function getAllJobs(): JobRow[] {
  return getDb().prepare("SELECT * FROM jobs ORDER BY title").all() as JobRow[];
}

export function getJob(id: string): JobRow | undefined {
  return getDb().prepare("SELECT * FROM jobs WHERE id = ?").get(id) as JobRow | undefined;
}

export function upsertJob(job: {
  id: string;
  title: string;
  schedule: string;
  goal: string;
  policies?: string;
  boundaries?: string;
  tools?: string;
  file_path: string;
  enabled?: number;
}): void {
  const database = getDb();
  const existing = getJob(job.id);
  if (existing) {
    database
      .prepare(
        `UPDATE jobs SET title = ?, schedule = ?, goal = ?, policies = ?, boundaries = ?, tools = ?, file_path = ?
         WHERE id = ?`
      )
      .run(
        job.title,
        job.schedule,
        job.goal,
        job.policies ?? null,
        job.boundaries ?? null,
        job.tools ?? null,
        job.file_path,
        job.id
      );
  } else {
    database
      .prepare(
        `INSERT INTO jobs (id, title, schedule, goal, policies, boundaries, tools, file_path, enabled)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        job.id,
        job.title,
        job.schedule,
        job.goal,
        job.policies ?? null,
        job.boundaries ?? null,
        job.tools ?? null,
        job.file_path,
        job.enabled ?? 1
      );
  }
}

export function toggleJob(id: string): JobRow | undefined {
  const database = getDb();
  const job = getJob(id);
  if (!job) return undefined;
  const newEnabled = job.enabled ? 0 : 1;
  database.prepare("UPDATE jobs SET enabled = ? WHERE id = ?").run(newEnabled, id);
  return getJob(id);
}

// ---------------------------------------------------------------------------
// Execution CRUD
// ---------------------------------------------------------------------------

export function createExecution(exec: {
  id: string;
  job_id: string;
  started_at: string;
  status: string;
  summary?: string;
}): void {
  getDb()
    .prepare(
      `INSERT INTO executions (id, job_id, started_at, status, summary)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(exec.id, exec.job_id, exec.started_at, exec.status, exec.summary ?? null);
}

export function getExecution(id: string): ExecutionRow | undefined {
  return getDb().prepare("SELECT * FROM executions WHERE id = ?").get(id) as ExecutionRow | undefined;
}

export function updateExecution(
  id: string,
  data: Partial<Pick<ExecutionRow, "completed_at" | "status" | "summary" | "error">>
): void {
  const fields: string[] = [];
  const values: unknown[] = [];
  if (data.completed_at !== undefined) {
    fields.push("completed_at = ?");
    values.push(data.completed_at);
  }
  if (data.status !== undefined) {
    fields.push("status = ?");
    values.push(data.status);
  }
  if (data.summary !== undefined) {
    fields.push("summary = ?");
    values.push(data.summary);
  }
  if (data.error !== undefined) {
    fields.push("error = ?");
    values.push(data.error);
  }
  if (fields.length === 0) return;
  values.push(id);
  getDb()
    .prepare(`UPDATE executions SET ${fields.join(", ")} WHERE id = ?`)
    .run(...values);
}

export function getExecutionsByJob(jobId: string, limit = 20): ExecutionRow[] {
  return getDb()
    .prepare("SELECT * FROM executions WHERE job_id = ? ORDER BY started_at DESC LIMIT ?")
    .all(jobId, limit) as ExecutionRow[];
}

export function getTimeline(limit = 20, offset = 0): (ExecutionRow & { job_title?: string })[] {
  return getDb()
    .prepare(
      `SELECT e.*, j.title as job_title
       FROM executions e
       LEFT JOIN jobs j ON e.job_id = j.id
       ORDER BY e.started_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(limit, offset) as (ExecutionRow & { job_title?: string })[];
}

// ---------------------------------------------------------------------------
// Action CRUD
// ---------------------------------------------------------------------------

export function createAction(action: {
  id: string;
  execution_id: string;
  description: string;
  tool?: string;
  status: string;
  boundary_violation?: string;
  result?: string;
  created_at: string;
}): void {
  getDb()
    .prepare(
      `INSERT INTO actions (id, execution_id, description, tool, status, boundary_violation, result, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      action.id,
      action.execution_id,
      action.description,
      action.tool ?? null,
      action.status,
      action.boundary_violation ?? null,
      action.result ?? null,
      action.created_at
    );
}

export function getActionsByExecution(execId: string): ActionRow[] {
  return getDb()
    .prepare("SELECT * FROM actions WHERE execution_id = ? ORDER BY created_at ASC")
    .all(execId) as ActionRow[];
}

export function getPendingApprovals(): (ActionRow & { job_id?: string; job_title?: string; execution_status?: string })[] {
  return getDb()
    .prepare(
      `SELECT a.*, e.job_id, j.title as job_title, e.status as execution_status
       FROM actions a
       JOIN executions e ON a.execution_id = e.id
       LEFT JOIN jobs j ON e.job_id = j.id
       WHERE a.status = 'pending-approval'
       ORDER BY a.created_at ASC`
    )
    .all() as (ActionRow & { job_id?: string; job_title?: string; execution_status?: string })[];
}

export function updateAction(
  id: string,
  data: Partial<Pick<ActionRow, "status" | "result" | "boundary_violation">>
): void {
  const fields: string[] = [];
  const values: unknown[] = [];
  if (data.status !== undefined) {
    fields.push("status = ?");
    values.push(data.status);
  }
  if (data.result !== undefined) {
    fields.push("result = ?");
    values.push(data.result);
  }
  if (data.boundary_violation !== undefined) {
    fields.push("boundary_violation = ?");
    values.push(data.boundary_violation);
  }
  if (fields.length === 0) return;
  values.push(id);
  getDb()
    .prepare(`UPDATE actions SET ${fields.join(", ")} WHERE id = ?`)
    .run(...values);
}

export function getAction(id: string): ActionRow | undefined {
  return getDb().prepare("SELECT * FROM actions WHERE id = ?").get(id) as ActionRow | undefined;
}

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

function seedDatabase(database: Database.Database): void {
  const now = new Date();

  // Helper to create ISO timestamps relative to now
  const ago = (hours: number, minutes = 0): string => {
    const d = new Date(now.getTime() - hours * 3600000 - minutes * 60000);
    return d.toISOString();
  };

  // ---- Seed jobs ----
  const emailJobId = "email-triage";
  const prJobId = "pr-review";

  database
    .prepare(
      `INSERT INTO jobs (id, title, schedule, goal, policies, boundaries, tools, file_path, enabled, last_run) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      emailJobId,
      "Email Triage Agent",
      "0 */4 * * *",
      "Keep inbox clean by archiving marketing, starring important messages, and drafting replies for action items.",
      JSON.stringify([
        "Archive marketing emails automatically",
        "Star emails from known contacts",
        "Draft replies for emails that need a response",
        "Flag suspicious emails",
      ]),
      JSON.stringify([
        "Never send emails directly - only draft replies for approval",
        "Never delete emails - only archive",
        "Never unsubscribe from mailing lists without approval",
      ]),
      JSON.stringify(["gmail"]),
      "../jobs/email-triage.job.md",
      1,
      ago(4)
    );

  database
    .prepare(
      `INSERT INTO jobs (id, title, schedule, goal, policies, boundaries, tools, file_path, enabled, last_run) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      prJobId,
      "PR Review Agent",
      "30 9 * * 1-5",
      "Review open pull requests, check for bugs, style issues, and security vulnerabilities. Leave helpful comments.",
      JSON.stringify([
        "Review all open PRs with changes in the last 24h",
        "Check for common bug patterns",
        "Verify test coverage mentions",
        "Comment with constructive feedback",
      ]),
      JSON.stringify([
        "Never approve PRs directly - request human approval first",
        "Never merge PRs",
        "Do not comment on PRs older than 7 days unless critical",
      ]),
      JSON.stringify(["github"]),
      "../jobs/pr-review.job.md",
      1,
      ago(26)
    );

  // ---- Seed executions and actions ----

  // Execution 1: Email triage 3 days ago - completed successfully
  const exec1Id = uuidv4();
  database
    .prepare(
      `INSERT INTO executions (id, job_id, started_at, completed_at, status, summary) VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      exec1Id,
      emailJobId,
      ago(72),
      ago(71, 55),
      "completed",
      "Processed 12 emails: archived 5 marketing, starred 3 from known contacts, drafted 2 replies, flagged 2 suspicious."
    );

  const exec1Actions = [
    { desc: "Listed inbox emails", tool: "gmail_list_emails", status: "executed", result: "Found 12 unread emails" },
    { desc: 'Archived marketing email from "ShopDeals Weekly"', tool: "gmail_archive_email", status: "executed", result: "Archived successfully" },
    { desc: 'Archived promotional email from "CloudHost Offers"', tool: "gmail_archive_email", status: "executed", result: "Archived successfully" },
    { desc: 'Archived newsletter from "TechCrunch Daily"', tool: "gmail_archive_email", status: "executed", result: "Archived successfully" },
    { desc: 'Archived marketing email from "Figma Updates"', tool: "gmail_archive_email", status: "executed", result: "Archived successfully" },
    { desc: 'Archived promotional email from "AWS re:Invent"', tool: "gmail_archive_email", status: "executed", result: "Archived successfully" },
    { desc: 'Starred email from Sarah Chen (Engineering Lead)', tool: "gmail_star_email", status: "executed", result: "Starred successfully" },
    { desc: 'Starred email from Mike Johnson (PM)', tool: "gmail_star_email", status: "executed", result: "Starred successfully" },
    { desc: 'Starred email from Lisa Park (Design)', tool: "gmail_star_email", status: "executed", result: "Starred successfully" },
    { desc: 'Flagged suspicious email from "security-alert@g00gle.com"', tool: "gmail_flag_email", status: "executed", result: "Flagged as phishing attempt" },
    { desc: 'Flagged email from unknown sender "prince-offer@mail.ng"', tool: "gmail_flag_email", status: "executed", result: "Flagged as spam" },
  ];

  for (let i = 0; i < exec1Actions.length; i++) {
    const a = exec1Actions[i];
    database
      .prepare(
        `INSERT INTO actions (id, execution_id, description, tool, status, result, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(uuidv4(), exec1Id, a.desc, a.tool, a.status, a.result, ago(72, -(i * 0.5)));
  }

  // Execution 2: Email triage yesterday - completed with pending approval
  const exec2Id = uuidv4();
  database
    .prepare(
      `INSERT INTO executions (id, job_id, started_at, completed_at, status, summary) VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      exec2Id,
      emailJobId,
      ago(28),
      ago(27, 52),
      "awaiting-approval",
      "Processed 8 emails: archived 3 marketing, starred 2. Drafted reply to Sarah Chen about sprint planning - awaiting approval."
    );

  const exec2Actions = [
    { desc: "Listed inbox emails", tool: "gmail_list_emails", status: "executed", result: "Found 8 unread emails" },
    { desc: 'Archived marketing email from "ProductHunt Daily"', tool: "gmail_archive_email", status: "executed", result: "Archived successfully" },
    { desc: 'Archived newsletter from "JavaScript Weekly"', tool: "gmail_archive_email", status: "executed", result: "Archived successfully" },
    { desc: 'Archived promotional email from "Vercel Ship"', tool: "gmail_archive_email", status: "executed", result: "Archived successfully" },
    { desc: 'Starred email from Sarah Chen re: Sprint Planning', tool: "gmail_star_email", status: "executed", result: "Starred successfully" },
    { desc: 'Starred email from CTO re: Architecture Review', tool: "gmail_star_email", status: "executed", result: "Starred successfully" },
    {
      desc: 'Draft reply to Sarah Chen about sprint planning: "Hi Sarah, confirming attendance for Thursday\'s sprint planning. I\'ll prepare the backlog review. See you at 10am."',
      tool: "gmail_draft_reply",
      status: "pending-approval",
      boundary_violation: "Boundary: Never send emails directly - drafts require human approval before sending",
      result: null,
    },
  ];

  for (let i = 0; i < exec2Actions.length; i++) {
    const a = exec2Actions[i];
    database
      .prepare(
        `INSERT INTO actions (id, execution_id, description, tool, status, boundary_violation, result, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(uuidv4(), exec2Id, a.desc, a.tool, a.status, a.boundary_violation ?? null, a.result, ago(28, -(i * 0.5)));
  }

  // Execution 3: PR review yesterday - completed with pending approval
  const exec3Id = uuidv4();
  database
    .prepare(
      `INSERT INTO executions (id, job_id, started_at, completed_at, status, summary) VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      exec3Id,
      prJobId,
      ago(26),
      ago(25, 48),
      "awaiting-approval",
      "Reviewed 3 open PRs. Found potential null pointer bug in PR #142. Left comments on PR #139 and #141. Requesting approval to approve PR #139."
    );

  const exec3Actions = [
    { desc: "Listed open pull requests", tool: "github_list_open_prs", status: "executed", result: "Found 3 open PRs: #139, #141, #142" },
    {
      desc: 'Commented on PR #139 (Add user avatar component): "Clean implementation. Good test coverage. Minor suggestion: consider memoizing the image load handler."',
      tool: "github_comment_on_pr",
      status: "executed",
      result: "Comment posted successfully",
    },
    {
      desc: 'Commented on PR #141 (Refactor auth middleware): "The token refresh logic looks solid. One concern: the error handling on line 47 might swallow connection timeouts."',
      tool: "github_comment_on_pr",
      status: "executed",
      result: "Comment posted successfully",
    },
    {
      desc: 'Reviewed PR #142 (Update payment flow): Found potential null pointer dereference when user.billingAddress is undefined on line 83.',
      tool: "github_review_pr",
      status: "executed",
      result: "Review submitted with comments about null safety issue",
    },
    {
      desc: "Approve PR #139 (Add user avatar component) - all checks passing, clean code, good tests",
      tool: "github_approve_pr",
      status: "pending-approval",
      boundary_violation: "Boundary: Never approve PRs directly - requires human approval first",
      result: null,
    },
  ];

  for (let i = 0; i < exec3Actions.length; i++) {
    const a = exec3Actions[i];
    database
      .prepare(
        `INSERT INTO actions (id, execution_id, description, tool, status, boundary_violation, result, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(uuidv4(), exec3Id, a.desc, a.tool, a.status, a.boundary_violation ?? null, a.result, ago(26, -(i * 0.5)));
  }

  // Execution 4: Email triage 4 hours ago - completed cleanly
  const exec4Id = uuidv4();
  database
    .prepare(
      `INSERT INTO executions (id, job_id, started_at, completed_at, status, summary) VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      exec4Id,
      emailJobId,
      ago(4),
      ago(3, 56),
      "completed",
      "Processed 5 emails: archived 2 marketing, starred 1 from Mike Johnson, flagged 1 suspicious. Inbox looking clean."
    );

  const exec4Actions = [
    { desc: "Listed inbox emails", tool: "gmail_list_emails", status: "executed", result: "Found 5 unread emails" },
    { desc: 'Archived marketing email from "GitHub Universe"', tool: "gmail_archive_email", status: "executed", result: "Archived successfully" },
    { desc: 'Archived newsletter from "Node Weekly"', tool: "gmail_archive_email", status: "executed", result: "Archived successfully" },
    { desc: 'Starred email from Mike Johnson re: Q1 Roadmap Update', tool: "gmail_star_email", status: "executed", result: "Starred successfully" },
    { desc: 'Flagged suspicious email from "admin@paypa1-security.com"', tool: "gmail_flag_email", status: "executed", result: "Flagged as phishing attempt" },
  ];

  for (let i = 0; i < exec4Actions.length; i++) {
    const a = exec4Actions[i];
    database
      .prepare(
        `INSERT INTO actions (id, execution_id, description, tool, status, result, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(uuidv4(), exec4Id, a.desc, a.tool, a.status, a.result, ago(4, -(i * 0.5)));
  }

  // Execution 5: A failed execution 2 days ago (to show error state)
  const exec5Id = uuidv4();
  database
    .prepare(
      `INSERT INTO executions (id, job_id, started_at, completed_at, status, summary, error) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      exec5Id,
      emailJobId,
      ago(52),
      ago(52),
      "failed",
      null,
      "Gmail API returned 503 Service Unavailable. Will retry on next scheduled run."
    );

  console.log("[db] Seeded database with sample executions and actions");
}
