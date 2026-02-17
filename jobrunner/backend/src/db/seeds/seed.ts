/**
 * Seed data — default templates (always) + demo data (demo mode only).
 * Idempotent: safe to run multiple times.
 */

import { v4 as uuidv4 } from "uuid";
import { getDb, initDb } from "../../db.js";
import { runMigrations } from "../migrate.js";
import { isDemoMode, loadConfig } from "../../config/loader.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isoDate(year: number, month: number, day: number): string {
  return new Date(year, month - 1, day).toISOString();
}

function nextOccurrence(month: number, day: number): string {
  const now = new Date();
  let year = now.getFullYear();
  const candidate = new Date(year, month - 1, day);
  if (candidate < now) {
    year++;
  }
  return new Date(year, month - 1, day).toISOString();
}

function monthlyNext(dayOfMonth: number): string {
  const now = new Date();
  let month = now.getMonth();
  let year = now.getFullYear();
  const candidate = new Date(year, month, dayOfMonth);
  if (candidate <= now) {
    month++;
    if (month > 11) { month = 0; year++; }
  }
  return new Date(year, month, dayOfMonth).toISOString();
}

function insertTemplate(
  id: string,
  title: string,
  domain: string,
  cronExpression: string,
  nextDue: string,
  itemTemplate: Record<string, unknown>
): void {
  const db = getDb();
  const exists = db.prepare("SELECT id FROM templates WHERE id = ?").get(id);
  if (exists) return;

  db.prepare(
    `INSERT INTO templates (id, title, domain, cron_expression, next_due, item_template, active)
     VALUES (?, ?, ?, ?, ?, ?, 1)`
  ).run(id, title, domain, cronExpression, nextDue, JSON.stringify(itemTemplate));
}

// ---------------------------------------------------------------------------
// Default Templates — always seeded for all users
// ---------------------------------------------------------------------------

function seedDefaultTemplates(): void {
  console.log("[seed] Seeding default templates...");

  // Household templates
  insertTemplate("tpl-electric-bill", "Pay electric bill", "household",
    "0 0 1 * *", monthlyNext(1),
    { domain: "household", source: "template", urgency_score: 7, importance_score: 8, effort_estimate: 2 }
  );

  insertTemplate("tpl-water-bill", "Pay water bill", "household",
    "0 0 15 * *", monthlyNext(15),
    { domain: "household", source: "template", urgency_score: 7, importance_score: 8, effort_estimate: 2 }
  );

  insertTemplate("tpl-hvac-filter", "Replace HVAC filter", "household",
    "0 0 1 */3 *", monthlyNext(1),
    { domain: "household", source: "template", urgency_score: 4, importance_score: 5, effort_estimate: 3 }
  );

  insertTemplate("tpl-smoke-detector", "Check smoke detector batteries", "household",
    "0 0 1 */6 *", monthlyNext(1),
    { domain: "household", source: "template", urgency_score: 5, importance_score: 9, effort_estimate: 2 }
  );

  insertTemplate("tpl-furnace-inspection", "Schedule annual furnace inspection", "household",
    "0 0 1 9 *", nextOccurrence(9, 1),
    { domain: "household", source: "template", urgency_score: 5, importance_score: 7, effort_estimate: 4 }
  );

  insertTemplate("tpl-insurance-review", "Review insurance policies", "household",
    "0 0 15 1 *", nextOccurrence(1, 15),
    { domain: "household", source: "template", urgency_score: 4, importance_score: 7, effort_estimate: 5 }
  );

  insertTemplate("tpl-tax-gather", "File taxes: gather documents", "household",
    "0 0 1 2 *", nextOccurrence(2, 1),
    { domain: "household", source: "template", urgency_score: 8, importance_score: 9, effort_estimate: 6 }
  );

  insertTemplate("tpl-tax-submit", "File taxes: submit", "household",
    "0 0 1 4 *", nextOccurrence(4, 1),
    { domain: "household", source: "template", urgency_score: 10, importance_score: 10, effort_estimate: 4 }
  );

  insertTemplate("tpl-gutters-spring", "Clean gutters (spring)", "household",
    "0 0 1 4 *", nextOccurrence(4, 1),
    { domain: "household", source: "template", urgency_score: 4, importance_score: 5, effort_estimate: 5 }
  );

  insertTemplate("tpl-gutters-fall", "Clean gutters (fall)", "household",
    "0 0 1 10 *", nextOccurrence(10, 1),
    { domain: "household", source: "template", urgency_score: 4, importance_score: 5, effort_estimate: 5 }
  );

  insertTemplate("tpl-review-subscriptions", "Review subscriptions", "household",
    "0 0 1 */3 *", monthlyNext(1),
    { domain: "household", source: "template", urgency_score: 3, importance_score: 5, effort_estimate: 3 }
  );

  // Kids templates
  insertTemplate("tpl-well-child", "Schedule well-child checkup", "kids",
    "0 0 1 1 *", nextOccurrence(1, 1),
    { domain: "kids", source: "template", urgency_score: 6, importance_score: 8, effort_estimate: 3 }
  );

  insertTemplate("tpl-immunization", "Review immunization records", "kids",
    "0 0 1 8 *", nextOccurrence(8, 1),
    { domain: "kids", source: "template", urgency_score: 7, importance_score: 9, effort_estimate: 3 }
  );

  insertTemplate("tpl-spring-activities", "Spring activity registration", "kids",
    "0 0 1 2 *", nextOccurrence(2, 1),
    { domain: "kids", source: "template", urgency_score: 6, importance_score: 6, effort_estimate: 4 }
  );

  insertTemplate("tpl-summer-camp", "Summer camp registration", "kids",
    "0 0 1 3 *", nextOccurrence(3, 1),
    { domain: "kids", source: "template", urgency_score: 7, importance_score: 7, effort_estimate: 5 }
  );

  insertTemplate("tpl-back-to-school", "Back to school prep", "kids",
    "0 0 1 8 *", nextOccurrence(8, 1),
    { domain: "kids", source: "template", urgency_score: 7, importance_score: 7, effort_estimate: 5 }
  );

  insertTemplate("tpl-ptc-fall", "Parent-teacher conference prep (fall)", "kids",
    "0 0 1 10 *", nextOccurrence(10, 1),
    { domain: "kids", source: "template", urgency_score: 6, importance_score: 7, effort_estimate: 3 }
  );

  insertTemplate("tpl-ptc-spring", "Parent-teacher conference prep (spring)", "kids",
    "0 0 1 3 *", nextOccurrence(3, 1),
    { domain: "kids", source: "template", urgency_score: 6, importance_score: 7, effort_estimate: 3 }
  );

  console.log("[seed] Default templates seeded");
}

// ---------------------------------------------------------------------------
// Demo Data — only seeded when in demo mode
// ---------------------------------------------------------------------------

function seedDemoData(): void {
  console.log("[seed] Seeding demo data...");
  const db = getDb();
  const now = new Date().toISOString();

  // Check if demo data already exists
  const existingItems = db.prepare("SELECT COUNT(*) as cnt FROM items").get() as { cnt: number };
  if (existingItems.cnt > 0) {
    console.log("[seed] Demo items already exist, skipping");
    return;
  }

  // Sample goals (DEMO_ONLY)
  const goals = [
    { id: uuidv4(), domain: "projects", description: "Ship side project MVP by summer", target_date: "2026-07-01T00:00:00.000Z", status: "active" },
    { id: uuidv4(), domain: "career", description: "Improve work-life balance", target_date: null, status: "active" },
    { id: uuidv4(), domain: "kids", description: "Be more consistent with kids' activity scheduling", target_date: null, status: "active" },
    { id: uuidv4(), domain: "household", description: "Stay on top of household maintenance", target_date: null, status: "active" },
  ];

  for (const g of goals) {
    db.prepare(
      `INSERT INTO goals (id, domain, description, target_date, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(g.id, g.domain, g.description, g.target_date, g.status, now);
  }

  // Sample knowledge_log entries (DEMO_ONLY)
  const knowledgeEntries = [
    {
      id: uuidv4(), domain: "kids", subject: "kid_jake", category: "health",
      entry_date: "2025-12-15T00:00:00.000Z",
      content: "Jake had middle ear infection (otitis media). Prescribed amoxicillin 10-day course. Resolved fully.",
      structured_tags: JSON.stringify({ condition: "otitis_media", treatment: "amoxicillin", duration: "10_days", resolved: true }),
    },
    {
      id: uuidv4(), domain: "household", subject: "house", category: "maintenance",
      entry_date: "2026-01-10T00:00:00.000Z",
      content: "Plumber said water heater is 12 years old, may need replacement within 1-2 years.",
      structured_tags: JSON.stringify({ item: "water_heater", age_years: 12, action: "monitor" }),
    },
    {
      id: uuidv4(), domain: "household", subject: "house", category: "financial",
      entry_date: "2026-01-20T00:00:00.000Z",
      content: "Electric bill has been trending up. Utility company said rates increased 8% in January.",
      structured_tags: JSON.stringify({ bill_type: "electric", trend: "increasing", rate_increase_pct: 8 }),
    },
  ];

  for (const k of knowledgeEntries) {
    db.prepare(
      `INSERT INTO knowledge_log (id, domain, subject, category, entry_date, content, structured_tags)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(k.id, k.domain, k.subject, k.category, k.entry_date, k.content, k.structured_tags);
  }

  // Sample items so the dashboard isn't empty (DEMO_ONLY)
  const items = [
    {
      id: uuidv4(), domain: "email", source: "gmail", title: "Reply to dentist office about appointment",
      urgency_score: 6, importance_score: 5, status: "open",
      due_date: new Date(Date.now() + 2 * 86400000).toISOString(),
      structured_data: JSON.stringify({ from: "frontdesk@smiledental.com", subject: "Appointment Confirmation Needed" }),
    },
    {
      id: uuidv4(), domain: "projects", source: "manual", title: "Fix auth bug in side project",
      urgency_score: 5, importance_score: 7, status: "open",
      due_date: new Date(Date.now() + 5 * 86400000).toISOString(),
      structured_data: JSON.stringify({ effort_estimate: 4 }),
    },
    {
      id: uuidv4(), domain: "household", source: "template", title: "Pay electric bill - $187",
      urgency_score: 8, importance_score: 8, status: "open",
      due_date: new Date(Date.now() + 1 * 86400000).toISOString(),
      structured_data: JSON.stringify({ bill_type: "electric", amount: 187, effort_estimate: 1 }),
    },
    {
      id: uuidv4(), domain: "career", source: "manual", title: "Prepare for 1:1 with manager",
      urgency_score: 7, importance_score: 7, status: "open",
      due_date: new Date(Date.now() + 3 * 86400000).toISOString(),
      structured_data: JSON.stringify({ effort_estimate: 3 }),
    },
    {
      id: uuidv4(), domain: "kids", source: "manual", title: "Sign Jake up for spring soccer",
      urgency_score: 6, importance_score: 6, status: "open",
      due_date: new Date(Date.now() + 7 * 86400000).toISOString(),
      structured_data: JSON.stringify({ effort_estimate: 2 }),
    },
    {
      id: uuidv4(), domain: "household", source: "template", title: "Replace HVAC filter",
      urgency_score: 3, importance_score: 5, status: "open",
      due_date: new Date(Date.now() + 14 * 86400000).toISOString(),
      structured_data: JSON.stringify({ effort_estimate: 3 }),
    },
    {
      id: uuidv4(), domain: "career", source: "x_bookmarks", title: "Read: Thread on system design patterns",
      urgency_score: 2, importance_score: 4, status: "open",
      due_date: new Date(Date.now() + 6 * 86400000).toISOString(),
      structured_data: JSON.stringify({ tweet_author: "@techleader", effort_estimate: 2 }),
    },
    {
      id: uuidv4(), domain: "kids", source: "manual", title: "Schedule dentist appointment for Emma",
      urgency_score: 5, importance_score: 7, status: "open",
      due_date: new Date(Date.now() + 10 * 86400000).toISOString(),
      structured_data: JSON.stringify({ effort_estimate: 2 }),
    },
  ];

  for (const item of items) {
    db.prepare(
      `INSERT INTO items (id, domain, source, title, urgency_score, importance_score, composite_score, status, created_at, updated_at, due_date, structured_data)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`
    ).run(
      item.id, item.domain, item.source, item.title,
      item.urgency_score, item.importance_score,
      item.status, now, now, item.due_date, item.structured_data
    );
  }

  // Seed some activity log entries (DEMO_ONLY)
  const activities = [
    { domain: "email", action: "completed", timestamp: new Date(Date.now() - 1 * 86400000).toISOString() },
    { domain: "email", action: "completed", timestamp: new Date(Date.now() - 1 * 86400000).toISOString() },
    { domain: "projects", action: "completed", timestamp: new Date(Date.now() - 1 * 86400000).toISOString() },
    { domain: "household", action: "completed", timestamp: new Date(Date.now() - 2 * 86400000).toISOString() },
    { domain: "kids", action: "created", timestamp: new Date(Date.now() - 2 * 86400000).toISOString() },
    { domain: "career", action: "completed", timestamp: new Date(Date.now() - 3 * 86400000).toISOString() },
    { domain: "email", action: "completed", timestamp: new Date(Date.now() - 3 * 86400000).toISOString() },
  ];

  for (const a of activities) {
    db.prepare(
      `INSERT INTO activity_log (timestamp, domain, action) VALUES (?, ?, ?)`
    ).run(a.timestamp, a.domain, a.action);
  }

  // Seed a demo daily snapshot
  const today = new Date().toISOString().split("T")[0];
  const existingSnapshot = db.prepare("SELECT id FROM daily_snapshots WHERE date = ?").get(today);
  if (!existingSnapshot) {
    db.prepare(
      `INSERT INTO daily_snapshots (date, top_five, domain_health, summary)
       VALUES (?, ?, ?, ?)`
    ).run(
      today,
      JSON.stringify(items.slice(0, 5).map(i => ({ id: i.id, title: i.title, domain: i.domain }))),
      JSON.stringify({ email: 0.6, projects: 0.5, household: 0.4, career: 0.7, kids: 0.5 }),
      "Good morning! It's a busy day with bills due and a 1:1 coming up. Your household domain needs some attention — the electric bill is due tomorrow. Don't forget soccer registration for Jake is coming up next week."
    );
  }

  console.log("[seed] Demo data seeded");
}

// ---------------------------------------------------------------------------
// Main seed function
// ---------------------------------------------------------------------------

export function seed(): void {
  seedDefaultTemplates();

  loadConfig();
  if (isDemoMode()) {
    seedDemoData();
  }
}

// Run directly when called as a script
const isMainModule = process.argv[1]?.endsWith("seed.ts") ||
                     process.argv[1]?.endsWith("seed.js");

if (isMainModule) {
  initDb();
  runMigrations();
  seed();
  console.log("[seed] Done");
}
