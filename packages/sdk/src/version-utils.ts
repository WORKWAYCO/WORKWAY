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
 * WORKWAY Version Utilities
 *
 * Utilities for managing workflow versions including semver parsing,
 * comparison, and bump operations.
 *
 * @example
 * ```typescript
 * import { parseVersion, bumpVersion, isNewerVersion } from '@workway/sdk';
 *
 * const current = parseVersion('1.2.3');
 * // { major: 1, minor: 2, patch: 3 }
 *
 * const next = bumpVersion('1.2.3', 'minor');
 * // '1.3.0'
 *
 * const isNewer = isNewerVersion('1.3.0', '1.2.3');
 * // true
 * ```
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Parsed semver version
 */
export interface ParsedVersion {
    major: number;
    minor: number;
    patch: number;
    prerelease?: string;
    build?: string;
}

/**
 * Version bump type
 */
export type BumpType = 'major' | 'minor' | 'patch';

/**
 * Workflow version state
 */
export type VersionState = 'draft' | 'published' | 'deprecated';

/**
 * Workflow version info returned from API
 */
export interface WorkflowVersion {
    id: string;
    integrationId: string;
    versionNumber: number;
    versionSemver?: string;
    workflowDefinition: Record<string, unknown>;
    configSchema?: Record<string, unknown>;
    requiredOauthProviders?: string[];
    notes?: string;
    isBreakingChange?: boolean;
    breakingChangeDescription?: string;
    state: VersionState;
    createdBy?: string;
    publishedBy?: string;
    createdAt?: number;
    publishedAt?: number;
    deprecatedAt?: number;
}

// ============================================================================
// SEMVER PARSING
// ============================================================================

/**
 * Parse a semver version string
 *
 * @param version - Version string (e.g., "1.2.3", "1.2.3-beta.1", "1.2.3+build.123")
 * @returns Parsed version object or null if invalid
 *
 * @example
 * ```typescript
 * parseVersion('1.2.3')
 * // { major: 1, minor: 2, patch: 3 }
 *
 * parseVersion('2.0.0-alpha.1')
 * // { major: 2, minor: 0, patch: 0, prerelease: 'alpha.1' }
 * ```
 */
export function parseVersion(version: string): ParsedVersion | null {
    // Semver regex pattern
    const semverRegex = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
    const match = version.match(semverRegex);
    
    if (!match) {
        return null;
    }
    
    const parsed: ParsedVersion = {
        major: parseInt(match[1], 10),
        minor: parseInt(match[2], 10),
        patch: parseInt(match[3], 10),
    };
    
    if (match[4]) {
        parsed.prerelease = match[4];
    }
    
    if (match[5]) {
        parsed.build = match[5];
    }
    
    return parsed;
}

/**
 * Format a parsed version back to a string
 *
 * @param version - Parsed version object
 * @returns Version string
 *
 * @example
 * ```typescript
 * formatVersion({ major: 1, minor: 2, patch: 3 })
 * // '1.2.3'
 * ```
 */
export function formatVersion(version: ParsedVersion): string {
    let result = `${version.major}.${version.minor}.${version.patch}`;
    
    if (version.prerelease) {
        result += `-${version.prerelease}`;
    }
    
    if (version.build) {
        result += `+${version.build}`;
    }
    
    return result;
}

// ============================================================================
// VERSION COMPARISON
// ============================================================================

/**
 * Compare two version strings
 *
 * @param a - First version
 * @param b - Second version
 * @returns -1 if a < b, 0 if a === b, 1 if a > b
 *
 * @example
 * ```typescript
 * compareVersions('1.2.3', '1.2.4')  // -1
 * compareVersions('2.0.0', '1.9.9')  // 1
 * compareVersions('1.0.0', '1.0.0')  // 0
 * ```
 */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
    const parsedA = parseVersion(a);
    const parsedB = parseVersion(b);
    
    if (!parsedA || !parsedB) {
        // Fall back to string comparison if parsing fails
        if (a < b) return -1;
        if (a > b) return 1;
        return 0;
    }
    
    // Compare major
    if (parsedA.major < parsedB.major) return -1;
    if (parsedA.major > parsedB.major) return 1;
    
    // Compare minor
    if (parsedA.minor < parsedB.minor) return -1;
    if (parsedA.minor > parsedB.minor) return 1;
    
    // Compare patch
    if (parsedA.patch < parsedB.patch) return -1;
    if (parsedA.patch > parsedB.patch) return 1;
    
    // If both have no prerelease, they're equal
    if (!parsedA.prerelease && !parsedB.prerelease) return 0;
    
    // Version without prerelease is greater (1.0.0 > 1.0.0-alpha)
    if (!parsedA.prerelease && parsedB.prerelease) return 1;
    if (parsedA.prerelease && !parsedB.prerelease) return -1;
    
    // Compare prerelease strings
    if (parsedA.prerelease! < parsedB.prerelease!) return -1;
    if (parsedA.prerelease! > parsedB.prerelease!) return 1;
    
    return 0;
}

/**
 * Check if version a is newer than version b
 *
 * @param a - First version
 * @param b - Second version
 * @returns true if a > b
 *
 * @example
 * ```typescript
 * isNewerVersion('1.2.0', '1.1.0')  // true
 * isNewerVersion('1.0.0', '1.0.0')  // false
 * ```
 */
export function isNewerVersion(a: string, b: string): boolean {
    return compareVersions(a, b) === 1;
}

/**
 * Check if version a is older than version b
 *
 * @param a - First version
 * @param b - Second version
 * @returns true if a < b
 */
export function isOlderVersion(a: string, b: string): boolean {
    return compareVersions(a, b) === -1;
}

/**
 * Check if two versions are equal
 *
 * @param a - First version
 * @param b - Second version
 * @returns true if a === b
 */
export function isSameVersion(a: string, b: string): boolean {
    return compareVersions(a, b) === 0;
}

// ============================================================================
// VERSION BUMPING
// ============================================================================

/**
 * Bump a version by the specified type
 *
 * @param version - Current version string
 * @param bumpType - Type of bump ('major', 'minor', 'patch')
 * @returns New version string
 *
 * @example
 * ```typescript
 * bumpVersion('1.2.3', 'patch')  // '1.2.4'
 * bumpVersion('1.2.3', 'minor')  // '1.3.0'
 * bumpVersion('1.2.3', 'major')  // '2.0.0'
 * ```
 */
export function bumpVersion(version: string, bumpType: BumpType): string {
    const parsed = parseVersion(version);
    
    if (!parsed) {
        // If parsing fails, try to handle common fallback case
        if (version === '1.0.0') {
            switch (bumpType) {
                case 'major': return '2.0.0';
                case 'minor': return '1.1.0';
                case 'patch': return '1.0.1';
            }
        }
        throw new Error(`Invalid version string: ${version}`);
    }
    
    switch (bumpType) {
        case 'major':
            return formatVersion({
                major: parsed.major + 1,
                minor: 0,
                patch: 0,
            });
        case 'minor':
            return formatVersion({
                major: parsed.major,
                minor: parsed.minor + 1,
                patch: 0,
            });
        case 'patch':
            return formatVersion({
                major: parsed.major,
                minor: parsed.minor,
                patch: parsed.patch + 1,
            });
    }
}

/**
 * Get the next version based on the current version and detected changes
 *
 * @param currentVersion - Current version string
 * @param hasBreakingChanges - Whether there are breaking changes
 * @param hasNewFeatures - Whether there are new features
 * @returns Recommended next version
 *
 * @example
 * ```typescript
 * getNextVersion('1.2.3', true, false)   // '2.0.0' (breaking change)
 * getNextVersion('1.2.3', false, true)   // '1.3.0' (new feature)
 * getNextVersion('1.2.3', false, false)  // '1.2.4' (patch)
 * ```
 */
export function getNextVersion(
    currentVersion: string,
    hasBreakingChanges: boolean,
    hasNewFeatures: boolean
): string {
    if (hasBreakingChanges) {
        return bumpVersion(currentVersion, 'major');
    }
    if (hasNewFeatures) {
        return bumpVersion(currentVersion, 'minor');
    }
    return bumpVersion(currentVersion, 'patch');
}

// ============================================================================
// VERSION DISPLAY
// ============================================================================

/**
 * Format a sequential version number for display
 *
 * @param versionNumber - Sequential version number (1, 2, 3, ...)
 * @returns Formatted display string ("v1", "v2", "v3", ...)
 *
 * @example
 * ```typescript
 * formatVersionDisplay(1)  // 'v1'
 * formatVersionDisplay(23) // 'v23'
 * ```
 */
export function formatVersionDisplay(versionNumber: number): string {
    return `v${versionNumber}`;
}

/**
 * Format a version for combined display (sequential + semver)
 *
 * @param versionNumber - Sequential version number
 * @param semver - Optional semver string
 * @returns Formatted display string
 *
 * @example
 * ```typescript
 * formatVersionFull(3, '1.2.0')  // 'v3 (1.2.0)'
 * formatVersionFull(3)           // 'v3'
 * ```
 */
export function formatVersionFull(versionNumber: number, semver?: string): string {
    const base = formatVersionDisplay(versionNumber);
    return semver ? `${base} (${semver})` : base;
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Check if a string is a valid semver version
 *
 * @param version - Version string to validate
 * @returns true if valid semver
 *
 * @example
 * ```typescript
 * isValidVersion('1.2.3')        // true
 * isValidVersion('1.2.3-beta')   // true
 * isValidVersion('1.2')          // false
 * isValidVersion('v1.2.3')       // false
 * ```
 */
export function isValidVersion(version: string): boolean {
    return parseVersion(version) !== null;
}

/**
 * Normalize a version string to valid semver
 *
 * @param version - Version string (may have 'v' prefix or be incomplete)
 * @returns Normalized version string or null if cannot normalize
 *
 * @example
 * ```typescript
 * normalizeVersion('v1.2.3')  // '1.2.3'
 * normalizeVersion('1.2')     // '1.2.0'
 * normalizeVersion('1')       // '1.0.0'
 * ```
 */
export function normalizeVersion(version: string): string | null {
    // Remove 'v' prefix if present
    let normalized = version.replace(/^v/i, '');
    
    // Try parsing as-is
    if (isValidVersion(normalized)) {
        return normalized;
    }
    
    // Try adding missing parts
    const parts = normalized.split('.');
    if (parts.length === 1 && /^\d+$/.test(parts[0])) {
        normalized = `${parts[0]}.0.0`;
    } else if (parts.length === 2 && /^\d+$/.test(parts[0]) && /^\d+$/.test(parts[1])) {
        normalized = `${parts[0]}.${parts[1]}.0`;
    }
    
    return isValidVersion(normalized) ? normalized : null;
}
