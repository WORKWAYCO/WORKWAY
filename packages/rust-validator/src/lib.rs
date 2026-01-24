//! WORKWAY Workflow Validator - Rust/WASM Implementation
//!
//! This crate provides a high-performance workflow validator that can be
//! compiled to WebAssembly for use in the WORKWAY CLI. It implements the
//! same validation rules as the TypeScript validator but with pre-compiled
//! regex patterns for significantly better performance.
//!
//! ## Usage from JavaScript
//!
//! ```javascript
//! import { validate_workflow_wasm } from '@workwayco/rust-validator';
//!
//! const result = validate_workflow_wasm(workflowContent);
//! console.log(result.valid);
//! console.log(result.errors);
//! ```

mod patterns;
mod validator;

use wasm_bindgen::prelude::*;
use serde_wasm_bindgen;

/// Initialize panic hook for better error messages in WASM
#[wasm_bindgen(start)]
pub fn init() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

/// Validate a workflow file content and return the result as a JS object.
///
/// This is the main entry point for WASM usage. It takes workflow content
/// as a string and returns a validation result that can be used directly
/// in JavaScript.
///
/// # Arguments
/// * `content` - The workflow file content as a string
///
/// # Returns
/// A JavaScript object with:
/// - `valid`: boolean indicating if the workflow is valid
/// - `errors`: array of validation errors
/// - `warnings`: array of validation warnings
/// - `metadata`: extracted workflow metadata
#[wasm_bindgen]
pub fn validate_workflow_wasm(content: &str) -> Result<JsValue, JsValue> {
    let result = validator::validate_workflow(content);
    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsValue::from_str(&e.to_string()))
}

/// Get the version of the validator
#[wasm_bindgen]
pub fn get_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// Check if the WASM module is properly loaded
#[wasm_bindgen]
pub fn health_check() -> bool {
    true
}

// Re-export for native Rust usage
pub use validator::{
    validate_workflow,
    ValidationResult,
    ValidationError,
    ValidationWarning,
    WorkflowMetadata,
};
