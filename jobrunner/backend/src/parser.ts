import fs from "fs";
import path from "path";
import { watch } from "chokidar";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface JobDefinition {
  id: string;
  title: string;
  schedule: string;
  goal: string;
  policies: string[];
  boundaries: string[];
  tools: string[];
  filePath: string;
  enabled: boolean;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/**
 * Parse a single .job.md file into a JobDefinition.
 *
 * Expected markdown format:
 * ```
 * # Job Title
 *
 * ## Schedule
 * 0 * /4 * * *
 *
 * ## Goal
 * Description of what the job should accomplish.
 *
 * ## Policies
 * - Policy one
 * - Policy two
 *
 * ## Boundaries
 * - Boundary one
 * - Boundary two
 *
 * ## Tools
 * - gmail
 * - github
 * ```
 */
export function parseJobFile(filePath: string): JobDefinition | null {
  if (!fs.existsSync(filePath)) {
    console.warn(`[parser] File not found: ${filePath}`);
    return null;
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const basename = path.basename(filePath);

  // Derive id from filename: "email-triage.job.md" -> "email-triage"
  const id = basename.replace(/\.job\.md$/i, "");

  // Parse sections
  const lines = content.split("\n");
  let title = id; // fallback
  const sections: Record<string, string[]> = {};
  let currentSection: string | null = null;

  for (const line of lines) {
    const h1Match = line.match(/^#\s+(.+)/);
    const h2Match = line.match(/^##\s+(.+)/);

    if (h1Match && !line.startsWith("##")) {
      title = h1Match[1].trim();
      currentSection = null;
    } else if (h2Match) {
      currentSection = h2Match[1].trim().toLowerCase();
      sections[currentSection] = [];
    } else if (currentSection) {
      sections[currentSection].push(line);
    }
  }

  // Extract fields
  const schedule = extractText(sections["schedule"]);
  const goal = extractText(sections["goal"]);
  const policies = extractList(sections["policies"] || sections["policy"]);
  const boundaries = extractList(sections["boundaries"] || sections["boundary"]);
  const tools = extractList(sections["tools"]);

  // Check for enabled/disabled
  const enabledSection = extractText(sections["enabled"] || sections["status"]);
  let enabled = true;
  if (enabledSection.toLowerCase() === "false" || enabledSection.toLowerCase() === "disabled") {
    enabled = false;
  }

  if (!schedule) {
    console.warn(`[parser] No schedule found in ${filePath}, skipping`);
    return null;
  }

  return {
    id,
    title,
    schedule,
    goal,
    policies,
    boundaries,
    tools,
    filePath: path.resolve(filePath),
    enabled,
  };
}

/**
 * Parse all .job.md files in a directory.
 */
export function parseAllJobs(dir: string): JobDefinition[] {
  if (!fs.existsSync(dir)) {
    console.warn(`[parser] Jobs directory not found: ${dir}`);
    return [];
  }

  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".job.md"));
  const jobs: JobDefinition[] = [];

  for (const file of files) {
    const job = parseJobFile(path.join(dir, file));
    if (job) {
      jobs.push(job);
    }
  }

  return jobs;
}

/**
 * Watch a directory for .job.md file changes. Calls the callback with
 * the updated list of all jobs whenever a change is detected.
 */
export function watchJobs(
  dir: string,
  callback: (jobs: JobDefinition[]) => void
): void {
  if (!fs.existsSync(dir)) {
    console.warn(`[parser] Jobs directory not found for watching: ${dir}`);
    return;
  }

  const watcher = watch(path.join(dir, "*.job.md"), {
    ignoreInitial: true,
  });

  const handleChange = (filePath: string) => {
    console.log(`[parser] Detected change: ${filePath}`);
    const jobs = parseAllJobs(dir);
    callback(jobs);
  };

  watcher.on("add", handleChange);
  watcher.on("change", handleChange);
  watcher.on("unlink", (filePath) => {
    console.log(`[parser] Detected removal: ${filePath}`);
    const jobs = parseAllJobs(dir);
    callback(jobs);
  });

  console.log(`[parser] Watching ${dir} for .job.md changes`);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract plain text from section lines, ignoring empty lines.
 */
function extractText(lines: string[] | undefined): string {
  if (!lines) return "";
  return lines
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join("\n")
    .trim();
}

/**
 * Extract a bulleted list from section lines.
 * Supports "- item", "* item", and "1. item" formats.
 */
function extractList(lines: string[] | undefined): string[] {
  if (!lines) return [];
  const items: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(/^[-*]\s+(.+)/) || trimmed.match(/^\d+\.\s+(.+)/);
    if (match) {
      items.push(match[1].trim());
    }
  }
  return items;
}
