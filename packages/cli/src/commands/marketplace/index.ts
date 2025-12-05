/**
 * Marketplace Commands
 *
 * Discover and explore workflows from the WORKWAY marketplace.
 * CLI-first DX: "Weniger, aber besser"
 *
 * The Pathway Model (Heideggerian Discovery):
 * - `needs` - Outcome-based discovery (recommended)
 * - `browse` - Category-based browsing (deprecated)
 * - `search` - Text search (legacy)
 * - `info` - Workflow details
 */

// Pathway model (recommended)
export { marketplaceNeedsCommand } from './needs.js';

// Legacy commands (deprecated)
export { marketplaceSearchCommand } from './search.js';
export { marketplaceBrowseCommand } from './browse.js';
export { marketplaceInfoCommand } from './info.js';
