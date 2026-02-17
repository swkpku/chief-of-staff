/**
 * Config loader — reads config.yaml (or falls back to config.example.yaml for demo mode).
 * Validates against a zod schema and exports a typed config object.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parse as parseYaml } from "yaml";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to config files (project root / config /)
const CONFIG_DIR = path.resolve(__dirname, "../../../../config");
const USER_CONFIG = path.join(CONFIG_DIR, "config.yaml");
const EXAMPLE_CONFIG = path.join(CONFIG_DIR, "config.example.yaml");
const USER_SENDER_RULES = path.join(CONFIG_DIR, "sender-rules.yaml");
const EXAMPLE_SENDER_RULES = path.join(CONFIG_DIR, "sender-rules.example.yaml");

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const domainSchema = z.object({
  id: z.string(),
  label: z.string(),
  color: z.string(),
});

const llmSchema = z.object({
  provider: z.enum(["anthropic", "openai", "ollama"]).default("anthropic"),
  model: z.string().default("claude-sonnet-4-20250514"),
  api_key: z.string().default(""),
  base_url: z.string().optional(),
});

const gmailSchema = z.object({
  enabled: z.boolean().default(false),
  client_id: z.string().default(""),
  client_secret: z.string().default(""),
});

const xBookmarksSchema = z.object({
  enabled: z.boolean().default(false),
  api_key: z.string().default(""),
  api_secret: z.string().default(""),
  access_token: z.string().default(""),
});

const scheduleSchema = z.object({
  timezone: z.string().default("America/Los_Angeles"),
  wake_time: z.string().default("07:00"),
  sleep_time: z.string().default("22:00"),
  briefing_time: z.string().default("07:00"),
  weekly_review_day: z.string().default("sunday"),
  weekly_review_time: z.string().default("18:00"),
});

const scoringSchema = z.object({
  deadline_weight: z.number().default(3.0),
  consequence_weight: z.number().default(2.5),
  effort_weight: z.number().default(0.5),
  domain_neglect_weight: z.number().default(2.0),
  staleness_weight: z.number().default(1.0),
  max_same_domain_in_top5: z.number().default(3),
  hyper_focus_threshold_percent: z.number().default(80),
  hyper_focus_lookback_days: z.number().default(3),
  anomaly_deviation_threshold: z.number().default(0.3),
});

const defaultDomains = [
  { id: "email", label: "Email", color: "#3B82F6" },
  { id: "projects", label: "Projects", color: "#8B5CF6" },
  { id: "household", label: "Household", color: "#F59E0B" },
  { id: "career", label: "Career", color: "#10B981" },
  { id: "kids", label: "Kids", color: "#EF4444" },
];

const configSchema = z.object({
  llm: llmSchema.default(() => llmSchema.parse({})),
  gmail: gmailSchema.default(() => gmailSchema.parse({})),
  x_bookmarks: xBookmarksSchema.default(() => xBookmarksSchema.parse({})),
  schedule: scheduleSchema.default(() => scheduleSchema.parse({})),
  scoring: scoringSchema.default(() => scoringSchema.parse({})),
  domains: z.array(domainSchema).default(defaultDomains),
});

export type AppConfig = z.infer<typeof configSchema>;
export type DomainConfig = z.infer<typeof domainSchema>;

// ---------------------------------------------------------------------------
// Sender Rules Schema
// ---------------------------------------------------------------------------

const senderRulesSchema = z.record(z.string(), z.string());
export type SenderRules = z.infer<typeof senderRulesSchema>;

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let _config: AppConfig | null = null;
let _senderRules: SenderRules | null = null;
let _isDemo = false;

/**
 * Load and validate the config. Falls back to example config for demo mode.
 * NEVER logs or exposes API keys.
 */
export function loadConfig(): AppConfig {
  if (_config) return _config;

  let raw: Record<string, unknown> = {};
  let configPath: string;

  if (fs.existsSync(USER_CONFIG)) {
    configPath = USER_CONFIG;
    _isDemo = false;
  } else if (fs.existsSync(EXAMPLE_CONFIG)) {
    configPath = EXAMPLE_CONFIG;
    _isDemo = true;
    console.log("[config] No config.yaml found — running in demo mode with example config");
  } else {
    _isDemo = true;
    console.log("[config] No config files found — running with defaults (demo mode)");
    _config = configSchema.parse({});
    return _config;
  }

  try {
    const content = fs.readFileSync(configPath, "utf-8");
    raw = parseYaml(content) || {};
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[config] Failed to parse ${configPath}: ${msg}`);
    _isDemo = true;
    _config = configSchema.parse({});
    return _config;
  }

  try {
    _config = configSchema.parse(raw);
  } catch (err) {
    if (err instanceof z.ZodError) {
      console.error("[config] Validation errors:");
      for (const issue of err.issues) {
        console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
      }
    }
    _isDemo = true;
    _config = configSchema.parse({});
  }

  // Check if API key looks like a placeholder
  if (_config.llm.api_key.startsWith("YOUR_") || _config.llm.api_key === "") {
    _isDemo = true;
  }

  return _config;
}

/**
 * Load sender rules for email domain -> life domain mapping.
 */
export function loadSenderRules(): SenderRules {
  if (_senderRules) return _senderRules;

  let rulesPath: string;
  if (fs.existsSync(USER_SENDER_RULES)) {
    rulesPath = USER_SENDER_RULES;
  } else if (fs.existsSync(EXAMPLE_SENDER_RULES)) {
    rulesPath = EXAMPLE_SENDER_RULES;
  } else {
    _senderRules = {};
    return _senderRules;
  }

  try {
    const content = fs.readFileSync(rulesPath, "utf-8");
    const raw = parseYaml(content) || {};
    _senderRules = senderRulesSchema.parse(raw);
  } catch {
    _senderRules = {};
  }

  return _senderRules;
}

/**
 * Returns true if running in demo mode (no valid API keys configured).
 */
export function isDemoMode(): boolean {
  if (!_config) loadConfig();
  return _isDemo;
}

/**
 * Get the loaded config. Throws if not yet loaded.
 */
export function getConfig(): AppConfig {
  if (!_config) return loadConfig();
  return _config;
}

/**
 * Redact sensitive values from config for logging/display.
 */
export function getRedactedConfig(): Record<string, unknown> {
  const cfg = getConfig();
  return {
    llm: {
      provider: cfg.llm.provider,
      model: cfg.llm.model,
      api_key: cfg.llm.api_key ? "***REDACTED***" : "(not set)",
    },
    gmail: {
      enabled: cfg.gmail.enabled,
      client_id: cfg.gmail.client_id ? "***REDACTED***" : "(not set)",
    },
    x_bookmarks: {
      enabled: cfg.x_bookmarks.enabled,
    },
    schedule: cfg.schedule,
    scoring: cfg.scoring,
    domains: cfg.domains,
  };
}
