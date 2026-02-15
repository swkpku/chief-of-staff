/**
 * Mock Slack tool - simulates Slack API interactions for demo purposes.
 */

export interface MockMessage {
  id: string;
  channel: string;
  author: string;
  text: string;
  timestamp: string;
  is_bot: boolean;
  is_mention: boolean;
  is_dm: boolean;
  thread_ts?: string;
}

export interface MockThread {
  thread_ts: string;
  channel: string;
  subject: string;
  messages: { author: string; text: string; timestamp: string }[];
  needs_reply: boolean;
  reason: string;
}

const MOCK_MESSAGES: MockMessage[] = [
  {
    id: "slack-001",
    channel: "#engineering",
    author: "sarah.chen",
    text: "Deployed v2.4.1 to staging. All smoke tests passing. Will push to prod after standup.",
    timestamp: new Date(Date.now() - 28800000).toISOString(),
    is_bot: false,
    is_mention: false,
    is_dm: false,
  },
  {
    id: "slack-002",
    channel: "#engineering",
    author: "mike.johnson",
    text: "Found a race condition in the payment queue. Working on a fix — PR incoming.",
    timestamp: new Date(Date.now() - 25200000).toISOString(),
    is_bot: false,
    is_mention: false,
    is_dm: false,
  },
  {
    id: "slack-003",
    channel: "#incidents",
    author: "pagerduty-bot",
    text: "[RESOLVED] API latency spike on us-east-1. Root cause: connection pool exhaustion. Mitigation deployed.",
    timestamp: new Date(Date.now() - 21600000).toISOString(),
    is_bot: true,
    is_mention: false,
    is_dm: false,
  },
  {
    id: "slack-004",
    channel: "#team-standup",
    author: "lisa.park",
    text: "Yesterday: finished design specs for settings page. Today: starting on mobile nav. Blockers: none.",
    timestamp: new Date(Date.now() - 18000000).toISOString(),
    is_bot: false,
    is_mention: false,
    is_dm: false,
  },
  {
    id: "slack-005",
    channel: "#team-standup",
    author: "mike.johnson",
    text: "Yesterday: code review + payment queue debugging. Today: shipping the fix. Blockers: need sarah to review PR #158.",
    timestamp: new Date(Date.now() - 17400000).toISOString(),
    is_bot: false,
    is_mention: false,
    is_dm: false,
  },
  {
    id: "slack-006",
    channel: "#general",
    author: "hr-bot",
    text: "Reminder: company all-hands this Friday at 3 PM. Agenda: Q1 results and Q2 planning.",
    timestamp: new Date(Date.now() - 14400000).toISOString(),
    is_bot: true,
    is_mention: false,
    is_dm: false,
  },
  {
    id: "slack-007",
    channel: "#engineering",
    author: "sarah.chen",
    text: "@wayne heads up — the CI pipeline config changed. You may need to rebase your branch.",
    timestamp: new Date(Date.now() - 10800000).toISOString(),
    is_bot: false,
    is_mention: true,
    is_dm: false,
  },
  {
    id: "slack-008",
    channel: "DM",
    author: "lisa.park",
    text: "Hey, do you have time for a quick sync on the dashboard redesign today? I have a few questions about the card layout.",
    timestamp: new Date(Date.now() - 7200000).toISOString(),
    is_bot: false,
    is_mention: false,
    is_dm: true,
  },
  {
    id: "slack-009",
    channel: "#incidents",
    author: "datadog-bot",
    text: "[ALERT] Error rate on /api/checkout above threshold (>1%). Investigating.",
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    is_bot: true,
    is_mention: false,
    is_dm: false,
  },
  {
    id: "slack-010",
    channel: "#engineering",
    author: "mike.johnson",
    text: "PR #158 is up for the payment queue fix. @wayne @sarah.chen would appreciate a review when you get a chance.",
    timestamp: new Date(Date.now() - 1800000).toISOString(),
    is_bot: false,
    is_mention: true,
    is_dm: false,
  },
];

const MOCK_THREADS: MockThread[] = [
  {
    thread_ts: "1707900000.000100",
    channel: "#engineering",
    subject: "PR #158 — payment queue race condition fix",
    messages: [
      {
        author: "mike.johnson",
        text: "PR #158 is up for the payment queue fix. @wayne @sarah.chen would appreciate a review when you get a chance.",
        timestamp: new Date(Date.now() - 1800000).toISOString(),
      },
      {
        author: "sarah.chen",
        text: "Looking at it now. The mutex approach looks solid but I'm wondering if we should also add a retry with backoff on the consumer side?",
        timestamp: new Date(Date.now() - 1500000).toISOString(),
      },
      {
        author: "mike.johnson",
        text: "Good call. I can add that. @wayne what do you think — retry with exponential backoff or fixed interval?",
        timestamp: new Date(Date.now() - 1200000).toISOString(),
      },
    ],
    needs_reply: true,
    reason: "Mike asked you a direct question about retry strategy for the payment queue fix.",
  },
  {
    thread_ts: "1707890000.000200",
    channel: "#engineering",
    subject: "CI pipeline config change",
    messages: [
      {
        author: "sarah.chen",
        text: "@wayne heads up — the CI pipeline config changed. You may need to rebase your branch.",
        timestamp: new Date(Date.now() - 10800000).toISOString(),
      },
      {
        author: "sarah.chen",
        text: "Specifically the node version bumped to 20 and the test stage now runs in parallel. Let me know if you hit any issues.",
        timestamp: new Date(Date.now() - 10200000).toISOString(),
      },
    ],
    needs_reply: true,
    reason: "Sarah gave you a heads-up about CI changes affecting your branch. An acknowledgment or status update would be helpful.",
  },
  {
    thread_ts: "1707880000.000300",
    channel: "#incidents",
    subject: "Checkout error rate spike",
    messages: [
      {
        author: "datadog-bot",
        text: "[ALERT] Error rate on /api/checkout above threshold (>1%). Investigating.",
        timestamp: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        author: "sarah.chen",
        text: "I see a spike in 502s from the payment service. Could be related to Mike's race condition. Mike are you seeing this?",
        timestamp: new Date(Date.now() - 3300000).toISOString(),
      },
      {
        author: "mike.johnson",
        text: "Yes — this is exactly the bug PR #158 fixes. The race condition causes dropped connections under load. My fix should resolve it once merged.",
        timestamp: new Date(Date.now() - 3000000).toISOString(),
      },
      {
        author: "sarah.chen",
        text: "@wayne can we fast-track the review on #158? This is actively impacting checkout.",
        timestamp: new Date(Date.now() - 2700000).toISOString(),
      },
    ],
    needs_reply: true,
    reason: "Sarah is asking you to fast-track the PR #158 review due to active checkout impact.",
  },
  {
    thread_ts: "1707870000.000400",
    channel: "#general",
    subject: "Q1 all-hands agenda",
    messages: [
      {
        author: "hr-bot",
        text: "Reminder: company all-hands this Friday at 3 PM. Agenda: Q1 results and Q2 planning.",
        timestamp: new Date(Date.now() - 14400000).toISOString(),
      },
      {
        author: "lisa.park",
        text: "Will there be time for team demos? I'd love to show the new dashboard.",
        timestamp: new Date(Date.now() - 13800000).toISOString(),
      },
      {
        author: "sarah.chen",
        text: "Great idea! Engineering could do a 5-min slot on the CI improvements too.",
        timestamp: new Date(Date.now() - 13200000).toISOString(),
      },
    ],
    needs_reply: false,
    reason: "",
  },
];

export const slackFunctions: Record<string, (args: Record<string, unknown>) => unknown> = {
  list_channels: (_args: Record<string, unknown>) => {
    const channels = Array.from(new Set(MOCK_MESSAGES.filter(m => !m.is_dm).map(m => m.channel)));
    return {
      channels,
      total: channels.length,
    };
  },

  read_channel: (args: Record<string, unknown>) => {
    const channel = args.channel as string;
    const messages = MOCK_MESSAGES.filter(m => m.channel === channel);
    return {
      channel,
      messages,
      total: messages.length,
    };
  },

  read_dms: (_args: Record<string, unknown>) => {
    const dms = MOCK_MESSAGES.filter(m => m.is_dm);
    return {
      messages: dms,
      total: dms.length,
    };
  },

  read_mentions: (_args: Record<string, unknown>) => {
    const mentions = MOCK_MESSAGES.filter(m => m.is_mention);
    return {
      messages: mentions,
      total: mentions.length,
    };
  },

  draft_message: (args: Record<string, unknown>) => {
    const channel = args.channel as string;
    const text = args.text as string;
    return {
      success: true,
      draft_id: `draft-${Date.now()}`,
      status: "pending-approval",
      message: `Draft message created for ${channel}`,
      text_preview: text?.substring(0, 150) || "",
    };
  },

  summarize_unread: (_args: Record<string, unknown>) => {
    const nonBot = MOCK_MESSAGES.filter(m => !m.is_bot);
    const mentions = MOCK_MESSAGES.filter(m => m.is_mention);
    const dms = MOCK_MESSAGES.filter(m => m.is_dm);
    const actionableThreads = MOCK_THREADS.filter(t => t.needs_reply);
    return {
      total_messages: MOCK_MESSAGES.length,
      human_messages: nonBot.length,
      mentions: mentions.length,
      unread_dms: dms.length,
      threads_needing_reply: actionableThreads.length,
      summary: "Overnight: 2 engineering updates (deploy + payment fix), 1 resolved incident, 2 standup posts. You have 2 @mentions (CI rebase + PR review), 1 unread DM from Lisa about dashboard sync, and 3 threads awaiting your reply.",
    };
  },

  get_threads_needing_reply: (_args: Record<string, unknown>) => {
    const actionable = MOCK_THREADS.filter(t => t.needs_reply);
    return {
      threads: actionable.map(t => ({
        thread_ts: t.thread_ts,
        channel: t.channel,
        subject: t.subject,
        message_count: t.messages.length,
        last_message: t.messages[t.messages.length - 1],
        reason: t.reason,
      })),
      total: actionable.length,
    };
  },

  read_thread: (args: Record<string, unknown>) => {
    const threadTs = args.thread_ts as string;
    const thread = MOCK_THREADS.find(t => t.thread_ts === threadTs);
    if (!thread) {
      return { error: `Thread ${threadTs} not found`, messages: [], total: 0 };
    }
    return {
      thread_ts: thread.thread_ts,
      channel: thread.channel,
      subject: thread.subject,
      messages: thread.messages,
      total: thread.messages.length,
      needs_reply: thread.needs_reply,
      reason: thread.reason,
    };
  },

  draft_thread_reply: (args: Record<string, unknown>) => {
    const threadTs = args.thread_ts as string;
    const channel = args.channel as string;
    const text = args.text as string;
    const thread = MOCK_THREADS.find(t => t.thread_ts === threadTs);
    return {
      success: true,
      draft_id: `draft-reply-${Date.now()}`,
      status: "pending-approval",
      channel,
      thread_ts: threadTs,
      thread_subject: thread?.subject || "Unknown thread",
      message: `Draft reply created for thread in ${channel}`,
      text_preview: text?.substring(0, 150) || "",
    };
  },
};

export const slackToolDefinitions = [
  {
    name: "slack_list_channels",
    description: "List all Slack channels the bot has access to.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "slack_read_channel",
    description: "Read recent messages from a specific Slack channel.",
    input_schema: {
      type: "object" as const,
      properties: {
        channel: {
          type: "string",
          description: "The channel name to read (e.g., '#engineering')",
        },
        limit: {
          type: "number",
          description: "Maximum number of messages to return (default 20)",
        },
      },
      required: ["channel"],
    },
  },
  {
    name: "slack_read_dms",
    description: "Read unread direct messages sent to the user.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of DMs to return (default 10)",
        },
      },
      required: [],
    },
  },
  {
    name: "slack_read_mentions",
    description: "Read messages where the user was @mentioned.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of mentions to return (default 10)",
        },
      },
      required: [],
    },
  },
  {
    name: "slack_draft_message",
    description: "Draft a message to post in a Slack channel. The message will NOT be sent automatically - it requires human approval first.",
    input_schema: {
      type: "object" as const,
      properties: {
        channel: {
          type: "string",
          description: "The channel to post to (e.g., '#team-standup')",
        },
        text: {
          type: "string",
          description: "The message text to post",
        },
        thread_ts: {
          type: "string",
          description: "Optional thread timestamp to reply in a thread",
        },
      },
      required: ["channel", "text"],
    },
  },
  {
    name: "slack_summarize_unread",
    description: "Get a summary of all unread activity across channels, DMs, and mentions, including threads awaiting your reply.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "slack_get_threads_needing_reply",
    description: "List threads where you should participate — threads where someone asked you a question, requested your input, or where your reply is expected.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "slack_read_thread",
    description: "Read the full conversation history of a specific thread.",
    input_schema: {
      type: "object" as const,
      properties: {
        thread_ts: {
          type: "string",
          description: "The thread timestamp identifier",
        },
      },
      required: ["thread_ts"],
    },
  },
  {
    name: "slack_draft_thread_reply",
    description: "Draft a reply to a specific thread. The reply will NOT be sent automatically - it requires human approval first.",
    input_schema: {
      type: "object" as const,
      properties: {
        channel: {
          type: "string",
          description: "The channel the thread is in (e.g., '#engineering')",
        },
        thread_ts: {
          type: "string",
          description: "The thread timestamp to reply to",
        },
        text: {
          type: "string",
          description: "The reply text to post in the thread",
        },
      },
      required: ["channel", "thread_ts", "text"],
    },
  },
];
