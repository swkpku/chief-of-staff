/**
 * Tool registry - stores all mock tools and provides a unified interface
 * for looking up tool definitions and executing tool functions.
 */

import { gmailFunctions, gmailToolDefinitions } from "./mock-gmail.js";
import { githubFunctions, githubToolDefinitions } from "./mock-github.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
  };
}

export interface ToolResult {
  success: boolean;
  data: unknown;
  requiresApproval?: boolean;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/**
 * Maps tool category names (e.g., "gmail", "github") to their
 * tool definitions and function implementations.
 */
const toolRegistry: Record<
  string,
  {
    definitions: ToolDefinition[];
    functions: Record<string, (args: Record<string, unknown>) => unknown>;
  }
> = {
  gmail: {
    definitions: gmailToolDefinitions as ToolDefinition[],
    functions: gmailFunctions,
  },
  github: {
    definitions: githubToolDefinitions as ToolDefinition[],
    functions: githubFunctions,
  },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get tool definitions formatted for Claude API tool_use, filtered to only
 * the tools that a given job needs.
 *
 * @param toolNames - Array of tool category names (e.g., ["gmail", "github"])
 * @returns Array of tool definitions suitable for passing to the Claude API
 */
export function getToolsForJob(toolNames: string[]): ToolDefinition[] {
  const definitions: ToolDefinition[] = [];

  for (const name of toolNames) {
    const entry = toolRegistry[name.toLowerCase()];
    if (entry) {
      definitions.push(...entry.definitions);
    } else {
      console.warn(`[tools] Unknown tool category: ${name}`);
    }
  }

  return definitions;
}

/**
 * Execute a tool function by its full name (e.g., "gmail_list_emails").
 *
 * The tool name format is "{category}_{function}" where:
 * - category: the tool category registered in the registry (e.g., "gmail")
 * - function: the function name within that category (e.g., "list_emails")
 *
 * @param toolName - Full tool name (e.g., "gmail_list_emails")
 * @param args - Arguments to pass to the tool function
 * @returns ToolResult with the function output
 */
export function executeTool(
  toolName: string,
  args: Record<string, unknown>
): ToolResult {
  // Parse the tool name: "gmail_list_emails" -> category="gmail", fn="list_emails"
  const underscoreIndex = toolName.indexOf("_");
  if (underscoreIndex === -1) {
    return {
      success: false,
      data: { error: `Invalid tool name format: ${toolName}. Expected "category_function".` },
    };
  }

  const category = toolName.substring(0, underscoreIndex);
  const functionName = toolName.substring(underscoreIndex + 1);

  const entry = toolRegistry[category];
  if (!entry) {
    return {
      success: false,
      data: { error: `Unknown tool category: ${category}` },
    };
  }

  const fn = entry.functions[functionName];
  if (!fn) {
    return {
      success: false,
      data: { error: `Unknown function "${functionName}" in tool "${category}"` },
    };
  }

  try {
    const result = fn(args);

    // Check if the result indicates this action needs approval
    const requiresApproval =
      typeof result === "object" &&
      result !== null &&
      "status" in result &&
      (result as Record<string, unknown>).status === "pending-approval";

    return {
      success: true,
      data: result,
      requiresApproval,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      data: { error: `Tool execution failed: ${message}` },
    };
  }
}

/**
 * Get all available tool category names.
 */
export function getAvailableToolCategories(): string[] {
  return Object.keys(toolRegistry);
}

/**
 * Get all tool definitions across all categories.
 */
export function getAllToolDefinitions(): ToolDefinition[] {
  const definitions: ToolDefinition[] = [];
  for (const entry of Object.values(toolRegistry)) {
    definitions.push(...entry.definitions);
  }
  return definitions;
}
