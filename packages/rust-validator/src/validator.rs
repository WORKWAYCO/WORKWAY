//! Core workflow validation logic.
//!
//! This module implements the same validation rules as the TypeScript validator,
//! but uses pre-compiled Rust regex patterns for significantly better performance.

use serde::{Deserialize, Serialize};
use crate::patterns::*;

/// Validation error
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationError {
    #[serde(rename = "type")]
    pub error_type: String,
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub line: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub suggestion: Option<String>,
}

/// Validation warning
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationWarning {
    #[serde(rename = "type")]
    pub warning_type: String,
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub line: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub suggestion: Option<String>,
}

/// Workflow metadata extracted during validation
#[derive(Debug, Default, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowMetadata {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "type")]
    pub workflow_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub integrations: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub trigger: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub has_ai: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pricing: Option<PricingMetadata>,
}

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct PricingMetadata {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub price: Option<f64>,
}

/// Validation result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationResult {
    pub valid: bool,
    pub errors: Vec<ValidationError>,
    pub warnings: Vec<ValidationWarning>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<WorkflowMetadata>,
}

impl ValidationError {
    pub fn new(code: &str, message: &str) -> Self {
        Self {
            error_type: "error".to_string(),
            code: code.to_string(),
            message: message.to_string(),
            line: None,
            suggestion: None,
        }
    }

    pub fn with_suggestion(mut self, suggestion: &str) -> Self {
        self.suggestion = Some(suggestion.to_string());
        self
    }
}

impl ValidationWarning {
    pub fn new(code: &str, message: &str) -> Self {
        Self {
            warning_type: "warning".to_string(),
            code: code.to_string(),
            message: message.to_string(),
            line: None,
            suggestion: None,
        }
    }

    pub fn with_suggestion(mut self, suggestion: &str) -> Self {
        self.suggestion = Some(suggestion.to_string());
        self
    }
}

/// Suggestions for blocked Node.js modules
fn get_node_module_suggestion(module: &str) -> &'static str {
    match module {
        "fs" => "Cloudflare Workers have no filesystem. Store data in KV or R2.",
        "path" => "Use string manipulation or URL API instead.",
        "child_process" => "Workers cannot spawn processes. Use external services.",
        "crypto" => "Use Web Crypto API: crypto.subtle.digest(), crypto.randomUUID()",
        "http" | "https" => "Use native fetch() instead.",
        "buffer" => "Use ArrayBuffer/Uint8Array instead.",
        "stream" => "Use Web Streams API (ReadableStream, WritableStream).",
        _ => "See docs/WORKERS_RUNTIME_GUIDE.md for alternatives.",
    }
}

/// Suggestions for blocked npm packages
fn get_npm_package_suggestion(package: &str) -> &'static str {
    match package {
        "axios" => "Use native fetch() - it works identically in Workers.",
        "request" => "Use native fetch() - request is deprecated anyway.",
        "node-fetch" => "Native fetch() is available - no polyfill needed.",
        "express" => "Workers use event-driven model, not HTTP servers.",
        "bcrypt" => "Use bcryptjs (pure JS) or Web Crypto API.",
        "sharp" => "Use Cloudflare Images for image processing.",
        "puppeteer" => "Use an external browser service or Cloudflare Browser Rendering.",
        "mongoose" => "Use Cloudflare D1 (SQLite) or external API.",
        "pg" => "Use Cloudflare D1 or Hyperdrive for PostgreSQL.",
        "mysql" => "Use Cloudflare D1 or Hyperdrive.",
        "redis" => "Use Cloudflare KV for key-value storage.",
        _ => "See docs/WORKERS_RUNTIME_GUIDE.md for alternatives.",
    }
}

/// Validate a workflow file content
pub fn validate_workflow(content: &str) -> ValidationResult {
    let mut errors = Vec::new();
    let mut warnings = Vec::new();
    let mut metadata = WorkflowMetadata::default();

    // Validate imports
    validate_imports(content, &mut errors, &mut warnings, &mut metadata);

    // Validate workflow definition
    validate_workflow_definition(content, &mut errors, &mut warnings, &mut metadata);

    // Validate execute function
    validate_execute_function(content, &mut errors, &mut warnings);

    // Validate integrations
    validate_integrations(content, &mut errors, &mut warnings, &mut metadata);

    // Validate trigger
    validate_trigger(content, &mut errors, &mut warnings, &mut metadata);

    // Validate pricing
    validate_pricing(content, &mut errors, &mut warnings, &mut metadata);

    // Validate AI usage
    validate_ai_usage(content, &mut errors, &mut warnings, &mut metadata);

    // Validate common mistakes
    validate_common_mistakes(content, &mut errors, &mut warnings);

    ValidationResult {
        valid: errors.is_empty(),
        errors,
        warnings,
        metadata: Some(metadata),
    }
}

fn validate_imports(
    content: &str,
    errors: &mut Vec<ValidationError>,
    warnings: &mut Vec<ValidationWarning>,
    metadata: &mut WorkflowMetadata,
) {
    // Check for SDK import
    if !SDK_IMPORT.is_match(content) {
        errors.push(
            ValidationError::new("MISSING_SDK_IMPORT", "Workflow must import from @workway/sdk")
                .with_suggestion("Add: import { defineWorkflow } from '@workway/sdk'")
        );
    }

    // Check for Workers AI import if using AI
    let has_ai_usage = AI_USAGE.is_match(content);
    let has_workers_ai_import = WORKERS_AI_IMPORT.is_match(content);

    if has_ai_usage && !has_workers_ai_import {
        warnings.push(
            ValidationWarning::new("MISSING_AI_IMPORT", "AI usage detected but no workers-ai import found")
                .with_suggestion("Add: import { createAIClient, AIModels } from '@workway/sdk/workers-ai'")
        );
    }

    metadata.has_ai = Some(has_ai_usage);

    // Check for blocked Node.js modules
    for module in BLOCKED_NODE_MODULES {
        let pattern = blocked_module_pattern(module);
        if pattern.is_match(content) {
            errors.push(
                ValidationError::new(
                    "BLOCKED_NODE_MODULE",
                    &format!("Node.js module '{}' is not available in Cloudflare Workers", module)
                ).with_suggestion(get_node_module_suggestion(module))
            );
        }
    }

    // Check for blocked npm packages
    for package in BLOCKED_NPM_PACKAGES {
        let pattern = blocked_module_pattern(package);
        if pattern.is_match(content) {
            warnings.push(
                ValidationWarning::new(
                    "INCOMPATIBLE_NPM_PACKAGE",
                    &format!("npm package '{}' is incompatible with Cloudflare Workers", package)
                ).with_suggestion(get_npm_package_suggestion(package))
            );
        }
    }
}

fn validate_workflow_definition(
    content: &str,
    errors: &mut Vec<ValidationError>,
    warnings: &mut Vec<ValidationWarning>,
    metadata: &mut WorkflowMetadata,
) {
    // Check for defineWorkflow or export default
    let has_define_workflow = DEFINE_WORKFLOW.is_match(content);
    let has_export_default = EXPORT_DEFAULT.is_match(content);

    if !has_define_workflow && !has_export_default {
        errors.push(
            ValidationError::new("NO_WORKFLOW_EXPORT", "Workflow must use defineWorkflow() or export default")
                .with_suggestion("Wrap your workflow in defineWorkflow({ ... })")
        );
    }

    // Extract workflow name
    if let Some(caps) = WORKFLOW_NAME.captures(content) {
        metadata.name = caps.get(1).map(|m| m.as_str().to_string());
    } else {
        warnings.push(
            ValidationWarning::new("MISSING_NAME", "Workflow should have a name property")
                .with_suggestion("Add: name: 'My Workflow'")
        );
    }

    // Extract workflow type
    if let Some(caps) = WORKFLOW_TYPE.captures(content) {
        metadata.workflow_type = caps.get(1).map(|m| m.as_str().to_string());
    }
}

fn validate_execute_function(
    content: &str,
    errors: &mut Vec<ValidationError>,
    warnings: &mut Vec<ValidationWarning>,
) {
    // Check for execute or run function
    let has_execute = HAS_EXECUTE.is_match(content);
    let has_run = HAS_RUN.is_match(content);

    if !has_execute && !has_run {
        errors.push(
            ValidationError::new("MISSING_EXECUTE", "Workflow must have an execute or run function")
                .with_suggestion("Add: async execute({ trigger, actions }) { ... }")
        );
    }

    // Check for return statement in execute
    if let Some(caps) = EXECUTE_BODY.captures(content) {
        if let Some(body) = caps.get(1) {
            if !body.as_str().contains("return") {
                warnings.push(
                    ValidationWarning::new("NO_RETURN", "Execute function should return a result")
                        .with_suggestion("Add: return { success: true, data: ... }")
                );
            }
        }
    }
}

fn validate_integrations(
    content: &str,
    _errors: &mut Vec<ValidationError>,
    warnings: &mut Vec<ValidationWarning>,
    metadata: &mut WorkflowMetadata,
) {
    // Extract integrations array
    if let Some(caps) = INTEGRATIONS_BLOCK.captures(content) {
        if let Some(block) = caps.get(1) {
            let block_str = block.as_str();
            let mut integrations = Vec::new();

            // Extract service names
            for caps in SERVICE_NAMES.captures_iter(block_str) {
                if let Some(name) = caps.get(1) {
                    integrations.push(name.as_str().to_lowercase());
                }
            }

            // Extract shorthand integrations
            for caps in SHORTHAND_INTEGRATIONS.captures_iter(block_str) {
                if let Some(name) = caps.get(1) {
                    let name_lower = name.as_str().to_lowercase();
                    if KNOWN_INTEGRATIONS.contains(&name_lower.as_str()) && !integrations.contains(&name_lower) {
                        integrations.push(name_lower);
                    }
                }
            }

            // Validate each integration
            for integration in &integrations {
                if !KNOWN_INTEGRATIONS.contains(&integration.as_str()) {
                    warnings.push(
                        ValidationWarning::new(
                            "UNKNOWN_INTEGRATION",
                            &format!("Unknown integration: {}", integration)
                        ).with_suggestion(&format!("Valid integrations: {}...", KNOWN_INTEGRATIONS[..5].join(", ")))
                    );
                }
            }

            // Check for scope definitions
            if !integrations.is_empty() && !block_str.contains("scopes") {
                warnings.push(
                    ValidationWarning::new("MISSING_SCOPES", "Integrations should specify required scopes")
                        .with_suggestion("Add: scopes: ['read_data', 'write_data']")
                );
            }

            if !integrations.is_empty() {
                metadata.integrations = Some(integrations);
            }
        }
    }
}

fn validate_trigger(
    content: &str,
    errors: &mut Vec<ValidationError>,
    warnings: &mut Vec<ValidationWarning>,
    metadata: &mut WorkflowMetadata,
) {
    // Check for trigger definition
    if !HAS_TRIGGER.is_match(content) {
        errors.push(
            ValidationError::new("MISSING_TRIGGER", "Workflow must define a trigger")
                .with_suggestion("Add: trigger: webhook({ service: 'stripe', event: 'payment.succeeded' })")
        );
        return;
    }

    // Extract trigger type
    if let Some(caps) = TRIGGER_TYPE.captures(content) {
        metadata.trigger = caps.get(1).map(|m| m.as_str().to_string());
    } else if let Some(caps) = TRIGGER_OBJECT_TYPE.captures(content) {
        metadata.trigger = caps.get(1).map(|m| m.as_str().to_string());
    }

    // Validate webhook trigger
    if content.contains("webhook(") {
        if let Some(caps) = WEBHOOK_CONFIG.captures(content) {
            if let Some(config) = caps.get(1) {
                let config_str = config.as_str();
                if !config_str.contains("service") && !config_str.contains("event") {
                    warnings.push(
                        ValidationWarning::new("INCOMPLETE_WEBHOOK", "Webhook trigger should specify service and event")
                            .with_suggestion("Add: service: 'stripe', event: 'payment.succeeded'")
                    );
                }
            }
        }
    }

    // Validate schedule trigger
    if content.contains("schedule(") {
        if let Some(caps) = SCHEDULE_EXPR.captures(content) {
            if let Some(cron_match) = caps.get(1) {
                let cron_expr = cron_match.as_str();
                if !is_valid_cron(cron_expr) {
                    errors.push(
                        ValidationError::new("INVALID_CRON", &format!("Invalid cron expression: {}", cron_expr))
                            .with_suggestion("Use format: '0 8 * * *' (minute hour day month weekday)")
                    );
                }
            }
        }
    }
}

fn validate_pricing(
    content: &str,
    _errors: &mut Vec<ValidationError>,
    warnings: &mut Vec<ValidationWarning>,
    metadata: &mut WorkflowMetadata,
) {
    if !HAS_PRICING.is_match(content) {
        warnings.push(
            ValidationWarning::new("MISSING_PRICING", "Workflow should define pricing for marketplace")
                .with_suggestion("Add: pricing: { model: 'subscription', price: 10, executions: 100 }")
        );
        return;
    }

    let mut pricing = PricingMetadata::default();

    // Extract pricing model
    if let Some(caps) = PRICING_MODEL.captures(content) {
        pricing.model = caps.get(1).map(|m| m.as_str().to_string());
    }

    // Extract price
    if let Some(caps) = PRICING_PRICE.captures(content) {
        if let Some(price_match) = caps.get(1) {
            pricing.price = price_match.as_str().parse().ok();
        }
    }

    // Validate subscription pricing has executions
    if pricing.model.as_deref() == Some("subscription") {
        if !HAS_EXECUTIONS.is_match(content) {
            warnings.push(
                ValidationWarning::new("MISSING_EXECUTIONS", "Subscription pricing should specify executions limit")
                    .with_suggestion("Add: executions: 100")
            );
        }
    }

    metadata.pricing = Some(pricing);
}

fn validate_ai_usage(
    content: &str,
    _errors: &mut Vec<ValidationError>,
    warnings: &mut Vec<ValidationWarning>,
    metadata: &mut WorkflowMetadata,
) {
    // Check for external AI providers
    if EXTERNAL_AI.is_match(content) {
        warnings.push(
            ValidationWarning::new("EXTERNAL_AI_DETECTED", "External AI providers detected. WORKWAY uses Cloudflare Workers AI only.")
                .with_suggestion("Use: createAIClient(env) with AIModels.LLAMA_3_8B or AIModels.MISTRAL_7B")
        );
    }

    // Check for proper AI client usage
    if metadata.has_ai == Some(true) {
        if !ENV_ACCESS.is_match(content) {
            warnings.push(
                ValidationWarning::new("MISSING_ENV_ACCESS", "AI usage requires env parameter in execute function")
                    .with_suggestion("Update: async execute({ trigger, actions, env }) { ... }")
            );
        }
    }
}

fn validate_common_mistakes(
    content: &str,
    errors: &mut Vec<ValidationError>,
    warnings: &mut Vec<ValidationWarning>,
) {
    // Check for console.log
    let console_count = CONSOLE_STATEMENTS.find_iter(content).count();
    if console_count > 3 {
        warnings.push(
            ValidationWarning::new("EXCESSIVE_LOGGING", &format!("Found {} console statements", console_count))
                .with_suggestion("Consider reducing logging in production builds")
        );
    }

    // Check for hardcoded secrets
    if SECRET_API_KEY.is_match(content)
        || SECRET_SECRET.is_match(content)
        || SECRET_PASSWORD.is_match(content)
        || SECRET_TOKEN.is_match(content)
    {
        errors.push(
            ValidationError::new("HARDCODED_SECRET", "Possible hardcoded secret detected")
                .with_suggestion("Use environment variables or secrets manager instead")
        );
    }

    // Check for await inside loops
    if AWAIT_IN_FOR_LOOP.is_match(content) || AWAIT_IN_WHILE_LOOP.is_match(content) {
        warnings.push(
            ValidationWarning::new("AWAIT_IN_LOOP", "Await inside loop detected (may affect performance)")
                .with_suggestion("Consider using Promise.all() for parallel execution")
        );
    }

    // Check for empty catch blocks
    if EMPTY_CATCH.is_match(content) {
        warnings.push(
            ValidationWarning::new("EMPTY_CATCH", "Empty catch block detected")
                .with_suggestion("Handle or re-throw errors properly")
        );
    }
}

/// Validate a cron expression
fn is_valid_cron(expr: &str) -> bool {
    let parts: Vec<&str> = expr.trim().split_whitespace().collect();
    if parts.len() != 5 {
        return false;
    }

    let cron_patterns = [
        &*CRON_MINUTE,
        &*CRON_HOUR,
        &*CRON_DAY,
        &*CRON_MONTH,
        &*CRON_WEEKDAY,
    ];

    // Maximum values for each cron field
    let max_values = [59, 23, 31, 12, 6]; // minute, hour, day, month, weekday

    for (i, part) in parts.iter().enumerate() {
        if *part == "*" {
            continue;
        }
        if CRON_STEP_WILDCARD.is_match(part) {
            continue;
        }
        // For range/list patterns, we need to validate the numbers are in range
        if CRON_RANGE_LIST.is_match(part) {
            // Parse and validate each number in the range/list
            let valid = part.split(',').all(|segment| {
                let range_parts: Vec<&str> = segment.split('-').collect();
                range_parts.iter().all(|num| {
                    if let Ok(n) = num.parse::<u32>() {
                        n <= max_values[i]
                    } else {
                        false
                    }
                })
            });
            if !valid {
                return false;
            }
            continue;
        }
        if !cron_patterns[i].is_match(part) {
            return false;
        }
    }

    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_workflow() {
        let content = r#"
import { defineWorkflow } from '@workway/sdk';

export default defineWorkflow({
    name: 'Test Workflow',
    type: 'integration',
    trigger: webhook({ service: 'stripe', event: 'payment.succeeded' }),
    pricing: { model: 'subscription', price: 10, executions: 100 },
    async execute({ trigger }) {
        return { success: true };
    }
});
"#;
        let result = validate_workflow(content);
        assert!(result.valid);
        assert!(result.errors.is_empty());
    }

    #[test]
    fn test_missing_sdk_import() {
        let content = "export default { name: 'test' }";
        let result = validate_workflow(content);
        assert!(!result.valid);
        assert!(result.errors.iter().any(|e| e.code == "MISSING_SDK_IMPORT"));
    }

    #[test]
    fn test_cron_validation() {
        assert!(is_valid_cron("0 8 * * *"));
        assert!(is_valid_cron("*/15 * * * *"));
        assert!(is_valid_cron("0 0 1 * *"));
        assert!(!is_valid_cron("invalid"));
        assert!(!is_valid_cron("0 25 * * *")); // Invalid hour
    }
}
