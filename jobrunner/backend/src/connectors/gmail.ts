/**
 * Gmail Connector — OAuth 2.0, metadata-only pull.
 *
 * CRITICAL PRIVACY RULE: NEVER extract or store email bodies.
 * Only pulls: message ID, thread ID, from address, from name, subject line,
 * date, labels, has_attachment flag, is_read flag, snippet.
 */

import { getConfig, loadSenderRules } from "../config/loader.js";
import { getDb } from "../db.js";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TOKEN_PATH = path.resolve(__dirname, "../../../../data/tokens/gmail.json");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GmailMessage {
  id: string;
  threadId: string;
  from: string;
  fromName: string;
  subject: string;
  date: string;
  labels: string[];
  hasAttachment: boolean;
  isRead: boolean;
  snippet: string;
}

// ---------------------------------------------------------------------------
// OAuth token management
// ---------------------------------------------------------------------------

function getTokens(): { access_token: string; refresh_token: string } | null {
  try {
    if (!fs.existsSync(TOKEN_PATH)) return null;
    const data = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8"));
    return data;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Email domain classification (deterministic, NO LLM)
// ---------------------------------------------------------------------------

function classifyEmail(from: string, subject: string, isRead: boolean, date: string): {
  domain: string;
  urgencyBoost: number;
} {
  const senderRules = loadSenderRules();
  const fromLower = from.toLowerCase();
  const subjectLower = subject.toLowerCase();

  // Check sender rules
  for (const [pattern, domain] of Object.entries(senderRules)) {
    if (pattern.startsWith("*.")) {
      // Wildcard domain match
      const suffix = pattern.substring(1); // ".edu"
      if (fromLower.includes(suffix)) {
        return { domain, urgencyBoost: 0 };
      }
    } else if (fromLower.includes(pattern.toLowerCase())) {
      return { domain, urgencyBoost: 0 };
    }
  }

  // Subject keyword classification
  const householdKeywords = ["invoice", "bill", "payment", "utility", "insurance", "mortgage", "rent"];
  const urgentKeywords = ["deadline", "due", "urgent", "asap", "immediately", "action required"];
  const kidsKeywords = ["school", "student", "parent", "teacher", "class", "homework", "grade"];

  let domain = "email";
  let urgencyBoost = 0;

  for (const kw of householdKeywords) {
    if (subjectLower.includes(kw)) { domain = "household"; break; }
  }
  for (const kw of kidsKeywords) {
    if (subjectLower.includes(kw)) { domain = "kids"; break; }
  }
  for (const kw of urgentKeywords) {
    if (subjectLower.includes(kw)) { urgencyBoost += 2; break; }
  }

  // Unread + older than 48h = urgency boost
  if (!isRead) {
    const emailDate = new Date(date).getTime();
    const hoursSinceEmail = (Date.now() - emailDate) / (1000 * 60 * 60);
    if (hoursSinceEmail > 48) {
      urgencyBoost += 2;
    }
  }

  return { domain, urgencyBoost };
}

// ---------------------------------------------------------------------------
// Gmail API fetch (real API)
// ---------------------------------------------------------------------------

async function fetchGmailMessages(): Promise<GmailMessage[]> {
  const config = getConfig();
  if (!config.gmail.enabled) return [];

  const tokens = getTokens();
  if (!tokens) {
    console.log("[gmail] No OAuth tokens found. Please connect Gmail in settings.");
    return [];
  }

  try {
    // CRITICAL: Only request metadata, headers, and snippet — NEVER the body
    const response = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=50&q=is:inbox",
      {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      }
    );

    if (!response.ok) {
      console.error(`[gmail] API error: ${response.status}`);
      return [];
    }

    const data = await response.json() as { messages?: { id: string }[] };
    if (!data.messages) return [];

    const messages: GmailMessage[] = [];
    for (const msg of data.messages.slice(0, 50)) {
      // CRITICAL: format=metadata ensures NO email body is fetched
      const msgResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
        {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
          },
        }
      );

      if (!msgResponse.ok) continue;

      const msgData = await msgResponse.json() as {
        id: string;
        threadId: string;
        labelIds?: string[];
        snippet?: string;
        payload?: {
          headers?: { name: string; value: string }[];
          parts?: { filename?: string }[];
        };
      };

      const headers = msgData.payload?.headers || [];
      const fromHeader = headers.find(h => h.name === "From")?.value || "";
      const subject = headers.find(h => h.name === "Subject")?.value || "";
      const dateHeader = headers.find(h => h.name === "Date")?.value || "";

      // Parse from name and address
      const fromMatch = fromHeader.match(/^"?([^"<]*)"?\s*<?([^>]*)>?$/);
      const fromName = fromMatch?.[1]?.trim() || fromHeader;
      const fromAddress = fromMatch?.[2]?.trim() || fromHeader;

      messages.push({
        id: msgData.id,
        threadId: msgData.threadId,
        from: fromAddress,
        fromName,
        subject,
        date: dateHeader,
        labels: msgData.labelIds || [],
        hasAttachment: !!(msgData.payload?.parts?.some(p => p.filename)),
        isRead: !(msgData.labelIds || []).includes("UNREAD"),
        snippet: msgData.snippet || "",
      });
    }

    return messages;
  } catch (err) {
    console.error("[gmail] Failed to fetch messages:", err instanceof Error ? err.message : String(err));
    return [];
  }
}

// ---------------------------------------------------------------------------
// Mock Gmail data for demo mode
// ---------------------------------------------------------------------------

function getMockGmailMessages(): GmailMessage[] {
  return [
    {
      id: "gmail-001", threadId: "thread-001", from: "frontdesk@smiledental.com",
      fromName: "Smile Dental", subject: "Appointment Confirmation Needed",
      date: new Date(Date.now() - 24 * 3600000).toISOString(),
      labels: ["INBOX", "UNREAD"], hasAttachment: false, isRead: false,
      snippet: "Please confirm your appointment for February 20th at 2pm...",
    },
    {
      id: "gmail-002", threadId: "thread-002", from: "teacher@schooldistrict.edu",
      fromName: "Mrs. Johnson", subject: "Jake's Science Fair Project",
      date: new Date(Date.now() - 48 * 3600000).toISOString(),
      labels: ["INBOX", "UNREAD"], hasAttachment: false, isRead: false,
      snippet: "Just a reminder that science fair projects are due next Friday...",
    },
    {
      id: "gmail-003", threadId: "thread-003", from: "billing@xfinity.com",
      fromName: "Xfinity", subject: "Your January Statement is Ready",
      date: new Date(Date.now() - 72 * 3600000).toISOString(),
      labels: ["INBOX", "UNREAD"], hasAttachment: true, isRead: false,
      snippet: "Your statement of $142.50 is now available...",
    },
    {
      id: "gmail-004", threadId: "thread-004", from: "notifications@github.com",
      fromName: "GitHub", subject: "[myrepo] PR #47: Fix auth middleware",
      date: new Date(Date.now() - 12 * 3600000).toISOString(),
      labels: ["INBOX", "UNREAD"], hasAttachment: false, isRead: false,
      snippet: "New review requested on your pull request...",
    },
    {
      id: "gmail-005", threadId: "thread-005", from: "manager@yourcompany.com",
      fromName: "Alex Kim", subject: "Re: Q1 Goals Alignment",
      date: new Date(Date.now() - 6 * 3600000).toISOString(),
      labels: ["INBOX"], hasAttachment: false, isRead: true,
      snippet: "Thanks for the update. Let's discuss in our 1:1...",
    },
  ];
}

// ---------------------------------------------------------------------------
// Process & upsert
// ---------------------------------------------------------------------------

export async function runGmailSync(): Promise<{ synced: number; errors: string[] }> {
  const config = getConfig();
  const db = getDb();
  const errors: string[] = [];

  let messages: GmailMessage[];

  if (config.gmail.enabled) {
    messages = await fetchGmailMessages();
    if (messages.length === 0) {
      errors.push("No messages fetched — Gmail API may be down or tokens expired");
    }
  } else {
    // Demo mode: use mock data
    messages = getMockGmailMessages();
  }

  let synced = 0;
  const now = new Date().toISOString();

  for (const msg of messages) {
    // Dedup by thread_id
    const existing = db.prepare(
      "SELECT id FROM items WHERE source = 'gmail' AND thread_id = ?"
    ).get(msg.threadId);

    if (existing) continue;

    const { domain, urgencyBoost } = classifyEmail(msg.from, msg.subject, msg.isRead, msg.date);
    const baseUrgency = msg.isRead ? 3 : 5;

    const itemId = uuidv4();
    db.prepare(`
      INSERT INTO items (id, domain, source, title, raw_text, structured_data, urgency_score, importance_score, composite_score, status, created_at, updated_at, thread_id)
      VALUES (?, ?, 'gmail', ?, NULL, ?, ?, ?, 0, 'open', ?, ?, ?)
    `).run(
      itemId,
      domain,
      msg.subject || "(no subject)",
      JSON.stringify({
        from: msg.from,
        from_name: msg.fromName,
        snippet: msg.snippet,
        has_attachment: msg.hasAttachment,
        is_read: msg.isRead,
        labels: msg.labels,
        gmail_id: msg.id,
      }),
      Math.min(10, baseUrgency + urgencyBoost),
      5, // default importance
      now,
      now,
      msg.threadId
    );

    db.prepare(`
      INSERT INTO activity_log (timestamp, domain, action, item_id, metadata)
      VALUES (?, ?, 'created', ?, ?)
    `).run(now, domain, itemId, JSON.stringify({ source: "gmail" }));

    synced++;
  }

  return { synced, errors };
}
