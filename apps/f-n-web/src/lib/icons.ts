/**
 * Centralized Icon Exports for F→N
 *
 * Canon Principle #10: As Little Design as Possible
 * - Single source of truth for all icons
 * - No duplicate imports across routes
 * - Semantic groupings for different use cases
 *
 * Icon Size Scale (16, 20, 24px):
 * - ICON_SM (16px): Inline icons, small UI elements, badges
 * - ICON_MD (20px): Default icons, buttons, cards
 * - ICON_LG (24px): Header icons, hero elements
 */

// Re-export all icons from lucide-svelte
export {
	// Integration icons
	Mic,        // Fireflies
	BookOpen,   // Notion

	// Status icons
	Check,      // Success
	X,          // Error
	Loader2,    // Loading/Running

	// Landing page icons
	Search,     // Feature: Database entries
	Link,       // Feature: Relation properties
	RefreshCw,  // Feature: Bulk import

	// UI icons
	ChevronDown // Dropdowns
} from 'lucide-svelte';

/**
 * Icon Size Constants
 * Use these for consistent sizing across the app.
 *
 * Usage: <Icon size={ICON_SM} />
 */
export const ICON_SM = 16;  // Inline icons, small UI elements, badges
export const ICON_MD = 20;  // Default icons, buttons, cards
export const ICON_LG = 24;  // Header icons, hero elements

/**
 * Integration icon mapping
 * Use: INTEGRATION_ICONS.fireflies
 */
export const INTEGRATION_ICONS = {
	fireflies: 'Mic',
	notion: 'BookOpen',
} as const;

/**
 * Status icon mapping
 * Use: STATUS_ICONS.success
 */
export const STATUS_ICONS = {
	success: 'Check',
	error: 'X',
	running: 'Loader2',
} as const;
