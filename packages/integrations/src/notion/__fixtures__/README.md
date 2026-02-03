# Notion Integration Test Fixtures

Realistic mock responses for testing Notion integration without credentials.

## Files

- **`responses.ts`** - Pre-built fixtures matching real Notion API responses
- **`../test-utils.ts`** - Helper functions for creating test data
- **`../notion-fixtures.test.ts`** - Example tests using fixtures

## Usage

### Pre-built Fixtures

Use pre-built fixtures for common scenarios:

```typescript
import { mockDatabase, mockPage, mockQueryEmpty } from './__fixtures__/responses.js';
import { mockNotionResponse } from './test-utils.js';

// Test with realistic database structure
vi.spyOn(global, 'fetch').mockResolvedValue(
  mockNotionResponse(mockDatabase)
);

const result = await notion.getDatabase('db-123');
expect(result.data?.properties).toHaveProperty('Name');
```

### Test Utilities

Create custom mock data on the fly:

```typescript
import { createYouTubeVideoPage, mockNotionResponse } from './test-utils.js';

// Create custom video page
const videoPage = createYouTubeVideoPage({
  title: 'My Video',
  url: 'https://youtube.com/watch?v=abc123',
  channel: 'My Channel',
  published: '2024-01-15'
});

vi.spyOn(global, 'fetch').mockResolvedValue(
  mockNotionResponse(mockQueryResponse([videoPage]))
);
```

## Available Fixtures

### Databases

- `mockDatabase` - YouTube Videos database with standard schema

### Pages

- `mockPage` - Video page with all properties
- `createMockPage()` - Generate custom pages
- `createYouTubeVideoPage()` - YouTube-specific pages

### Blocks

- `mockBlock` - Paragraph block with transcript text
- `createTranscriptBlock()` - Custom transcript blocks

### Query Responses

- `mockQueryEmpty` - Empty results
- `mockQueryWithResults` - Results with pages
- `mockQueryPaginated` - Results with pagination

### Errors

- `mockErrorRateLimited` - 429 rate limit error
- `mockErrorInvalidRequest` - 400 validation error
- `mockErrorNotFound` - 404 not found error
- `mockErrorUnauthorized` - 401 unauthorized error

## Helpers

### `mockNotionResponse(data, status, headers)`

Create a Response object for fetch mocking:

```typescript
vi.spyOn(global, 'fetch').mockResolvedValue(
  mockNotionResponse({ object: 'page', id: 'test-123' })
);
```

### `mockNotionError(code, message, status)`

Create error responses:

```typescript
vi.spyOn(global, 'fetch').mockResolvedValue(
  mockNotionError('validation_error', 'Invalid properties', 400)
);
```

### `batchWithDelay(items, batchSize, delayMs, fn)`

Test rate limiting behavior:

```typescript
await batchWithDelay(items, 3, 350, async (item) => {
  await processItem(item);
});
```

## Schema: YouTube Videos Database

The fixtures match the schema used by `youtube-playlist-sync` workflow:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| Name | Title | Yes | Video title |
| URL | URL | Yes | YouTube URL |
| Channel | Rich Text | No | Channel name |
| Published | Date | No | Publish date |

## Example Test

See `notion-fixtures.test.ts` for complete examples:

```typescript
describe('queryDatabase with fixtures', () => {
  it('should check for duplicate YouTube video', async () => {
    const videoPage = createYouTubeVideoPage({
      title: 'Color Correction Tutorial',
      url: 'https://www.youtube.com/watch?v=4zcffN53c_g',
      channel: 'Whitcombe Media',
      published: '2024-01-15',
    });

    vi.spyOn(global, 'fetch').mockResolvedValue(
      mockNotionResponse(mockQueryResponse([videoPage]))
    );

    const result = await notion.queryDatabase({
      databaseId: 'db-youtube',
      filter: {
        property: 'URL',
        url: { equals: 'https://www.youtube.com/watch?v=4zcffN53c_g' },
      },
    });

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
  });
});
```

## Design Principles

**Weniger, aber besser** - The fixtures provide:

1. **Realistic data** - Matches actual Notion API responses
2. **Reusable patterns** - Common scenarios pre-built
3. **Flexible helpers** - Create custom data when needed
4. **No credentials** - Tests run without API tokens

## Zuhandenheit

The fixtures recede:
- Import once, use everywhere
- Pre-built for common workflows
- Helpers for custom scenarios
- Tests focus on logic, not mocking
