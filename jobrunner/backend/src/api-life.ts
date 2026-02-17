/**
 * Life Management API routes — new endpoints alongside the existing api.ts router.
 */

import { Router, type Request, type Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "./db.js";
import { getConfig, isDemoMode, getRedactedConfig } from "./config/loader.js";
import { runScoring, getTop5, getDomainHealth, detectHyperFocus } from "./scoring/engine.js";
import { spawnDueTemplates } from "./connectors/templates.js";
import { checkBillAnomaly } from "./connectors/anomaly.js";

const router = Router();

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

router.get("/items", (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { domain, status, source } = req.query;

    let sql = "SELECT * FROM items WHERE 1=1";
    const params: unknown[] = [];

    if (domain) { sql += " AND domain = ?"; params.push(domain); }
    if (status) { sql += " AND status = ?"; params.push(status); }
    if (source) { sql += " AND source = ?"; params.push(source); }

    sql += " ORDER BY composite_score DESC, created_at DESC";

    const items = db.prepare(sql).all(...params);
    res.json({ items });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/items/:id", (req: Request, res: Response) => {
  try {
    const item = getDb().prepare("SELECT * FROM items WHERE id = ?").get(req.params.id);
    if (!item) { res.status(404).json({ error: "Item not found" }); return; }
    res.json({ item });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/items/:id/complete", (req: Request, res: Response) => {
  try {
    const db = getDb();
    const now = new Date().toISOString();
    const item = db.prepare("SELECT * FROM items WHERE id = ?").get(req.params.id) as { id: string; domain: string } | undefined;
    if (!item) { res.status(404).json({ error: "Item not found" }); return; }

    db.prepare("UPDATE items SET status = 'done', updated_at = ?, last_touched = ? WHERE id = ?").run(now, now, req.params.id);
    db.prepare("INSERT INTO activity_log (timestamp, domain, action, item_id) VALUES (?, ?, 'completed', ?)").run(now, item.domain, req.params.id);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/items/:id/defer", (req: Request, res: Response) => {
  try {
    const db = getDb();
    const now = new Date().toISOString();
    const item = db.prepare("SELECT * FROM items WHERE id = ?").get(req.params.id) as { id: string; domain: string } | undefined;
    if (!item) { res.status(404).json({ error: "Item not found" }); return; }

    db.prepare("UPDATE items SET status = 'deferred', updated_at = ?, last_touched = ? WHERE id = ?").run(now, now, req.params.id);
    db.prepare("INSERT INTO activity_log (timestamp, domain, action, item_id) VALUES (?, ?, 'deferred', ?)").run(now, item.domain, req.params.id);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/items/:id/snooze", (req: Request, res: Response) => {
  try {
    const db = getDb();
    const now = new Date().toISOString();
    const { until } = req.body;
    const item = db.prepare("SELECT * FROM items WHERE id = ?").get(req.params.id) as { id: string; domain: string } | undefined;
    if (!item) { res.status(404).json({ error: "Item not found" }); return; }

    const snoozedUntil = until || new Date(Date.now() + 86400000).toISOString();
    db.prepare("UPDATE items SET status = 'snoozed', snoozed_until = ?, updated_at = ?, last_touched = ? WHERE id = ?").run(snoozedUntil, now, now, req.params.id);
    db.prepare("INSERT INTO activity_log (timestamp, domain, action, item_id, metadata) VALUES (?, ?, 'snoozed', ?, ?)").run(now, item.domain, req.params.id, JSON.stringify({ until: snoozedUntil }));

    res.json({ success: true, snoozed_until: snoozedUntil });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ---------------------------------------------------------------------------
// Quick Capture
// ---------------------------------------------------------------------------

router.post("/capture", async (req: Request, res: Response) => {
  try {
    const { text, domain: suggestedDomain } = req.body;
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      res.status(400).json({ error: "Text is required" });
      return;
    }

    const db = getDb();
    const now = new Date().toISOString();

    // In demo mode or when no API key, use simple parsing
    const parsed = parseQuickCapture(text.trim(), suggestedDomain);

    const results: { item?: unknown; knowledge?: unknown; anomaly?: unknown } = {};

    // Create item if type is task or both
    if (parsed.type === "task" || parsed.type === "both") {
      const itemId = uuidv4();
      db.prepare(`
        INSERT INTO items (id, domain, source, title, raw_text, structured_data, urgency_score, importance_score, composite_score, status, created_at, updated_at, due_date)
        VALUES (?, ?, 'manual', ?, ?, ?, ?, ?, 0, 'open', ?, ?, ?)
      `).run(
        itemId, parsed.domain, parsed.title, text.trim(),
        JSON.stringify({ effort_estimate: parsed.effort_estimate, ...parsed.structured_tags }),
        parsed.urgency, parsed.importance, now, now, parsed.due_date
      );

      db.prepare("INSERT INTO activity_log (timestamp, domain, action, item_id, metadata) VALUES (?, ?, 'created', ?, ?)").run(
        now, parsed.domain, itemId, JSON.stringify({ source: "quick_capture" })
      );

      results.item = { id: itemId, title: parsed.title, domain: parsed.domain };

      // Check for bill anomaly
      if (parsed.structured_tags?.bill_type && parsed.structured_tags?.amount) {
        const anomaly = checkBillAnomaly(
          parsed.structured_tags.bill_type as string,
          parsed.structured_tags.amount as number
        );
        if (anomaly.detected) {
          results.anomaly = anomaly;
        }
      }
    }

    // Create knowledge entry if type is fact or both
    if (parsed.type === "fact" || parsed.type === "both") {
      const knowledgeId = uuidv4();
      db.prepare(`
        INSERT INTO knowledge_log (id, domain, subject, category, entry_date, content, structured_tags, source_item_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        knowledgeId, parsed.domain, parsed.knowledge_subject || null,
        parsed.knowledge_category || "general", now, text.trim(),
        parsed.structured_tags ? JSON.stringify(parsed.structured_tags) : null,
        null
      );

      results.knowledge = { id: knowledgeId, subject: parsed.knowledge_subject, category: parsed.knowledge_category };
    }

    res.json({
      success: true,
      parsed,
      results,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ---------------------------------------------------------------------------
// Simple Quick Capture Parser (no LLM dependency — deterministic)
// ---------------------------------------------------------------------------

interface ParsedCapture {
  type: "task" | "fact" | "both";
  title: string;
  domain: string;
  urgency: number;
  importance: number;
  effort_estimate: number;
  due_date: string | null;
  knowledge_subject: string | null;
  knowledge_category: string | null;
  structured_tags: Record<string, unknown> | null;
  suggested_action: string | null;
}

function parseQuickCapture(text: string, suggestedDomain?: string): ParsedCapture {
  const lower = text.toLowerCase();

  // Detect domain
  let domain = suggestedDomain || "email";
  if (/\b(bill|electric|water|gas|rent|mortgage|insurance|hvac|plumb|gutter|furnace)\b/.test(lower)) domain = "household";
  else if (/\b(kid|child|jake|emma|school|soccer|camp|dentist.*kid|pediatr)/i.test(lower)) domain = "kids";
  else if (/\b(project|code|bug|deploy|pr|repo|ship|build|feature)\b/.test(lower)) domain = "projects";
  else if (/\b(career|manager|1:1|promotion|resume|interview|salary)\b/.test(lower)) domain = "career";

  // Detect type
  let type: "task" | "fact" | "both" = "task";
  const factIndicators = /\b(had|was diagnosed|doctor said|plumber said|noted|observed|measured|weigh|temperature|fever|allergic)\b/i;
  const taskIndicators = /\b(need to|should|must|todo|schedule|buy|pay|fix|sign up|register|prepare|call|email|send)\b/i;

  if (factIndicators.test(lower) && taskIndicators.test(lower)) type = "both";
  else if (factIndicators.test(lower)) type = "fact";

  // Extract amount for bills
  let structuredTags: Record<string, unknown> | null = null;
  const amountMatch = text.match(/\$(\d+(?:\.\d{2})?)/);
  const billMatch = lower.match(/\b(electric|water|gas|internet|phone|insurance|rent|mortgage)\b/);
  if (amountMatch && billMatch) {
    structuredTags = { bill_type: billMatch[1], amount: parseFloat(amountMatch[1]) };
  }

  // Extract health info for kids
  let knowledgeSubject: string | null = null;
  let knowledgeCategory: string | null = null;
  if (domain === "kids") {
    const nameMatch = lower.match(/\b(jake|emma)\b/i);
    knowledgeSubject = nameMatch ? `kid_${nameMatch[1].toLowerCase()}` : "kids";
    if (/\b(fever|sick|cough|doctor|pediatr|allergy|rash|ear|infection|medicine|prescription)\b/i.test(lower)) {
      knowledgeCategory = "health";
      if (!structuredTags) structuredTags = {};
      const tempMatch = text.match(/(\d{2,3}(?:\.\d)?)\s*(?:degrees|F|°)/i);
      if (tempMatch) structuredTags.temperature = parseFloat(tempMatch[1]);
    } else if (/\b(school|grade|homework|teacher|class)\b/i.test(lower)) {
      knowledgeCategory = "school";
    } else if (/\b(milestone|first|started|learned|can now)\b/i.test(lower)) {
      knowledgeCategory = "development";
    }
  } else if (domain === "household") {
    knowledgeSubject = "house";
    knowledgeCategory = billMatch ? "financial" : "maintenance";
  }

  // Detect urgency
  let urgency = 5;
  if (/\b(urgent|asap|emergency|immediately|critical)\b/i.test(lower)) urgency = 9;
  else if (/\b(soon|important|deadline|due)\b/i.test(lower)) urgency = 7;
  else if (/\b(whenever|someday|low priority|nice to have)\b/i.test(lower)) urgency = 2;

  // Detect due date hints
  let dueDate: string | null = null;
  const tomorrowMatch = /\btomorrow\b/i.test(lower);
  const nextWeekMatch = /\bnext week\b/i.test(lower);
  const todayMatch = /\btoday\b/i.test(lower);
  if (todayMatch) dueDate = new Date().toISOString();
  else if (tomorrowMatch) dueDate = new Date(Date.now() + 86400000).toISOString();
  else if (nextWeekMatch) dueDate = new Date(Date.now() + 7 * 86400000).toISOString();

  // Title: clean up the text
  let title = text.trim();
  if (title.length > 80) title = title.substring(0, 77) + "...";

  return {
    type,
    title,
    domain,
    urgency,
    importance: Math.min(10, urgency + 1),
    effort_estimate: 5,
    due_date: dueDate,
    knowledge_subject: knowledgeSubject,
    knowledge_category: knowledgeCategory,
    structured_tags: structuredTags,
    suggested_action: null,
  };
}

// ---------------------------------------------------------------------------
// Knowledge Log
// ---------------------------------------------------------------------------

router.get("/knowledge", (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { domain, subject, category } = req.query;

    let sql = "SELECT * FROM knowledge_log WHERE 1=1";
    const params: unknown[] = [];

    if (domain) { sql += " AND domain = ?"; params.push(domain); }
    if (subject) { sql += " AND subject = ?"; params.push(subject); }
    if (category) { sql += " AND category = ?"; params.push(category); }

    sql += " ORDER BY entry_date DESC";

    const entries = db.prepare(sql).all(...params);
    res.json({ entries });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/knowledge/:subject", (req: Request, res: Response) => {
  try {
    const entries = getDb().prepare(
      "SELECT * FROM knowledge_log WHERE subject = ? ORDER BY entry_date DESC"
    ).all(req.params.subject);
    res.json({ entries });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ---------------------------------------------------------------------------
// Scoring & Priorities
// ---------------------------------------------------------------------------

router.get("/priorities", (_req: Request, res: Response) => {
  try {
    const result = runScoring();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/domain-health", (_req: Request, res: Response) => {
  try {
    const health = getDomainHealth();
    res.json({ health });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ---------------------------------------------------------------------------
// Briefing
// ---------------------------------------------------------------------------

router.get("/briefing/today", (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const today = new Date().toISOString().split("T")[0];
    const snapshot = db.prepare("SELECT * FROM daily_snapshots WHERE date = ?").get(today);

    if (snapshot) {
      res.json({ briefing: snapshot });
    } else {
      // Generate on the fly
      const result = runScoring();
      res.json({
        briefing: {
          date: today,
          top_five: JSON.stringify(result.top5.map(i => ({ id: i.id, title: i.title, domain: i.domain, score: i.composite_score, reason: i.rank_reason }))),
          domain_health: JSON.stringify(Object.fromEntries(result.domainHealth.map(d => [d.domain, d.score]))),
          summary: null,
        },
        hyper_focus: result.hyperFocus,
      });
    }
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/briefing/history", (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 7;
    const snapshots = getDb().prepare(
      "SELECT * FROM daily_snapshots ORDER BY date DESC LIMIT ?"
    ).all(limit);
    res.json({ snapshots });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------

router.get("/goals", (_req: Request, res: Response) => {
  try {
    const goals = getDb().prepare("SELECT * FROM goals ORDER BY created_at DESC").all();
    res.json({ goals });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/goals", (req: Request, res: Response) => {
  try {
    const { domain, description, target_date } = req.body;
    if (!domain || !description) {
      res.status(400).json({ error: "domain and description are required" });
      return;
    }

    const id = uuidv4();
    const now = new Date().toISOString();
    getDb().prepare(
      "INSERT INTO goals (id, domain, description, target_date, status, created_at) VALUES (?, ?, ?, ?, 'active', ?)"
    ).run(id, domain, description, target_date || null, now);

    res.json({ id, domain, description, target_date, status: "active", created_at: now });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.put("/goals/:id", (req: Request, res: Response) => {
  try {
    const { description, target_date, status } = req.body;
    const db = getDb();
    const existing = db.prepare("SELECT * FROM goals WHERE id = ?").get(req.params.id);
    if (!existing) { res.status(404).json({ error: "Goal not found" }); return; }

    const fields: string[] = [];
    const values: unknown[] = [];
    if (description !== undefined) { fields.push("description = ?"); values.push(description); }
    if (target_date !== undefined) { fields.push("target_date = ?"); values.push(target_date); }
    if (status !== undefined) { fields.push("status = ?"); values.push(status); }

    if (fields.length > 0) {
      values.push(req.params.id);
      db.prepare(`UPDATE goals SET ${fields.join(", ")} WHERE id = ?`).run(...values);
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

router.get("/templates", (_req: Request, res: Response) => {
  try {
    const templates = getDb().prepare("SELECT * FROM templates ORDER BY domain, title").all();
    res.json({ templates });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/templates", (req: Request, res: Response) => {
  try {
    const { title, domain, cron_expression, next_due, item_template } = req.body;
    if (!title || !domain || !cron_expression) {
      res.status(400).json({ error: "title, domain, and cron_expression are required" });
      return;
    }

    const id = uuidv4();
    getDb().prepare(
      "INSERT INTO templates (id, title, domain, cron_expression, next_due, item_template, active) VALUES (?, ?, ?, ?, ?, ?, 1)"
    ).run(id, title, domain, cron_expression, next_due || new Date().toISOString(), JSON.stringify(item_template || {}));

    res.json({ id, title, domain, cron_expression });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.put("/templates/:id", (req: Request, res: Response) => {
  try {
    const { title, cron_expression, active, item_template } = req.body;
    const db = getDb();
    const existing = db.prepare("SELECT * FROM templates WHERE id = ?").get(req.params.id);
    if (!existing) { res.status(404).json({ error: "Template not found" }); return; }

    const fields: string[] = [];
    const values: unknown[] = [];
    if (title !== undefined) { fields.push("title = ?"); values.push(title); }
    if (cron_expression !== undefined) { fields.push("cron_expression = ?"); values.push(cron_expression); }
    if (active !== undefined) { fields.push("active = ?"); values.push(active ? 1 : 0); }
    if (item_template !== undefined) { fields.push("item_template = ?"); values.push(JSON.stringify(item_template)); }

    if (fields.length > 0) {
      values.push(req.params.id);
      db.prepare(`UPDATE templates SET ${fields.join(", ")} WHERE id = ?`).run(...values);
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ---------------------------------------------------------------------------
// Weekly Review
// ---------------------------------------------------------------------------

router.get("/review/latest", (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

    const completed = db.prepare(
      "SELECT domain, COUNT(*) as cnt FROM activity_log WHERE action = 'completed' AND timestamp >= ? GROUP BY domain"
    ).all(weekAgo) as { domain: string; cnt: number }[];

    const created = db.prepare(
      "SELECT domain, COUNT(*) as cnt FROM activity_log WHERE action = 'created' AND timestamp >= ? GROUP BY domain"
    ).all(weekAgo) as { domain: string; cnt: number }[];

    const openItems = db.prepare(
      "SELECT domain, COUNT(*) as cnt FROM items WHERE status = 'open' GROUP BY domain"
    ).all() as { domain: string; cnt: number }[];

    const goals = db.prepare("SELECT * FROM goals WHERE status = 'active'").all();

    const nudges = db.prepare(
      "SELECT * FROM nudges WHERE status = 'pending' ORDER BY created_at DESC LIMIT 5"
    ).all();

    res.json({
      review: {
        period_start: weekAgo,
        period_end: new Date().toISOString(),
        completed_by_domain: Object.fromEntries(completed.map(r => [r.domain, r.cnt])),
        created_by_domain: Object.fromEntries(created.map(r => [r.domain, r.cnt])),
        open_by_domain: Object.fromEntries(openItems.map(r => [r.domain, r.cnt])),
        goals,
        nudges,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/review/generate", async (_req: Request, res: Response) => {
  try {
    // Trigger template spawning and scoring
    const spawned = spawnDueTemplates();
    const scoring = runScoring();

    res.json({
      success: true,
      templates_spawned: spawned,
      scoring,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ---------------------------------------------------------------------------
// Nudges
// ---------------------------------------------------------------------------

router.get("/nudges", (_req: Request, res: Response) => {
  try {
    const nudges = getDb().prepare(
      "SELECT * FROM nudges WHERE status = 'pending' ORDER BY created_at DESC"
    ).all();
    res.json({ nudges });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/nudges/:id/accept", (req: Request, res: Response) => {
  try {
    const db = getDb();
    const nudge = db.prepare("SELECT * FROM nudges WHERE id = ?").get(req.params.id) as { id: string; content: string; domain: string } | undefined;
    if (!nudge) { res.status(404).json({ error: "Nudge not found" }); return; }

    db.prepare("UPDATE nudges SET status = 'accepted' WHERE id = ?").run(req.params.id);

    // Create an item from the nudge
    const itemId = uuidv4();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO items (id, domain, source, title, urgency_score, importance_score, composite_score, status, created_at, updated_at)
      VALUES (?, ?, 'manual', ?, 5, 5, 0, 'open', ?, ?)
    `).run(itemId, nudge.domain || "email", nudge.content, now, now);

    res.json({ success: true, item_id: itemId });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/nudges/:id/dismiss", (req: Request, res: Response) => {
  try {
    const db = getDb();
    db.prepare("UPDATE nudges SET status = 'dismissed' WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ---------------------------------------------------------------------------
// Settings / Connections
// ---------------------------------------------------------------------------

router.get("/connections", (_req: Request, res: Response) => {
  try {
    const config = getConfig();
    res.json({
      connections: {
        gmail: { enabled: config.gmail.enabled, connected: config.gmail.enabled && config.gmail.client_id !== "" && !config.gmail.client_id.startsWith("YOUR_") },
        x_bookmarks: { enabled: config.x_bookmarks.enabled, connected: config.x_bookmarks.enabled && config.x_bookmarks.api_key !== "" && !config.x_bookmarks.api_key.startsWith("YOUR_") },
      },
      demo_mode: isDemoMode(),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/settings", (_req: Request, res: Response) => {
  try {
    const config = getRedactedConfig();
    res.json({ settings: config, demo_mode: isDemoMode() });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ---------------------------------------------------------------------------
// Activity
// ---------------------------------------------------------------------------

router.get("/activity", (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const activities = getDb().prepare(
      "SELECT * FROM activity_log ORDER BY timestamp DESC LIMIT ?"
    ).all(limit);
    res.json({ activities });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/activity/domain-summary", (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string, 10) || 7;
    const cutoff = new Date(Date.now() - days * 86400000).toISOString();

    const summary = getDb().prepare(`
      SELECT domain, action, COUNT(*) as cnt
      FROM activity_log
      WHERE timestamp >= ?
      GROUP BY domain, action
      ORDER BY domain, action
    `).all(cutoff);

    res.json({ summary, days });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ---------------------------------------------------------------------------
// Domains config
// ---------------------------------------------------------------------------

router.get("/domains", (_req: Request, res: Response) => {
  try {
    const config = getConfig();
    res.json({ domains: config.domains });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
