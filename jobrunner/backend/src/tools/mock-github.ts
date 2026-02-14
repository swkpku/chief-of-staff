/**
 * Mock GitHub tool - simulates GitHub API interactions for demo purposes.
 */

export interface MockPR {
  number: number;
  title: string;
  author: string;
  branch: string;
  base: string;
  description: string;
  files_changed: number;
  additions: number;
  deletions: number;
  created_at: string;
  updated_at: string;
  checks_status: "passing" | "failing" | "pending";
  labels: string[];
}

const MOCK_PRS: MockPR[] = [
  {
    number: 139,
    title: "Add user avatar component",
    author: "lisa-park",
    branch: "feature/user-avatar",
    base: "main",
    description:
      "Adds a reusable UserAvatar component that displays user profile images with fallback initials. Includes loading states and error handling.",
    files_changed: 4,
    additions: 186,
    deletions: 12,
    created_at: new Date(Date.now() - 172800000).toISOString(),
    updated_at: new Date(Date.now() - 86400000).toISOString(),
    checks_status: "passing",
    labels: ["feature", "frontend"],
  },
  {
    number: 141,
    title: "Refactor auth middleware",
    author: "alex-kumar",
    branch: "refactor/auth-middleware",
    base: "main",
    description:
      "Refactors the authentication middleware to use a cleaner pipeline pattern. Adds support for token refresh and improves error messages.",
    files_changed: 7,
    additions: 234,
    deletions: 189,
    created_at: new Date(Date.now() - 129600000).toISOString(),
    updated_at: new Date(Date.now() - 43200000).toISOString(),
    checks_status: "passing",
    labels: ["refactor", "backend", "auth"],
  },
  {
    number: 142,
    title: "Update payment flow",
    author: "mike-johnson",
    branch: "feature/payment-update",
    base: "main",
    description:
      "Updates the payment flow to support multi-currency billing. Adds new payment provider integration and updates the checkout UI.",
    files_changed: 12,
    additions: 542,
    deletions: 87,
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date(Date.now() - 7200000).toISOString(),
    checks_status: "failing",
    labels: ["feature", "payments", "needs-review"],
  },
  {
    number: 143,
    title: "Fix dark mode toggle persistence",
    author: "sarah-chen",
    branch: "fix/dark-mode-persist",
    base: "main",
    description:
      "Fixes an issue where the dark mode preference was not being saved to localStorage. Also fixes a flash of unstyled content on page load.",
    files_changed: 2,
    additions: 28,
    deletions: 8,
    created_at: new Date(Date.now() - 14400000).toISOString(),
    updated_at: new Date(Date.now() - 3600000).toISOString(),
    checks_status: "pending",
    labels: ["bug", "frontend"],
  },
];

export const githubFunctions: Record<string, (args: Record<string, unknown>) => unknown> = {
  list_open_prs: (_args: Record<string, unknown>) => {
    return {
      pull_requests: MOCK_PRS,
      total: MOCK_PRS.length,
    };
  },

  review_pr: (args: Record<string, unknown>) => {
    const prNumber = args.pr_number as number;
    const comments = args.comments as string;
    const pr = MOCK_PRS.find((p) => p.number === prNumber);
    return {
      success: true,
      message: pr
        ? `Review submitted on PR #${prNumber} "${pr.title}"`
        : `Review submitted on PR #${prNumber}`,
      comments_preview: comments?.substring(0, 200) || "",
    };
  },

  approve_pr: (args: Record<string, unknown>) => {
    const prNumber = args.pr_number as number;
    const pr = MOCK_PRS.find((p) => p.number === prNumber);
    return {
      success: true,
      status: "pending-approval",
      message: pr
        ? `Approval for PR #${prNumber} "${pr.title}" requires human confirmation`
        : `Approval for PR #${prNumber} requires human confirmation`,
    };
  },

  comment_on_pr: (args: Record<string, unknown>) => {
    const prNumber = args.pr_number as number;
    const comment = args.comment as string;
    const pr = MOCK_PRS.find((p) => p.number === prNumber);
    return {
      success: true,
      message: pr
        ? `Comment posted on PR #${prNumber} "${pr.title}"`
        : `Comment posted on PR #${prNumber}`,
      comment_preview: comment?.substring(0, 200) || "",
    };
  },
};

export const githubToolDefinitions = [
  {
    name: "github_list_open_prs",
    description:
      "List all open pull requests in the repository. Returns PR number, title, author, branch, description, files changed, check status, and labels.",
    input_schema: {
      type: "object" as const,
      properties: {
        state: {
          type: "string",
          description: 'Filter by PR state: "open", "closed", or "all" (default "open")',
        },
      },
      required: [],
    },
  },
  {
    name: "github_review_pr",
    description:
      "Submit a review on a pull request with comments about code quality, bugs, or suggestions.",
    input_schema: {
      type: "object" as const,
      properties: {
        pr_number: {
          type: "number",
          description: "The pull request number to review",
        },
        comments: {
          type: "string",
          description: "Review comments and feedback",
        },
      },
      required: ["pr_number", "comments"],
    },
  },
  {
    name: "github_approve_pr",
    description:
      "Approve a pull request. NOTE: This action requires human approval before it takes effect.",
    input_schema: {
      type: "object" as const,
      properties: {
        pr_number: {
          type: "number",
          description: "The pull request number to approve",
        },
      },
      required: ["pr_number"],
    },
  },
  {
    name: "github_comment_on_pr",
    description: "Post a comment on a pull request.",
    input_schema: {
      type: "object" as const,
      properties: {
        pr_number: {
          type: "number",
          description: "The pull request number to comment on",
        },
        comment: {
          type: "string",
          description: "The comment text to post",
        },
      },
      required: ["pr_number", "comment"],
    },
  },
];
