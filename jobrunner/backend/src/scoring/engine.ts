/**
 * Scoring Engine — computes composite scores for items and generates the top-5 priority list.
 * Pure TypeScript module with no external API dependencies.
 */

import { getDb } from "../db.js";
import { getConfig } from "../config/loader.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScoredItem {
  id: string;
  domain: string;
  source: string;
  title: string;
  urgency_score: number;
  importance_score: number;
  composite_score: number;
  status: string;
  created_at: string;
  updated_at: string;
  due_date: string | null;
  structured_data: string | null;
  snoozed_until: string | null;
  scoring_breakdown?: {
    deadline: number;
    consequence: number;
    effort_boost: number;
    domain_neglect: number;
    staleness: number;
    raw: number;
  };
  rank_reason?: string;
}

export interface DomainHealth {
  domain: string;
  score: number;
  overdue_count: number;
  open_count: number;
  completed_7d: number;
  days_since_activity: number;
}

export interface DomainActivity {
  domain: string;
  completed_count: number;
  total_actions: number;
  last_activity: string | null;
}

export interface HyperFocusAlert {
  detected: boolean;
  focused_domain: string | null;
  focused_percent: number;
  neglected_domain: string | null;
}

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA).getTime();
  const b = new Date(dateB).getTime();
  return (b - a) / (1000 * 60 * 60 * 24);
}

function daysUntilDue(dueDate: string): number {
  const now = new Date().toISOString();
  return daysBetween(now, dueDate);
}

function daysSince(date: string): number {
  const now = new Date().toISOString();
  return daysBetween(date, now);
}

function getEffortEstimate(item: ScoredItem): number {
  if (item.structured_data) {
    try {
      const data = JSON.parse(item.structured_data);
      if (typeof data.effort_estimate === "number") return data.effort_estimate;
    } catch { /* ignore */ }
  }
  // Defaults by source
  switch (item.source) {
    case "gmail": return 2;
    case "x_bookmarks": return 3;
    case "template": return 4;
    case "manual": return 5;
    default: return 5;
  }
}

// ---------------------------------------------------------------------------
// Domain activity computation
// ---------------------------------------------------------------------------

export function getDomainActivity(): DomainActivity[] {
  const db = getDb();
  const config = getConfig();
  const domains = config.domains.map(d => d.id);
  const lookbackDays = 7;
  const cutoff = new Date(Date.now() - lookbackDays * 86400000).toISOString();

  const result: DomainActivity[] = [];

  for (const domain of domains) {
    const completed = db.prepare(
      `SELECT COUNT(*) as cnt FROM activity_log WHERE domain = ? AND action = 'completed' AND timestamp >= ?`
    ).get(domain, cutoff) as { cnt: number };

    const total = db.prepare(
      `SELECT COUNT(*) as cnt FROM activity_log WHERE domain = ? AND timestamp >= ?`
    ).get(domain, cutoff) as { cnt: number };

    const lastRow = db.prepare(
      `SELECT timestamp FROM activity_log WHERE domain = ? ORDER BY timestamp DESC LIMIT 1`
    ).get(domain) as { timestamp: string } | undefined;

    result.push({
      domain,
      completed_count: completed.cnt,
      total_actions: total.cnt,
      last_activity: lastRow?.timestamp ?? null,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Domain neglect computation
// ---------------------------------------------------------------------------

function computeDomainNeglect(domain: string, activities: DomainActivity[]): number {
  const activity = activities.find(a => a.domain === domain);
  if (!activity) return 5; // max neglect if no data

  const config = getConfig();
  const totalCompleted = activities.reduce((sum, a) => sum + a.completed_count, 0);

  if (totalCompleted === 0) return 2.5; // neutral if nothing completed anywhere

  const domainShare = activity.completed_count / totalCompleted;
  const expectedShare = 1 / config.domains.length;

  // If domain has less than expected share, it's being neglected
  if (domainShare < expectedShare) {
    const neglectRatio = 1 - (domainShare / expectedShare);
    return Math.min(5, neglectRatio * 5);
  }

  return 0;
}

// ---------------------------------------------------------------------------
// Score computation
// ---------------------------------------------------------------------------

export function computeScore(item: ScoredItem, domainActivities: DomainActivity[]): number {
  const config = getConfig();
  const weights = config.scoring;

  // Deadline proximity (0-10)
  let deadlineScore: number;
  if (item.due_date) {
    const daysLeft = daysUntilDue(item.due_date);
    if (daysLeft < 0) {
      deadlineScore = 10; // overdue
    } else {
      deadlineScore = Math.min(10, Math.max(0, 10 - (daysLeft * 1.5)));
    }
  } else {
    deadlineScore = item.urgency_score;
  }

  // Consequence of inaction (0-10)
  const consequenceScore = item.importance_score;

  // Effort boost (0-10, inverted — quick tasks get a boost)
  const effortEstimate = getEffortEstimate(item);
  const effortBoost = Math.max(0, 10 - effortEstimate);

  // Domain neglect bonus (0-5)
  const domainNeglect = computeDomainNeglect(item.domain, domainActivities);

  // Staleness boost (+1 per week open, max +3)
  const daysOpen = daysSince(item.created_at);
  const stalenessBoost = Math.min(3, daysOpen / 7);

  // Composite
  const raw =
    (deadlineScore * weights.deadline_weight) +
    (consequenceScore * weights.consequence_weight) +
    (effortBoost * weights.effort_weight) +
    (domainNeglect * weights.domain_neglect_weight) +
    (stalenessBoost * weights.staleness_weight);

  // Store breakdown for transparency
  item.scoring_breakdown = {
    deadline: deadlineScore,
    consequence: consequenceScore,
    effort_boost: effortBoost,
    domain_neglect: domainNeglect,
    staleness: stalenessBoost,
    raw,
  };

  return Math.round(raw * 100) / 100;
}

// ---------------------------------------------------------------------------
// Top-5 Priority List (with domain balance constraint)
// ---------------------------------------------------------------------------

export function getTop5(): ScoredItem[] {
  const db = getDb();
  const config = getConfig();
  const now = new Date().toISOString();

  // Get all open items (including snoozed where snooze has passed)
  const rows = db.prepare(`
    SELECT * FROM items
    WHERE (status = 'open' OR (status = 'snoozed' AND snoozed_until <= ?))
    ORDER BY composite_score DESC
  `).all(now) as ScoredItem[];

  const domainActivities = getDomainActivity();

  // Compute and update scores
  for (const item of rows) {
    const score = computeScore(item, domainActivities);
    item.composite_score = score;

    // Update in database
    db.prepare("UPDATE items SET composite_score = ? WHERE id = ?").run(score, item.id);
  }

  // Sort by composite score descending
  rows.sort((a, b) => b.composite_score - a.composite_score);

  // Apply domain balance constraint
  const maxPerDomain = config.scoring.max_same_domain_in_top5;
  const selected: ScoredItem[] = [];
  const domainCounts: Record<string, number> = {};
  const skipped: ScoredItem[] = [];

  for (const item of rows) {
    if (selected.length >= 5) break;

    const count = domainCounts[item.domain] || 0;
    if (count < maxPerDomain) {
      domainCounts[item.domain] = count + 1;
      selected.push(item);
    } else {
      skipped.push(item);
    }
  }

  // If we don't have 5 yet, fill from least-represented domains
  if (selected.length < 5) {
    const representedDomains = new Set(selected.map(i => i.domain));
    const allDomains = config.domains.map(d => d.id);
    const unrepresented = allDomains.filter(d => !representedDomains.has(d));

    // Pull from skipped items, preferring unrepresented domains
    for (const item of skipped) {
      if (selected.length >= 5) break;
      if (unrepresented.includes(item.domain)) {
        selected.push(item);
      }
    }

    // Still not 5? Add any remaining skipped
    for (const item of skipped) {
      if (selected.length >= 5) break;
      if (!selected.includes(item)) {
        selected.push(item);
      }
    }
  }

  // Add rank reasons
  for (const item of selected) {
    const b = item.scoring_breakdown;
    if (!b) continue;

    const reasons: string[] = [];
    if (b.deadline >= 7) reasons.push("deadline approaching");
    else if (b.deadline >= 10) reasons.push("overdue");
    if (b.consequence >= 7) reasons.push("high consequences");
    if (b.domain_neglect >= 3) reasons.push(`${item.domain} domain needs attention`);
    if (b.staleness >= 2) reasons.push("been open a while");
    if (b.effort_boost >= 7) reasons.push("quick win");

    item.rank_reason = reasons.length > 0 ? reasons.join(", ") : "balanced priority";
  }

  return selected;
}

// ---------------------------------------------------------------------------
// Domain Health Scores
// ---------------------------------------------------------------------------

export function getDomainHealth(): DomainHealth[] {
  const db = getDb();
  const config = getConfig();
  const now = new Date().toISOString();
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const results: DomainHealth[] = [];

  for (const domain of config.domains) {
    const overdue = db.prepare(
      `SELECT COUNT(*) as cnt FROM items WHERE domain = ? AND status = 'open' AND due_date < ? AND due_date IS NOT NULL`
    ).get(domain.id, now) as { cnt: number };

    const open = db.prepare(
      `SELECT COUNT(*) as cnt FROM items WHERE domain = ? AND status = 'open'`
    ).get(domain.id) as { cnt: number };

    const completed = db.prepare(
      `SELECT COUNT(*) as cnt FROM activity_log WHERE domain = ? AND action = 'completed' AND timestamp >= ?`
    ).get(domain.id, weekAgo) as { cnt: number };

    const lastActivity = db.prepare(
      `SELECT timestamp FROM activity_log WHERE domain = ? ORDER BY timestamp DESC LIMIT 1`
    ).get(domain.id) as { timestamp: string } | undefined;

    const daysSinceActivity = lastActivity
      ? daysSince(lastActivity.timestamp)
      : 30; // default to 30 if no activity

    // Compute health score (0-1)
    let score = 1.0;

    // Penalty for overdue items
    if (open.cnt > 0) {
      const overdueRatio = overdue.cnt / open.cnt;
      score -= overdueRatio * 0.4;
    }

    // Penalty for inactivity
    if (daysSinceActivity > 7) {
      score -= Math.min(0.3, (daysSinceActivity - 7) / 30 * 0.3);
    }

    // Bonus for completing items
    if (completed.cnt > 0) {
      score = Math.min(1, score + completed.cnt * 0.05);
    }

    // Penalty for too many open items
    if (open.cnt > 10) {
      score -= Math.min(0.2, (open.cnt - 10) / 20 * 0.2);
    }

    score = Math.max(0, Math.min(1, Math.round(score * 100) / 100));

    results.push({
      domain: domain.id,
      score,
      overdue_count: overdue.cnt,
      open_count: open.cnt,
      completed_7d: completed.cnt,
      days_since_activity: Math.round(daysSinceActivity),
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Hyper-focus Detection
// ---------------------------------------------------------------------------

export function detectHyperFocus(): HyperFocusAlert {
  const db = getDb();
  const config = getConfig();
  const lookbackHours = config.scoring.hyper_focus_lookback_days * 24;
  const cutoff = new Date(Date.now() - lookbackHours * 3600000).toISOString();
  const threshold = config.scoring.hyper_focus_threshold_percent;

  const completedByDomain = db.prepare(`
    SELECT domain, COUNT(*) as cnt
    FROM activity_log
    WHERE action = 'completed' AND timestamp >= ?
    GROUP BY domain
    ORDER BY cnt DESC
  `).all(cutoff) as { domain: string; cnt: number }[];

  const totalCompleted = completedByDomain.reduce((sum, r) => sum + r.cnt, 0);

  if (totalCompleted < 3) {
    return { detected: false, focused_domain: null, focused_percent: 0, neglected_domain: null };
  }

  const top = completedByDomain[0];
  const topPercent = (top.cnt / totalCompleted) * 100;

  if (topPercent >= threshold) {
    // Find most neglected domain
    const allDomains = config.domains.map(d => d.id);
    const activeDomains = new Set(completedByDomain.map(r => r.domain));
    const neglected = allDomains.find(d => !activeDomains.has(d)) ||
      completedByDomain[completedByDomain.length - 1]?.domain ||
      allDomains[0];

    return {
      detected: true,
      focused_domain: top.domain,
      focused_percent: Math.round(topPercent),
      neglected_domain: neglected,
    };
  }

  return { detected: false, focused_domain: null, focused_percent: 0, neglected_domain: null };
}

// ---------------------------------------------------------------------------
// Run scoring (called by cron or API)
// ---------------------------------------------------------------------------

export function runScoring(): {
  top5: ScoredItem[];
  domainHealth: DomainHealth[];
  hyperFocus: HyperFocusAlert;
} {
  const top5 = getTop5();
  const domainHealth = getDomainHealth();
  const hyperFocus = detectHyperFocus();

  // If hyper-focus detected, force-boost neglected domain's top item to #1
  if (hyperFocus.detected && hyperFocus.neglected_domain) {
    const neglectedItem = top5.find(i => i.domain === hyperFocus.neglected_domain);
    if (neglectedItem) {
      const idx = top5.indexOf(neglectedItem);
      if (idx > 0) {
        top5.splice(idx, 1);
        top5.unshift(neglectedItem);
        neglectedItem.rank_reason = `force-boosted: ${hyperFocus.focused_domain} hyper-focus detected`;
      }
    }
  }

  return { top5, domainHealth, hyperFocus };
}
