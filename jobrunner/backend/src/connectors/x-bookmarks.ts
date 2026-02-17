/**
 * X (Twitter) Bookmarks Connector — pull bookmarked tweets, create reminder items.
 * Read-only. NEVER posts tweets, likes, or retweets.
 */

import { getConfig } from "../config/loader.js";
import { getDb } from "../db.js";
import { v4 as uuidv4 } from "uuid";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface XBookmark {
  id: string;
  author: string;
  text: string;
  bookmarked_at: string;
  urls: string[];
}

// ---------------------------------------------------------------------------
// Real API fetch
// ---------------------------------------------------------------------------

async function fetchXBookmarks(): Promise<XBookmark[]> {
  const config = getConfig();
  if (!config.x_bookmarks.enabled) return [];

  try {
    const response = await fetch(
      "https://api.x.com/2/users/me/bookmarks?tweet.fields=created_at,author_id,entities&expansions=author_id&user.fields=username",
      {
        headers: {
          Authorization: `Bearer ${config.x_bookmarks.access_token}`,
        },
      }
    );

    if (!response.ok) {
      console.error(`[x-bookmarks] API error: ${response.status}`);
      return [];
    }

    const data = await response.json() as {
      data?: {
        id: string;
        text: string;
        created_at?: string;
        author_id?: string;
        entities?: { urls?: { expanded_url: string }[] };
      }[];
      includes?: { users?: { id: string; username: string }[] };
    };

    if (!data.data) return [];

    const usersMap = new Map<string, string>();
    for (const user of data.includes?.users || []) {
      usersMap.set(user.id, user.username);
    }

    return data.data.map(tweet => ({
      id: tweet.id,
      author: `@${usersMap.get(tweet.author_id || "") || "unknown"}`,
      text: tweet.text.substring(0, 280),
      bookmarked_at: tweet.created_at || new Date().toISOString(),
      urls: tweet.entities?.urls?.map(u => u.expanded_url) || [],
    }));
  } catch (err) {
    console.error("[x-bookmarks] Failed to fetch:", err instanceof Error ? err.message : String(err));
    return [];
  }
}

// ---------------------------------------------------------------------------
// Mock data for demo mode
// ---------------------------------------------------------------------------

function getMockXBookmarks(): XBookmark[] {
  return [
    {
      id: "tweet-001", author: "@techleader",
      text: "Thread on system design patterns that every senior engineer should know. 1/ Start with understanding your data access patterns before choosing a database...",
      bookmarked_at: new Date(Date.now() - 3 * 86400000).toISOString(),
      urls: ["https://example.com/system-design"],
    },
    {
      id: "tweet-002", author: "@productmgmt",
      text: "The best PMs I've worked with all share one trait: they can say no to good ideas. Your roadmap isn't a wishlist, it's a strategy.",
      bookmarked_at: new Date(Date.now() - 5 * 86400000).toISOString(),
      urls: [],
    },
    {
      id: "tweet-003", author: "@rustlang",
      text: "Rust 1.85 is out! New features: improved pattern matching, better error messages, and async trait support. Here's what you need to know...",
      bookmarked_at: new Date(Date.now() - 1 * 86400000).toISOString(),
      urls: ["https://blog.rust-lang.org/2026/02/release"],
    },
  ];
}

// ---------------------------------------------------------------------------
// Process & upsert
// ---------------------------------------------------------------------------

export async function runXBookmarkSync(): Promise<{ synced: number; errors: string[] }> {
  const config = getConfig();
  const db = getDb();
  const errors: string[] = [];

  let bookmarks: XBookmark[];

  if (config.x_bookmarks.enabled) {
    bookmarks = await fetchXBookmarks();
    if (bookmarks.length === 0) {
      errors.push("No bookmarks fetched — X API may be down or tokens invalid");
    }
  } else {
    bookmarks = getMockXBookmarks();
  }

  let synced = 0;
  const now = new Date().toISOString();

  for (const bk of bookmarks) {
    // Dedup by structured_data tweet_id
    const existing = db.prepare(
      `SELECT id FROM items WHERE source = 'x_bookmarks' AND structured_data LIKE ?`
    ).get(`%"tweet_id":"${bk.id}"%`);

    if (existing) continue;

    // Default to career/projects domain — could be refined with LLM later
    const domain = bk.urls.length > 0 ? "projects" : "career";

    const itemId = uuidv4();
    const dueDate = new Date(new Date(bk.bookmarked_at).getTime() + 7 * 86400000).toISOString();

    db.prepare(`
      INSERT INTO items (id, domain, source, title, raw_text, structured_data, urgency_score, importance_score, composite_score, status, created_at, updated_at, due_date)
      VALUES (?, ?, 'x_bookmarks', ?, ?, ?, 2, 4, 0, 'open', ?, ?, ?)
    `).run(
      itemId,
      domain,
      `Read: ${bk.author} — ${bk.text.substring(0, 60)}...`,
      bk.text,
      JSON.stringify({
        tweet_id: bk.id,
        tweet_author: bk.author,
        urls: bk.urls,
        effort_estimate: 2,
      }),
      now,
      now,
      dueDate
    );

    db.prepare(`
      INSERT INTO activity_log (timestamp, domain, action, item_id, metadata)
      VALUES (?, ?, 'created', ?, ?)
    `).run(now, domain, itemId, JSON.stringify({ source: "x_bookmarks" }));

    synced++;
  }

  return { synced, errors };
}
