/**
 * Approval management - handles pending approval actions.
 *
 * When a job execution encounters a boundary violation, the action is
 * stored with status "pending-approval". This module provides functions
 * to approve or veto those actions.
 */

import {
  getPendingApprovals as dbGetPendingApprovals,
  getAction,
  updateAction,
  getActionsByExecution,
  getExecution,
  updateExecution,
} from "./db.js";
import { executeTool } from "./tools/index.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ApprovalItem {
  id: string;
  execution_id: string;
  description: string;
  tool: string | null;
  status: string;
  boundary_violation: string | null;
  result: string | null;
  created_at: string;
  job_id?: string;
  job_title?: string;
  execution_status?: string;
}

export interface ApprovalResult {
  success: boolean;
  action_id: string;
  new_status: string;
  result?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get all pending approval actions with their execution context.
 */
export function getPendingApprovals(): ApprovalItem[] {
  return dbGetPendingApprovals();
}

/**
 * Approve a pending action - execute the held action and update its status.
 *
 * After approval, checks if the parent execution has no more pending actions
 * and updates the execution status accordingly.
 */
export function approveAction(actionId: string): ApprovalResult {
  const action = getAction(actionId);
  if (!action) {
    return {
      success: false,
      action_id: actionId,
      new_status: "pending-approval",
      error: "Action not found",
    };
  }

  if (action.status !== "pending-approval") {
    return {
      success: false,
      action_id: actionId,
      new_status: action.status,
      error: `Action is not pending approval (current status: ${action.status})`,
    };
  }

  // Try to execute the held tool action
  let resultData: string | undefined;

  if (action.tool) {
    // Parse the original args from the description or stored data
    // The tool and its args were stored when the action was created
    try {
      const toolResult = executeTool(action.tool, parseArgsFromDescription(action.description, action.tool));
      resultData = JSON.stringify(toolResult.data);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      updateAction(actionId, {
        status: "approved",
        result: `Approved but execution failed: ${errorMsg}`,
      });

      checkAndUpdateExecutionStatus(action.execution_id);

      return {
        success: true,
        action_id: actionId,
        new_status: "approved",
        result: `Approved but execution failed: ${errorMsg}`,
      };
    }
  }

  // Update action status
  updateAction(actionId, {
    status: "approved",
    result: resultData || "Approved and executed",
  });

  // Check if execution should be updated
  checkAndUpdateExecutionStatus(action.execution_id);

  return {
    success: true,
    action_id: actionId,
    new_status: "approved",
    result: resultData || "Approved and executed",
  };
}

/**
 * Veto a pending action - mark it as vetoed and optionally log a reason.
 *
 * After vetoing, checks if the parent execution has no more pending actions
 * and updates the execution status accordingly.
 */
export function vetoAction(actionId: string, reason?: string): ApprovalResult {
  const action = getAction(actionId);
  if (!action) {
    return {
      success: false,
      action_id: actionId,
      new_status: "pending-approval",
      error: "Action not found",
    };
  }

  if (action.status !== "pending-approval") {
    return {
      success: false,
      action_id: actionId,
      new_status: action.status,
      error: `Action is not pending approval (current status: ${action.status})`,
    };
  }

  updateAction(actionId, {
    status: "vetoed",
    result: reason ? `Vetoed: ${reason}` : "Vetoed by user",
  });

  // Check if execution should be updated
  checkAndUpdateExecutionStatus(action.execution_id);

  return {
    success: true,
    action_id: actionId,
    new_status: "vetoed",
    result: reason ? `Vetoed: ${reason}` : "Vetoed by user",
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * After approving or vetoing an action, check if the parent execution
 * has any remaining pending approvals. If not, update the execution status
 * to "completed".
 */
function checkAndUpdateExecutionStatus(executionId: string): void {
  const execution = getExecution(executionId);
  if (!execution) return;

  // Only update executions that are currently awaiting approval
  if (execution.status !== "awaiting-approval") return;

  const actions = getActionsByExecution(executionId);
  const stillPending = actions.some((a) => a.status === "pending-approval");

  if (!stillPending) {
    updateExecution(executionId, {
      status: "completed",
      completed_at: new Date().toISOString(),
    });
  }
}

/**
 * Best-effort parsing of tool arguments from the action description.
 *
 * Action descriptions are stored in various formats during execution.
 * This function attempts to reconstruct reasonable arguments for re-execution.
 */
function parseArgsFromDescription(
  description: string,
  toolName: string
): Record<string, unknown> {
  // Try to extract args from "toolName({...})" format
  const jsonMatch = description.match(/\((\{.*\})\)$/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1]);
    } catch {
      // Fall through to heuristic parsing
    }
  }

  // Try to extract from "key: value, key: value" format inside parens
  const argsMatch = description.match(/\(([^)]+)\)/);
  if (argsMatch) {
    const args: Record<string, unknown> = {};
    const pairs = argsMatch[1].split(",");
    for (const pair of pairs) {
      const [key, ...valueParts] = pair.split(":");
      if (key && valueParts.length > 0) {
        const value = valueParts.join(":").trim();
        try {
          args[key.trim()] = JSON.parse(value);
        } catch {
          args[key.trim()] = value;
        }
      }
    }
    if (Object.keys(args).length > 0) return args;
  }

  // Fallback: return minimal args based on tool name patterns
  if (toolName.includes("draft_reply")) {
    // Extract email ID and body from description text
    const idMatch = description.match(/msg-\d+/);
    return {
      id: idMatch ? idMatch[0] : "msg-001",
      body: "Approved reply",
    };
  }

  if (toolName.includes("approve_pr")) {
    const prMatch = description.match(/#(\d+)/);
    return {
      pr_number: prMatch ? parseInt(prMatch[1], 10) : 1,
    };
  }

  return {};
}
