/**
 * Template spawner — checks all active templates and creates items for any that are due.
 */

import { v4 as uuidv4 } from "uuid";
import { getDb } from "../db.js";

interface TemplateRow {
  id: string;
  title: string;
  domain: string;
  cron_expression: string;
  next_due: string;
  item_template: string;
  active: number;
}

/**
 * Check all active templates and create items for any that are due.
 * Returns the number of items spawned.
 */
export function spawnDueTemplates(): number {
  const db = getDb();
  const now = new Date().toISOString();

  const dueTemplates = db.prepare(
    `SELECT * FROM templates WHERE active = 1 AND next_due <= ?`
  ).all(now) as TemplateRow[];

  let spawned = 0;

  for (const tpl of dueTemplates) {
    let itemData: Record<string, unknown>;
    try {
      itemData = JSON.parse(tpl.item_template);
    } catch {
      itemData = {};
    }

    const itemId = uuidv4();

    // Create the item
    db.prepare(`
      INSERT INTO items (id, domain, source, title, urgency_score, importance_score, composite_score, status, created_at, updated_at, due_date, structured_data)
      VALUES (?, ?, 'template', ?, ?, ?, 0, 'open', ?, ?, ?, ?)
    `).run(
      itemId,
      tpl.domain,
      tpl.title,
      (itemData.urgency_score as number) || 5,
      (itemData.importance_score as number) || 5,
      now,
      now,
      // Due 7 days from now by default
      new Date(Date.now() + 7 * 86400000).toISOString(),
      JSON.stringify(itemData)
    );

    // Log the activity
    db.prepare(`
      INSERT INTO activity_log (timestamp, domain, action, item_id, metadata)
      VALUES (?, ?, 'created', ?, ?)
    `).run(now, tpl.domain, itemId, JSON.stringify({ source: "template", template_id: tpl.id }));

    // Advance next_due based on cron pattern
    const nextDue = computeNextDue(tpl.cron_expression, now);
    db.prepare("UPDATE templates SET next_due = ? WHERE id = ?").run(nextDue, tpl.id);

    spawned++;
  }

  return spawned;
}

/**
 * Simple next-due computation from a cron expression.
 * For templates, we use simplified cron patterns and advance by the interval.
 */
function computeNextDue(cronExpression: string, fromDate: string): string {
  const from = new Date(fromDate);
  const parts = cronExpression.split(" ");

  // Parse cron: minute hour dayOfMonth month dayOfWeek
  if (parts.length !== 5) {
    // Default: advance by 30 days
    return new Date(from.getTime() + 30 * 86400000).toISOString();
  }

  const dayOfMonth = parts[2];
  const month = parts[3];

  // Monthly: "0 0 N * *" — advance to next month, same day
  if (month === "*" && dayOfMonth !== "*") {
    const day = parseInt(dayOfMonth, 10);
    let nextMonth = from.getMonth() + 1;
    let nextYear = from.getFullYear();
    if (nextMonth > 11) { nextMonth = 0; nextYear++; }
    return new Date(nextYear, nextMonth, day).toISOString();
  }

  // Every N months: "0 0 N */N *"
  if (month.startsWith("*/")) {
    const interval = parseInt(month.substring(2), 10) || 1;
    const day = parseInt(dayOfMonth, 10) || 1;
    let nextMonth = from.getMonth() + interval;
    let nextYear = from.getFullYear();
    while (nextMonth > 11) { nextMonth -= 12; nextYear++; }
    return new Date(nextYear, nextMonth, day).toISOString();
  }

  // Specific month: "0 0 N M *" — advance to next year
  if (month !== "*" && !month.startsWith("*/")) {
    const specificMonth = parseInt(month, 10) - 1;
    const day = parseInt(dayOfMonth, 10) || 1;
    let nextYear = from.getFullYear();
    const candidate = new Date(nextYear, specificMonth, day);
    if (candidate <= from) nextYear++;
    return new Date(nextYear, specificMonth, day).toISOString();
  }

  // Default: 30 days
  return new Date(from.getTime() + 30 * 86400000).toISOString();
}
