/**
 * Job executor - takes a JobDefinition and runs it via Claude API (or demo mode).
 *
 * The executor:
 * 1. Creates an execution record
 * 2. Builds a system prompt from the job definition
 * 3. Calls Claude API with tools (or simulates in demo mode)
 * 4. Processes tool calls, checking boundaries
 * 5. Stores actions and updates execution status
 */

import Anthropic from "@anthropic-ai/sdk";
import { v4 as uuidv4 } from "uuid";
import type { JobDefinition } from "./parser.js";
import {
  createExecution,
  updateExecution,
  createAction,
  getDb,
} from "./db.js";
import { getToolsForJob, executeTool } from "./tools/index.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExecutionResult {
  executionId: string;
  status: "completed" | "failed" | "awaiting-approval";
  summary: string | null;
  error: string | null;
  actionsCount: number;
  pendingApprovals: number;
}

// ---------------------------------------------------------------------------
// Boundary checking
// ---------------------------------------------------------------------------

/**
 * Check if a tool call violates any of the job's boundaries.
 * Returns the violated boundary description, or null if no violation.
 */
function checkBoundaryViolation(
  toolName: string,
  _args: Record<string, unknown>,
  boundaries: string[]
): string | null {
  const toolLower = toolName.toLowerCase();

  for (const boundary of boundaries) {
    const boundaryLower = boundary.toLowerCase();

    // Check for "never send" + email-related tools
    if (
      boundaryLower.includes("never send") &&
      (toolLower.includes("draft_reply") || toolLower.includes("send_email"))
    ) {
      return `Boundary: ${boundary}`;
    }

    // Check for "never post" + slack message/reply tools
    if (
      boundaryLower.includes("never post") &&
      (toolLower.includes("draft_message") || toolLower.includes("draft_thread_reply"))
    ) {
      return `Boundary: ${boundary}`;
    }

    // Check for "never approve" / "without approval" + approval tools
    if (
      (boundaryLower.includes("never approve") || boundaryLower.includes("without approval")) &&
      toolLower.includes("approve")
    ) {
      return `Boundary: ${boundary}`;
    }

    // Check for "never merge" + merge tools
    if (
      boundaryLower.includes("never merge") &&
      toolLower.includes("merge")
    ) {
      return `Boundary: ${boundary}`;
    }

    // Check for "never delete" + delete tools
    if (
      boundaryLower.includes("never delete") &&
      toolLower.includes("delete")
    ) {
      return `Boundary: ${boundary}`;
    }

    // Check for "never unsubscribe" + unsubscribe tools
    if (
      boundaryLower.includes("never unsubscribe") &&
      toolLower.includes("unsubscribe")
    ) {
      return `Boundary: ${boundary}`;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// System prompt builder
// ---------------------------------------------------------------------------

function buildSystemPrompt(job: JobDefinition): string {
  let prompt = `You are an autonomous AI agent executing a scheduled job.\n\n`;
  prompt += `# Job: ${job.title}\n\n`;
  prompt += `## Goal\n${job.goal}\n\n`;

  if (job.policies.length > 0) {
    prompt += `## Policies\nFollow these policies when executing the job:\n`;
    for (const policy of job.policies) {
      prompt += `- ${policy}\n`;
    }
    prompt += "\n";
  }

  if (job.boundaries.length > 0) {
    prompt += `## Boundaries\nThese are hard limits you MUST NOT violate. If an action would violate a boundary, do NOT execute it - instead indicate you need approval.\n`;
    for (const boundary of job.boundaries) {
      prompt += `- ${boundary}\n`;
    }
    prompt += "\n";
  }

  prompt += `## Instructions\n`;
  prompt += `1. Use the available tools to accomplish the goal.\n`;
  prompt += `2. Process items methodically and take appropriate actions.\n`;
  prompt += `3. For actions that might violate boundaries, indicate that approval is needed.\n`;
  prompt += `4. After completing all actions, provide a brief summary of what was done.\n`;

  return prompt;
}

// ---------------------------------------------------------------------------
// Claude API execution
// ---------------------------------------------------------------------------

async function executeWithClaudeAPI(
  job: JobDefinition,
  executionId: string
): Promise<ExecutionResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const client = new Anthropic({ apiKey });
  const tools = getToolsForJob(job.tools);
  const systemPrompt = buildSystemPrompt(job);

  let actionsCount = 0;
  let pendingApprovals = 0;

  // Conversation messages for multi-turn tool use
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `Execute the "${job.title}" job now. Use the available tools to accomplish the goal. Process all items and report what you did.`,
    },
  ];

  const claudeTools: Anthropic.Tool[] = tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema as Anthropic.Tool.InputSchema,
  }));

  let continueLoop = true;

  while (continueLoop) {
    const response = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 4096,
      system: systemPrompt,
      tools: claudeTools,
      messages,
    });

    // Process response content blocks
    const assistantContent: Anthropic.ContentBlock[] = response.content;
    messages.push({ role: "assistant", content: assistantContent });

    // Collect tool results for the next turn
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of assistantContent) {
      if (block.type === "tool_use") {
        const toolName = block.name;
        const toolArgs = block.input as Record<string, unknown>;
        const toolUseId = block.id;

        // Check boundaries
        const violation = checkBoundaryViolation(toolName, toolArgs, job.boundaries);

        if (violation) {
          // Boundary violation - create pending approval action
          pendingApprovals++;
          actionsCount++;

          const argsDescription = Object.entries(toolArgs)
            .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
            .join(", ");

          createAction({
            id: uuidv4(),
            execution_id: executionId,
            description: `${toolName}(${argsDescription})`,
            tool: toolName,
            status: "pending-approval",
            boundary_violation: violation,
            created_at: new Date().toISOString(),
          });

          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUseId,
            content: `Action blocked: ${violation}. This action requires human approval before execution.`,
          });
        } else {
          // Execute the tool
          const result = executeTool(toolName, toolArgs);
          actionsCount++;

          // Check if the tool result itself indicates approval needed
          if (result.requiresApproval) {
            pendingApprovals++;

            const argsDescription = Object.entries(toolArgs)
              .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
              .join(", ");

            createAction({
              id: uuidv4(),
              execution_id: executionId,
              description: `${toolName}(${argsDescription})`,
              tool: toolName,
              status: "pending-approval",
              boundary_violation: "Tool requires human approval",
              result: JSON.stringify(result.data),
              created_at: new Date().toISOString(),
            });

            toolResults.push({
              type: "tool_result",
              tool_use_id: toolUseId,
              content: JSON.stringify(result.data),
            });
          } else {
            createAction({
              id: uuidv4(),
              execution_id: executionId,
              description: `${toolName}(${JSON.stringify(toolArgs)})`,
              tool: toolName,
              status: "executed",
              result: JSON.stringify(result.data),
              created_at: new Date().toISOString(),
            });

            toolResults.push({
              type: "tool_result",
              tool_use_id: toolUseId,
              content: JSON.stringify(result.data),
            });
          }
        }
      }
    }

    // If there are tool results, add them and continue the loop
    if (toolResults.length > 0) {
      messages.push({ role: "user", content: toolResults });
    }

    // Stop if the model is done (end_turn or no more tool calls)
    if (response.stop_reason === "end_turn" || toolResults.length === 0) {
      continueLoop = false;

      // Extract summary from the final text block
      let summary = "";
      for (const block of assistantContent) {
        if (block.type === "text") {
          summary += block.text;
        }
      }

      const status = pendingApprovals > 0 ? "awaiting-approval" : "completed";

      updateExecution(executionId, {
        completed_at: new Date().toISOString(),
        status,
        summary: summary || `Processed ${actionsCount} actions.`,
      });

      // Update job last_run
      getDb()
        .prepare("UPDATE jobs SET last_run = ? WHERE id = ?")
        .run(new Date().toISOString(), job.id);

      return {
        executionId,
        status,
        summary: summary || `Processed ${actionsCount} actions.`,
        error: null,
        actionsCount,
        pendingApprovals,
      };
    }
  }

  // Should not reach here, but just in case
  return {
    executionId,
    status: "completed",
    summary: `Processed ${actionsCount} actions.`,
    error: null,
    actionsCount,
    pendingApprovals,
  };
}

// ---------------------------------------------------------------------------
// Demo mode execution (no API key needed)
// ---------------------------------------------------------------------------

async function executeInDemoMode(
  job: JobDefinition,
  executionId: string
): Promise<ExecutionResult> {
  console.log(`[executor] Running in demo mode for job: ${job.title}`);

  let actionsCount = 0;
  let pendingApprovals = 0;

  // Simulate execution based on job tools
  if (job.tools.includes("gmail")) {
    // Simulate email triage
    const emailResult = executeTool("gmail_list_emails", {});
    createAction({
      id: uuidv4(),
      execution_id: executionId,
      description: "Listed inbox emails",
      tool: "gmail_list_emails",
      status: "executed",
      result: JSON.stringify(emailResult.data),
      created_at: new Date().toISOString(),
    });
    actionsCount++;

    // Archive some marketing emails
    const marketingIds = ["msg-001", "msg-006", "msg-009"];
    for (const emailId of marketingIds) {
      const result = executeTool("gmail_archive_email", { id: emailId });
      createAction({
        id: uuidv4(),
        execution_id: executionId,
        description: `Archived marketing/newsletter email ${emailId}`,
        tool: "gmail_archive_email",
        status: "executed",
        result: JSON.stringify(result.data),
        created_at: new Date().toISOString(),
      });
      actionsCount++;
    }

    // Star important emails
    const importantIds = ["msg-002", "msg-005", "msg-007"];
    for (const emailId of importantIds) {
      const result = executeTool("gmail_star_email", { id: emailId });
      createAction({
        id: uuidv4(),
        execution_id: executionId,
        description: `Starred important email ${emailId}`,
        tool: "gmail_star_email",
        status: "executed",
        result: JSON.stringify(result.data),
        created_at: new Date().toISOString(),
      });
      actionsCount++;
    }

    // Flag suspicious emails
    const suspiciousIds = [
      { id: "msg-004", reason: "Phishing: spoofed Google domain (g00gle.com)" },
      { id: "msg-008", reason: "Spam: classic advance-fee scam" },
      { id: "msg-010", reason: "Phishing: spoofed PayPal domain (paypa1-security.com)" },
    ];
    for (const item of suspiciousIds) {
      const result = executeTool("gmail_flag_email", { id: item.id, reason: item.reason });
      createAction({
        id: uuidv4(),
        execution_id: executionId,
        description: `Flagged suspicious email ${item.id}: ${item.reason}`,
        tool: "gmail_flag_email",
        status: "executed",
        result: JSON.stringify(result.data),
        created_at: new Date().toISOString(),
      });
      actionsCount++;
    }

    // Draft a reply (boundary violation - needs approval)
    const violation = checkBoundaryViolation("gmail_draft_reply", {}, job.boundaries);
    if (violation) {
      createAction({
        id: uuidv4(),
        execution_id: executionId,
        description:
          'Draft reply to Sarah Chen (msg-002) re: Sprint Planning: "Hi Sarah, confirming attendance for Thursday\'s sprint planning. I\'ll have the backlog review ready. See you at 10am."',
        tool: "gmail_draft_reply",
        status: "pending-approval",
        boundary_violation: violation,
        created_at: new Date().toISOString(),
      });
      actionsCount++;
      pendingApprovals++;
    }
  }

  if (job.tools.includes("github")) {
    // Simulate PR review
    const prResult = executeTool("github_list_open_prs", {});
    createAction({
      id: uuidv4(),
      execution_id: executionId,
      description: "Listed open pull requests",
      tool: "github_list_open_prs",
      status: "executed",
      result: JSON.stringify(prResult.data),
      created_at: new Date().toISOString(),
    });
    actionsCount++;

    // Comment on PRs
    const prComments = [
      {
        pr: 139,
        comment:
          "Clean implementation of the UserAvatar component. Good test coverage. Suggestion: consider memoizing the image load handler to prevent unnecessary re-renders.",
      },
      {
        pr: 141,
        comment:
          "The token refresh logic is well-structured. One concern: the error handling on line 47 might silently swallow connection timeouts. Consider adding explicit timeout handling.",
      },
    ];

    for (const item of prComments) {
      const result = executeTool("github_comment_on_pr", {
        pr_number: item.pr,
        comment: item.comment,
      });
      createAction({
        id: uuidv4(),
        execution_id: executionId,
        description: `Commented on PR #${item.pr}: "${item.comment.substring(0, 80)}..."`,
        tool: "github_comment_on_pr",
        status: "executed",
        result: JSON.stringify(result.data),
        created_at: new Date().toISOString(),
      });
      actionsCount++;
    }

    // Review PR with bug finding
    const reviewResult = executeTool("github_review_pr", {
      pr_number: 142,
      comments:
        "Found potential null pointer dereference: user.billingAddress is accessed without null check on line 83 of payment-handler.ts. This will throw if a user hasn't set up billing yet.",
    });
    createAction({
      id: uuidv4(),
      execution_id: executionId,
      description:
        'Reviewed PR #142: Found potential null pointer bug in payment-handler.ts line 83',
      tool: "github_review_pr",
      status: "executed",
      result: JSON.stringify(reviewResult.data),
      created_at: new Date().toISOString(),
    });
    actionsCount++;

    // Approve PR (boundary violation)
    const violation = checkBoundaryViolation("github_approve_pr", {}, job.boundaries);
    if (violation) {
      createAction({
        id: uuidv4(),
        execution_id: executionId,
        description:
          "Approve PR #139 (Add user avatar component) - all checks passing, clean code, good tests",
        tool: "github_approve_pr",
        status: "pending-approval",
        boundary_violation: violation,
        created_at: new Date().toISOString(),
      });
      actionsCount++;
      pendingApprovals++;
    }
  }

  if (job.tools.includes("slack")) {
    // Simulate Slack catchup: read channels, find threads needing reply, draft replies

    // 1. Summarize unread
    const unreadResult = executeTool("slack_summarize_unread", {});
    createAction({
      id: uuidv4(),
      execution_id: executionId,
      description: "Summarized unread Slack activity",
      tool: "slack_summarize_unread",
      status: "executed",
      result: JSON.stringify(unreadResult.data),
      created_at: new Date().toISOString(),
    });
    actionsCount++;

    // 2. Read mentions
    const mentionsResult = executeTool("slack_read_mentions", {});
    createAction({
      id: uuidv4(),
      execution_id: executionId,
      description: "Checked @mentions",
      tool: "slack_read_mentions",
      status: "executed",
      result: JSON.stringify(mentionsResult.data),
      created_at: new Date().toISOString(),
    });
    actionsCount++;

    // 3. Read DMs
    const dmsResult = executeTool("slack_read_dms", {});
    createAction({
      id: uuidv4(),
      execution_id: executionId,
      description: "Checked direct messages",
      tool: "slack_read_dms",
      status: "executed",
      result: JSON.stringify(dmsResult.data),
      created_at: new Date().toISOString(),
    });
    actionsCount++;

    // 4. Get threads needing reply
    const threadsResult = executeTool("slack_get_threads_needing_reply", {});
    createAction({
      id: uuidv4(),
      execution_id: executionId,
      description: "Found 3 threads needing your reply",
      tool: "slack_get_threads_needing_reply",
      status: "executed",
      result: JSON.stringify(threadsResult.data),
      created_at: new Date().toISOString(),
    });
    actionsCount++;

    // 5. Read each actionable thread and draft replies
    const threadReplies = [
      {
        thread_ts: "1707900000.000100",
        channel: "#engineering",
        subject: "PR #158 — payment queue race condition fix",
        reply: "Good question. I'd go with exponential backoff — start at 100ms, cap at 5s. Fixed intervals can cause thundering herd if multiple consumers retry at the same time. Happy to review the PR once that's added.",
      },
      {
        thread_ts: "1707890000.000200",
        channel: "#engineering",
        subject: "CI pipeline config change",
        reply: "Thanks for the heads-up Sarah. I'll rebase this morning — my branch shouldn't have any node version–specific deps so it should be smooth.",
      },
      {
        thread_ts: "1707880000.000300",
        channel: "#incidents",
        subject: "Checkout error rate spike",
        reply: "On it — I'll prioritize reviewing #158 right now. Mike, if the fix is scoped to the connection pool race, let's get it merged and deployed to staging ASAP.",
      },
    ];

    for (const item of threadReplies) {
      // Read the thread
      const threadResult = executeTool("slack_read_thread", { thread_ts: item.thread_ts });
      createAction({
        id: uuidv4(),
        execution_id: executionId,
        description: `Read thread: ${item.subject}`,
        tool: "slack_read_thread",
        status: "executed",
        result: JSON.stringify(threadResult.data),
        created_at: new Date().toISOString(),
      });
      actionsCount++;

      // Draft a reply (needs approval — boundary says never post without approval)
      const draftResult = executeTool("slack_draft_thread_reply", {
        channel: item.channel,
        thread_ts: item.thread_ts,
        text: item.reply,
      });
      createAction({
        id: uuidv4(),
        execution_id: executionId,
        description: `Draft reply in ${item.channel} thread "${item.subject}": "${item.reply}"`,
        tool: "slack_draft_thread_reply",
        status: "pending-approval",
        boundary_violation: "Boundary: Never post messages or replies without approval",
        result: JSON.stringify(draftResult.data),
        created_at: new Date().toISOString(),
      });
      actionsCount++;
      pendingApprovals++;
    }
  }

  // Build summary
  const status = pendingApprovals > 0 ? "awaiting-approval" : "completed";
  let summary: string;
  if (job.tools.includes("gmail")) {
    summary = `Processed inbox: archived ${3} marketing emails, starred ${3} important, flagged ${3} suspicious.${pendingApprovals > 0 ? ` ${pendingApprovals} action(s) awaiting approval.` : ""}`;
  } else if (job.tools.includes("slack")) {
    summary = `Slack catchup: 2 @mentions, 1 DM, 3 threads need your reply. Drafted 3 thread replies for your approval.`;
  } else {
    summary = `Reviewed ${4} open PRs. Commented on 2, found a bug in PR #142.${pendingApprovals > 0 ? ` ${pendingApprovals} action(s) awaiting approval.` : ""}`;
  }

  updateExecution(executionId, {
    completed_at: new Date().toISOString(),
    status,
    summary,
  });

  // Update job last_run
  getDb()
    .prepare("UPDATE jobs SET last_run = ? WHERE id = ?")
    .run(new Date().toISOString(), job.id);

  return {
    executionId,
    status: status as "completed" | "awaiting-approval",
    summary,
    error: null,
    actionsCount,
    pendingApprovals,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Execute a job - main entry point.
 *
 * If ANTHROPIC_API_KEY is set, uses Claude API.
 * Otherwise, runs in demo mode with realistic simulated results.
 */
export async function executeJob(job: JobDefinition): Promise<ExecutionResult> {
  const executionId = uuidv4();
  const startedAt = new Date().toISOString();

  // Create execution record
  createExecution({
    id: executionId,
    job_id: job.id,
    started_at: startedAt,
    status: "running",
  });

  try {
    const hasApiKey = !!process.env.ANTHROPIC_API_KEY;

    if (hasApiKey) {
      return await executeWithClaudeAPI(job, executionId);
    } else {
      return await executeInDemoMode(job, executionId);
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[executor] Job "${job.title}" failed:`, errorMessage);

    updateExecution(executionId, {
      completed_at: new Date().toISOString(),
      status: "failed",
      error: errorMessage,
    });

    return {
      executionId,
      status: "failed",
      summary: null,
      error: errorMessage,
      actionsCount: 0,
      pendingApprovals: 0,
    };
  }
}
