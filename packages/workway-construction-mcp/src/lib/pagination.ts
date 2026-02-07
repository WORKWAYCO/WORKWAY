/**
 * Pagination utilities for MCP list endpoints
 * 
 * Provides consistent pagination handling across all list tools to prevent
 * memory issues with large datasets.
 */

import { z } from 'zod';

// ============================================================================
// Types
// ============================================================================

export interface PaginationParams {
  limit: number;
  offset: number;
}

export interface PaginationResult {
  limit: number;
  offset: number;
  total: number;
  hasMore: boolean;
}

export interface SortParams {
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

// ============================================================================
// Schemas
// ============================================================================

/**
 * Standard pagination schema for offset-based pagination
 */
export const paginationSchema = z.object({
  limit: z.number().min(1).max(100).default(50).optional()
    .describe('Maximum number of items to return (1-100, default 50)'),
  offset: z.number().min(0).default(0).optional()
    .describe('Number of items to skip (default 0)'),
});

/**
 * Sort schema for list endpoints
 */
export const sortSchema = z.object({
  sort_by: z.enum(['created_at', 'updated_at', 'name']).default('updated_at').optional()
    .describe('Field to sort by'),
  sort_order: z.enum(['asc', 'desc']).default('desc').optional()
    .describe('Sort direction'),
});

/**
 * Combined pagination and sort schema
 */
export const paginationWithSortSchema = paginationSchema.merge(sortSchema);

/**
 * Procore API pagination schema (page-based)
 */
export const procorePaginationSchema = z.object({
  page: z.number().min(1).default(1).optional()
    .describe('Page number (1-indexed)'),
  per_page: z.number().min(1).max(100).default(50).optional()
    .describe('Items per page (1-100, default 50)'),
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build pagination result from query results
 */
export function buildPaginationResult(
  limit: number,
  offset: number,
  total: number
): PaginationResult {
  return {
    limit,
    offset,
    total,
    hasMore: offset + limit < total,
  };
}

/**
 * Get default pagination params with fallbacks
 */
export function getPaginationParams(input: {
  limit?: number;
  offset?: number;
}): PaginationParams {
  return {
    limit: input.limit ?? 50,
    offset: input.offset ?? 0,
  };
}

/**
 * Get default sort params with fallbacks
 */
export function getSortParams(input: {
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}, allowedFields: string[] = ['created_at', 'updated_at', 'name']): SortParams {
  const sortBy = input.sort_by && allowedFields.includes(input.sort_by) 
    ? input.sort_by 
    : 'updated_at';
  return {
    sortBy,
    sortOrder: input.sort_order ?? 'desc',
  };
}

/**
 * Build SQL ORDER BY and LIMIT clauses
 */
export function buildPaginationSQL(
  pagination: PaginationParams,
  sort?: SortParams
): { clause: string; params: any[] } {
  let clause = '';
  const params: any[] = [];
  
  if (sort) {
    // Sort field is validated above, safe to interpolate
    clause += ` ORDER BY ${sort.sortBy} ${sort.sortOrder.toUpperCase()}`;
  }
  
  clause += ' LIMIT ? OFFSET ?';
  params.push(pagination.limit, pagination.offset);
  
  return { clause, params };
}

/**
 * Convert offset pagination to page-based for Procore API
 */
export function offsetToPage(offset: number, limit: number): { page: number; per_page: number } {
  return {
    page: Math.floor(offset / limit) + 1,
    per_page: limit,
  };
}

/**
 * Build Procore API pagination query params
 */
export function buildProcorePaginationParams(input: {
  limit?: number;
  offset?: number;
}): string {
  const { limit, offset } = getPaginationParams(input);
  const { page, per_page } = offsetToPage(offset, limit);
  return `page=${page}&per_page=${per_page}`;
}
