//! Pre-compiled regex patterns for workflow validation.
//!
//! All patterns are compiled once at startup using `once_cell::sync::Lazy`.
//! This is the primary performance advantage over JavaScript - patterns are
//! compiled to optimized native code and reused across all validations.

use once_cell::sync::Lazy;
use regex::Regex;

// ============================================================================
// IMPORT PATTERNS
// ============================================================================

/// Matches @workway/sdk import
pub static SDK_IMPORT: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"@workway/sdk").unwrap()
});

/// Matches AI-related usage patterns
pub static AI_USAGE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"createAIClient|AIModels|env\.AI|workers-ai").unwrap()
});

/// Matches @workway/sdk/workers-ai import
pub static WORKERS_AI_IMPORT: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"@workway/sdk/workers-ai").unwrap()
});

// ============================================================================
// WORKFLOW DEFINITION PATTERNS
// ============================================================================

/// Matches defineWorkflow function call
pub static DEFINE_WORKFLOW: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"defineWorkflow\s*\(").unwrap()
});

/// Matches export default statement
pub static EXPORT_DEFAULT: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"export\s+default").unwrap()
});

/// Extracts workflow name from name: 'xxx' pattern
pub static WORKFLOW_NAME: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r#"name:\s*['"`]([^'"`]+)['"`]"#).unwrap()
});

/// Extracts workflow type
pub static WORKFLOW_TYPE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r#"type:\s*['"`](integration|ai-enhanced|ai-native)['"`]"#).unwrap()
});

// ============================================================================
// EXECUTE FUNCTION PATTERNS
// ============================================================================

/// Matches execute function declaration
pub static HAS_EXECUTE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"execute\s*[:(]|async\s+execute").unwrap()
});

/// Matches run function declaration
pub static HAS_RUN: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"run\s*[:(]|async\s+run").unwrap()
});

/// Extracts execute function body
pub static EXECUTE_BODY: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?s)execute\s*\([^)]*\)\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}").unwrap()
});

// ============================================================================
// INTEGRATION PATTERNS
// ============================================================================

/// Extracts integrations array content
pub static INTEGRATIONS_BLOCK: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?s)integrations:\s*\[([\s\S]*?)\]").unwrap()
});

/// Extracts service names from service: 'xxx'
pub static SERVICE_NAMES: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r#"service:\s*['"`]([^'"`]+)['"`]"#).unwrap()
});

/// Extracts shorthand integration names
pub static SHORTHAND_INTEGRATIONS: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r#"['"`]([a-z-]+)['"`]"#).unwrap()
});

// ============================================================================
// TRIGGER PATTERNS
// ============================================================================

/// Matches trigger: definition
pub static HAS_TRIGGER: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"trigger:\s*").unwrap()
});

/// Extracts trigger type from trigger: webhook/schedule/manual/poll
pub static TRIGGER_TYPE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"trigger:\s*(webhook|schedule|manual|poll)\s*\(").unwrap()
});

/// Extracts trigger type from object style: trigger: { type: 'xxx' }
pub static TRIGGER_OBJECT_TYPE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r#"trigger:\s*\{\s*type:\s*['"`]([^'"`]+)['"`]"#).unwrap()
});

/// Extracts webhook config
pub static WEBHOOK_CONFIG: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"webhook\s*\(\s*\{([^}]+)\}").unwrap()
});

/// Extracts schedule expression
pub static SCHEDULE_EXPR: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r#"schedule\s*\(\s*['"`]([^'"`]+)['"`]"#).unwrap()
});

// ============================================================================
// PRICING PATTERNS
// ============================================================================

/// Matches pricing: { definition
pub static HAS_PRICING: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"pricing:\s*\{").unwrap()
});

/// Extracts pricing model
pub static PRICING_MODEL: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r#"model:\s*['"`](subscription|usage|one-time)['"`]"#).unwrap()
});

/// Extracts price value
pub static PRICING_PRICE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"price:\s*(\d+(?:\.\d+)?)").unwrap()
});

/// Matches executions limit
pub static HAS_EXECUTIONS: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"executions:\s*(\d+|'unlimited')").unwrap()
});

// ============================================================================
// AI VALIDATION PATTERNS
// ============================================================================

/// Matches external AI providers (not allowed)
pub static EXTERNAL_AI: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)claude|gpt-4|openai|anthropic|gemini").unwrap()
});

/// Matches env access in execute function
pub static ENV_ACCESS: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"env\s*[,})]|context\.env|\{ env \}").unwrap()
});

// ============================================================================
// COMMON MISTAKE PATTERNS
// ============================================================================

/// Matches console.log/error/warn statements
pub static CONSOLE_STATEMENTS: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"console\.(log|error|warn)").unwrap()
});

/// Matches await in for loop
pub static AWAIT_IN_FOR_LOOP: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?s)for\s*\([^)]+\)\s*\{[^}]*await[^}]*\}").unwrap()
});

/// Matches await in while loop
pub static AWAIT_IN_WHILE_LOOP: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?s)while\s*\([^)]+\)\s*\{[^}]*await[^}]*\}").unwrap()
});

/// Matches empty catch block
pub static EMPTY_CATCH: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?s)catch\s*\([^)]*\)\s*\{\s*\}").unwrap()
});

// ============================================================================
// SECRET DETECTION PATTERNS
// ============================================================================

/// Hardcoded API key pattern
pub static SECRET_API_KEY: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r#"(?i)api[_-]?key\s*[:=]\s*['"`][^'"`]{20,}['"`]"#).unwrap()
});

/// Hardcoded secret pattern
pub static SECRET_SECRET: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r#"(?i)secret\s*[:=]\s*['"`][^'"`]{20,}['"`]"#).unwrap()
});

/// Hardcoded password pattern
pub static SECRET_PASSWORD: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r#"(?i)password\s*[:=]\s*['"`][^'"`]+['"`]"#).unwrap()
});

/// Hardcoded token pattern
pub static SECRET_TOKEN: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r#"(?i)token\s*[:=]\s*['"`][^'"`]{20,}['"`]"#).unwrap()
});

// ============================================================================
// CRON VALIDATION PATTERNS
// ============================================================================

/// Cron step wildcard pattern
pub static CRON_STEP_WILDCARD: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"^\*/\d+$").unwrap()
});

/// Cron range/list pattern
pub static CRON_RANGE_LIST: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"^\d+(-\d+)?(,\d+(-\d+)?)*$").unwrap()
});

/// Cron minute field
pub static CRON_MINUTE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"^(\*|[0-9]|[1-5][0-9])(\/(0|[1-9][0-9]?))?$|^\*/[0-9]+$").unwrap()
});

/// Cron hour field
pub static CRON_HOUR: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"^(\*|[0-9]|1[0-9]|2[0-3])(\/(0|[1-9][0-9]?))?$|^\*/[0-9]+$").unwrap()
});

/// Cron day field
pub static CRON_DAY: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"^(\*|[1-9]|[12][0-9]|3[01])(\/(0|[1-9][0-9]?))?$|^\*/[0-9]+$").unwrap()
});

/// Cron month field
pub static CRON_MONTH: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"^(\*|[1-9]|1[0-2])(\/(0|[1-9][0-9]?))?$|^\*/[0-9]+$").unwrap()
});

/// Cron weekday field
pub static CRON_WEEKDAY: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"^(\*|[0-6])(\/(0|[1-9][0-9]?))?$|^\*/[0-9]+$").unwrap()
});

// ============================================================================
// BLOCKED MODULE PATTERNS
// ============================================================================

/// Creates a pattern to match import/require of a specific module
pub fn blocked_module_pattern(module: &str) -> Regex {
    Regex::new(&format!(
        r#"(import\s+.*from\s+['"`]{0}['"`])|(require\s*\(\s*['"`]{0}['"`]\s*\))"#,
        regex::escape(module)
    )).unwrap()
}

/// List of blocked Node.js modules
pub static BLOCKED_NODE_MODULES: &[&str] = &[
    "fs", "path", "child_process", "os", "net", "http", "https",
    "stream", "buffer", "crypto", "util", "events", "cluster",
    "dns", "readline", "tty", "vm", "zlib", "worker_threads",
    "perf_hooks", "async_hooks",
];

/// List of blocked npm packages
pub static BLOCKED_NPM_PACKAGES: &[&str] = &[
    "axios", "request", "node-fetch", "express", "bcrypt",
    "sharp", "puppeteer", "mongoose", "pg", "mysql", "redis",
];

/// Known integrations
pub static KNOWN_INTEGRATIONS: &[&str] = &[
    "gmail", "slack", "notion", "stripe", "github", "salesforce",
    "airtable", "zendesk", "hubspot", "linear", "discord", "telegram",
    "sendgrid", "resend", "mailchimp", "paypal", "square", "pipedrive",
    "gitlab", "google-workspace", "google-calendar", "google-drive",
    "google-sheets",
];
