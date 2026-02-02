/**
 * Copyright 2024 WORKWAY
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Breaking Change Detector
 *
 * Utilities for detecting breaking changes between workflow versions.
 * Helps enterprises understand the impact of version updates.
 *
 * @example
 * ```typescript
 * import { detectBreakingChanges } from '@workway/sdk';
 *
 * const changes = detectBreakingChanges(oldVersion, newVersion);
 * if (changes.hasBreakingChanges) {
 *   console.warn('Breaking changes detected:', changes.breakingChanges);
 * }
 * ```
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Types of changes detected between versions
 */
export type ChangeType =
    | 'config_field_removed'
    | 'config_field_type_changed'
    | 'config_field_required_added'
    | 'oauth_provider_added'
    | 'oauth_provider_removed'
    | 'trigger_type_changed'
    | 'output_schema_changed'
    | 'step_removed'
    | 'behavior_changed';

/**
 * Severity levels for changes
 */
export type ChangeSeverity = 'breaking' | 'warning' | 'info';

/**
 * A detected change between versions
 */
export interface DetectedChange {
    type: ChangeType;
    severity: ChangeSeverity;
    field?: string;
    message: string;
    oldValue?: unknown;
    newValue?: unknown;
    migrationHint?: string;
}

/**
 * Result of breaking change detection
 */
export interface BreakingChangeResult {
    hasBreakingChanges: boolean;
    hasWarnings: boolean;
    breakingChanges: DetectedChange[];
    warnings: DetectedChange[];
    infoChanges: DetectedChange[];
    allChanges: DetectedChange[];
    summary: string;
}

/**
 * Config schema field definition
 */
export interface ConfigFieldSchema {
    type: string;
    required?: boolean;
    default?: unknown;
    label?: string;
    description?: string;
    options?: unknown[];
}

/**
 * Workflow definition structure (simplified for comparison)
 */
export interface WorkflowDefinitionForComparison {
    configSchema?: Record<string, ConfigFieldSchema>;
    requiredOauthProviders?: string[];
    trigger?: {
        type?: string;
        config?: Record<string, unknown>;
    };
    steps?: Array<{
        id?: string;
        action?: string;
    }>;
    outputSchema?: Record<string, unknown>;
}

// ============================================================================
// DETECTION FUNCTIONS
// ============================================================================

/**
 * Detect breaking changes between two workflow versions
 *
 * @param oldDef - Previous version's workflow definition
 * @param newDef - New version's workflow definition
 * @returns Analysis of changes including breaking changes
 */
export function detectBreakingChanges(
    oldDef: WorkflowDefinitionForComparison,
    newDef: WorkflowDefinitionForComparison
): BreakingChangeResult {
    const changes: DetectedChange[] = [];

    // Detect config schema changes
    changes.push(...detectConfigSchemaChanges(oldDef.configSchema, newDef.configSchema));

    // Detect OAuth provider changes
    changes.push(...detectOAuthChanges(oldDef.requiredOauthProviders, newDef.requiredOauthProviders));

    // Detect trigger changes
    changes.push(...detectTriggerChanges(oldDef.trigger, newDef.trigger));

    // Detect step changes
    changes.push(...detectStepChanges(oldDef.steps, newDef.steps));

    // Categorize changes
    const breakingChanges = changes.filter(c => c.severity === 'breaking');
    const warnings = changes.filter(c => c.severity === 'warning');
    const infoChanges = changes.filter(c => c.severity === 'info');

    return {
        hasBreakingChanges: breakingChanges.length > 0,
        hasWarnings: warnings.length > 0,
        breakingChanges,
        warnings,
        infoChanges,
        allChanges: changes,
        summary: generateSummary(breakingChanges, warnings, infoChanges),
    };
}

/**
 * Detect changes in config schema
 */
function detectConfigSchemaChanges(
    oldSchema?: Record<string, ConfigFieldSchema>,
    newSchema?: Record<string, ConfigFieldSchema>
): DetectedChange[] {
    const changes: DetectedChange[] = [];

    if (!oldSchema && !newSchema) return changes;
    if (!oldSchema) oldSchema = {};
    if (!newSchema) newSchema = {};

    // Check for removed fields
    for (const [fieldName, oldField] of Object.entries(oldSchema)) {
        if (!(fieldName in newSchema)) {
            changes.push({
                type: 'config_field_removed',
                severity: 'breaking',
                field: fieldName,
                message: `Config field "${fieldName}" was removed`,
                oldValue: oldField,
                migrationHint: `Users with this field configured will need to reconfigure their installation`,
            });
        }
    }

    // Check for modified fields
    for (const [fieldName, newField] of Object.entries(newSchema)) {
        const oldField = oldSchema[fieldName];

        if (!oldField) {
            // New field - check if required
            if (newField.required && newField.default === undefined) {
                changes.push({
                    type: 'config_field_required_added',
                    severity: 'breaking',
                    field: fieldName,
                    message: `New required config field "${fieldName}" added without default`,
                    newValue: newField,
                    migrationHint: `Add a default value or make the field optional to avoid breaking existing installations`,
                });
            } else {
                changes.push({
                    type: 'config_field_required_added',
                    severity: 'info',
                    field: fieldName,
                    message: `New config field "${fieldName}" added`,
                    newValue: newField,
                });
            }
            continue;
        }

        // Check type changes
        if (oldField.type !== newField.type) {
            changes.push({
                type: 'config_field_type_changed',
                severity: 'breaking',
                field: fieldName,
                message: `Config field "${fieldName}" type changed from "${oldField.type}" to "${newField.type}"`,
                oldValue: oldField.type,
                newValue: newField.type,
                migrationHint: `Existing configurations may not be compatible with the new type`,
            });
        }

        // Check required status
        if (!oldField.required && newField.required && newField.default === undefined) {
            changes.push({
                type: 'config_field_required_added',
                severity: 'breaking',
                field: fieldName,
                message: `Config field "${fieldName}" became required without a default value`,
                oldValue: { required: oldField.required },
                newValue: { required: newField.required },
                migrationHint: `Provide a default value or existing installations may fail`,
            });
        }
    }

    return changes;
}

/**
 * Detect changes in OAuth provider requirements
 */
function detectOAuthChanges(
    oldProviders?: string[],
    newProviders?: string[]
): DetectedChange[] {
    const changes: DetectedChange[] = [];

    const oldSet = new Set(oldProviders || []);
    const newSet = new Set(newProviders || []);

    // Check for added providers (breaking - users need to connect new service)
    for (const provider of newSet) {
        if (!oldSet.has(provider)) {
            changes.push({
                type: 'oauth_provider_added',
                severity: 'breaking',
                field: provider,
                message: `New OAuth provider "${provider}" required`,
                newValue: provider,
                migrationHint: `Users will need to connect their ${provider} account before the workflow can run`,
            });
        }
    }

    // Check for removed providers (info - fewer requirements)
    for (const provider of oldSet) {
        if (!newSet.has(provider)) {
            changes.push({
                type: 'oauth_provider_removed',
                severity: 'info',
                field: provider,
                message: `OAuth provider "${provider}" no longer required`,
                oldValue: provider,
            });
        }
    }

    return changes;
}

/**
 * Detect changes in trigger configuration
 */
function detectTriggerChanges(
    oldTrigger?: { type?: string; config?: Record<string, unknown> },
    newTrigger?: { type?: string; config?: Record<string, unknown> }
): DetectedChange[] {
    const changes: DetectedChange[] = [];

    if (!oldTrigger && !newTrigger) return changes;

    const oldType = oldTrigger?.type;
    const newType = newTrigger?.type;

    if (oldType && newType && oldType !== newType) {
        changes.push({
            type: 'trigger_type_changed',
            severity: 'breaking',
            message: `Trigger type changed from "${oldType}" to "${newType}"`,
            oldValue: oldType,
            newValue: newType,
            migrationHint: `Existing installations may need to be reconfigured for the new trigger type`,
        });
    }

    return changes;
}

/**
 * Detect changes in workflow steps
 */
function detectStepChanges(
    oldSteps?: Array<{ id?: string; action?: string }>,
    newSteps?: Array<{ id?: string; action?: string }>
): DetectedChange[] {
    const changes: DetectedChange[] = [];

    if (!oldSteps || !newSteps) return changes;

    const oldStepIds = new Set(oldSteps.map(s => s.id).filter(Boolean));
    const newStepIds = new Set(newSteps.map(s => s.id).filter(Boolean));

    // Check for removed steps
    for (const stepId of oldStepIds) {
        if (!newStepIds.has(stepId)) {
            const oldStep = oldSteps.find(s => s.id === stepId);
            changes.push({
                type: 'step_removed',
                severity: 'warning',
                field: stepId,
                message: `Step "${stepId}" (${oldStep?.action || 'unknown action'}) was removed`,
                oldValue: oldStep,
                migrationHint: `This step's functionality will no longer be available`,
            });
        }
    }

    return changes;
}

/**
 * Generate a human-readable summary of changes
 */
function generateSummary(
    breakingChanges: DetectedChange[],
    warnings: DetectedChange[],
    infoChanges: DetectedChange[]
): string {
    const parts: string[] = [];

    if (breakingChanges.length > 0) {
        parts.push(`${breakingChanges.length} breaking change(s)`);
    }
    if (warnings.length > 0) {
        parts.push(`${warnings.length} warning(s)`);
    }
    if (infoChanges.length > 0) {
        parts.push(`${infoChanges.length} informational change(s)`);
    }

    if (parts.length === 0) {
        return 'No changes detected';
    }

    return parts.join(', ');
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if a change is breaking
 */
export function isBreakingChange(change: DetectedChange): boolean {
    return change.severity === 'breaking';
}

/**
 * Get migration hints for breaking changes
 */
export function getMigrationHints(result: BreakingChangeResult): string[] {
    return result.breakingChanges
        .filter(c => c.migrationHint)
        .map(c => c.migrationHint!);
}

/**
 * Format changes for display
 */
export function formatChangesForDisplay(result: BreakingChangeResult): string {
    const lines: string[] = [];

    if (result.breakingChanges.length > 0) {
        lines.push('⛔ BREAKING CHANGES:');
        for (const change of result.breakingChanges) {
            lines.push(`  • ${change.message}`);
            if (change.migrationHint) {
                lines.push(`    → ${change.migrationHint}`);
            }
        }
        lines.push('');
    }

    if (result.warnings.length > 0) {
        lines.push('⚠️  WARNINGS:');
        for (const change of result.warnings) {
            lines.push(`  • ${change.message}`);
        }
        lines.push('');
    }

    if (result.infoChanges.length > 0) {
        lines.push('ℹ️  CHANGES:');
        for (const change of result.infoChanges) {
            lines.push(`  • ${change.message}`);
        }
    }

    return lines.join('\n');
}

/**
 * Create a breaking change summary for version notes
 */
export function createBreakingChangeSummary(result: BreakingChangeResult): string | null {
    if (!result.hasBreakingChanges) {
        return null;
    }

    const breakingItems = result.breakingChanges.map(c => c.message);
    return `BREAKING: ${breakingItems.join('; ')}`;
}
