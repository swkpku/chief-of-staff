/**
 * Mock Gmail tool - simulates Gmail API interactions for demo purposes.
 */

export interface MockEmail {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
  is_read: boolean;
  labels: string[];
}

const MOCK_EMAILS: MockEmail[] = [
  {
    id: "msg-001",
    from: "deals@shopdeals.com",
    subject: "Flash Sale: 70% Off Everything!",
    snippet: "Don't miss our biggest sale of the year. Shop now and save big on...",
    date: new Date(Date.now() - 3600000).toISOString(),
    is_read: false,
    labels: ["INBOX", "CATEGORY_PROMOTIONS"],
  },
  {
    id: "msg-002",
    from: "sarah.chen@company.com",
    subject: "Re: Sprint Planning - Thursday 10am",
    snippet: "Hey, can you confirm you'll be at sprint planning? I need your input on the backlog...",
    date: new Date(Date.now() - 7200000).toISOString(),
    is_read: false,
    labels: ["INBOX", "IMPORTANT"],
  },
  {
    id: "msg-003",
    from: "noreply@github.com",
    subject: "[chief-of-staff] PR #142: Update payment flow",
    snippet: "mike-johnson requested your review on PR #142. Changes include updates to the billing...",
    date: new Date(Date.now() - 10800000).toISOString(),
    is_read: false,
    labels: ["INBOX"],
  },
  {
    id: "msg-004",
    from: "security-alert@g00gle.com",
    subject: "URGENT: Your account has been compromised",
    snippet: "Dear user, we have detected unusual activity on your account. Click here immediately to...",
    date: new Date(Date.now() - 14400000).toISOString(),
    is_read: false,
    labels: ["INBOX"],
  },
  {
    id: "msg-005",
    from: "mike.johnson@company.com",
    subject: "Q1 Roadmap Update",
    snippet: "Hi team, I've updated the Q1 roadmap with the latest priorities. Key changes include...",
    date: new Date(Date.now() - 18000000).toISOString(),
    is_read: false,
    labels: ["INBOX", "IMPORTANT"],
  },
  {
    id: "msg-006",
    from: "newsletter@techcrunch.com",
    subject: "TechCrunch Daily: AI Startup Raises $500M",
    snippet: "Today's top stories: AI startup secures record funding, Apple announces new developer tools...",
    date: new Date(Date.now() - 21600000).toISOString(),
    is_read: false,
    labels: ["INBOX", "CATEGORY_UPDATES"],
  },
  {
    id: "msg-007",
    from: "lisa.park@company.com",
    subject: "Design Review Feedback",
    snippet: "Great work on the dashboard mockups! A few suggestions: the nav spacing could be tighter...",
    date: new Date(Date.now() - 25200000).toISOString(),
    is_read: false,
    labels: ["INBOX", "IMPORTANT"],
  },
  {
    id: "msg-008",
    from: "prince-offer@mail.ng",
    subject: "You Have Won $5,000,000 - Claim Now",
    snippet: "Congratulations! You have been selected as the winner of our international lottery...",
    date: new Date(Date.now() - 28800000).toISOString(),
    is_read: false,
    labels: ["INBOX"],
  },
  {
    id: "msg-009",
    from: "updates@figma.com",
    subject: "What's new in Figma - February 2026",
    snippet: "Discover the latest features: improved auto-layout, new plugin API, and faster prototyping...",
    date: new Date(Date.now() - 32400000).toISOString(),
    is_read: false,
    labels: ["INBOX", "CATEGORY_UPDATES"],
  },
  {
    id: "msg-010",
    from: "admin@paypa1-security.com",
    subject: "Action Required: Verify Your PayPal Account",
    snippet: "We've noticed suspicious login attempts. Please verify your identity by clicking...",
    date: new Date(Date.now() - 36000000).toISOString(),
    is_read: false,
    labels: ["INBOX"],
  },
];

export const gmailFunctions: Record<string, (args: Record<string, unknown>) => unknown> = {
  list_emails: (_args: Record<string, unknown>) => {
    return {
      emails: MOCK_EMAILS,
      total: MOCK_EMAILS.length,
      unread: MOCK_EMAILS.filter((e) => !e.is_read).length,
    };
  },

  archive_email: (args: Record<string, unknown>) => {
    const id = args.id as string;
    const email = MOCK_EMAILS.find((e) => e.id === id);
    return {
      success: true,
      message: email
        ? `Archived email "${email.subject}" from ${email.from}`
        : `Archived email ${id}`,
    };
  },

  star_email: (args: Record<string, unknown>) => {
    const id = args.id as string;
    const email = MOCK_EMAILS.find((e) => e.id === id);
    return {
      success: true,
      message: email
        ? `Starred email "${email.subject}" from ${email.from}`
        : `Starred email ${id}`,
    };
  },

  draft_reply: (args: Record<string, unknown>) => {
    const id = args.id as string;
    const body = args.body as string;
    const email = MOCK_EMAILS.find((e) => e.id === id);
    return {
      success: true,
      draft_id: `draft-${Date.now()}`,
      status: "pending-approval",
      message: email
        ? `Draft reply created for "${email.subject}" to ${email.from}`
        : `Draft reply created for email ${id}`,
      body_preview: body?.substring(0, 100) || "",
    };
  },

  flag_email: (args: Record<string, unknown>) => {
    const id = args.id as string;
    const reason = args.reason as string;
    const email = MOCK_EMAILS.find((e) => e.id === id);
    return {
      success: true,
      message: email
        ? `Flagged email "${email.subject}" from ${email.from}: ${reason}`
        : `Flagged email ${id}: ${reason}`,
    };
  },
};

export const gmailToolDefinitions = [
  {
    name: "gmail_list_emails",
    description: "List recent emails from the inbox. Returns email id, from, subject, snippet, date, read status, and labels.",
    input_schema: {
      type: "object" as const,
      properties: {
        max_results: {
          type: "number",
          description: "Maximum number of emails to return (default 10)",
        },
        unread_only: {
          type: "boolean",
          description: "Only return unread emails (default false)",
        },
      },
      required: [],
    },
  },
  {
    name: "gmail_archive_email",
    description: "Archive an email by removing it from the inbox. The email will still be accessible in All Mail.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: {
          type: "string",
          description: "The email message ID to archive",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "gmail_star_email",
    description: "Star an email to mark it as important for later follow-up.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: {
          type: "string",
          description: "The email message ID to star",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "gmail_draft_reply",
    description: "Create a draft reply to an email. The draft will NOT be sent automatically - it requires human approval first.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: {
          type: "string",
          description: "The email message ID to reply to",
        },
        body: {
          type: "string",
          description: "The body text of the reply",
        },
      },
      required: ["id", "body"],
    },
  },
  {
    name: "gmail_flag_email",
    description: "Flag an email as suspicious or spam with a reason.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: {
          type: "string",
          description: "The email message ID to flag",
        },
        reason: {
          type: "string",
          description: "Reason for flagging (e.g., 'phishing', 'spam', 'suspicious sender')",
        },
      },
      required: ["id", "reason"],
    },
  },
];
