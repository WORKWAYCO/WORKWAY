# WORKWAY Architecture

> **Aletheia (Unconcealment)**: This document reveals the true structure of WORKWAY to enable informed understanding.

## System Overview

WORKWAY consists of **four layers**, some open-source and some proprietary:

```
┌─────────────────────────────────────────────────────────────┐
│                         PLATFORM                             │
│                      (Proprietary)                           │
│                                                              │
│   ┌─────────────────────────────────────────────────────┐   │
│   │                  WORKFLOW ENGINE                     │   │
│   │               (Proprietary Runtime)                  │   │
│   └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ API calls
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                          SDK                                 │
│                    (Open Source - Apache 2.0)                │
│                                                              │
│   @workwayco/sdk                                            │
│   - Integration SDK: OAuth, API connections                  │
│   - Workflow SDK: ActionResult<T>, workflow patterns         │
│   - Workers AI: Cloudflare AI model wrappers                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ imports
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                          CLI                                 │
│                    (Open Source - Apache 2.0)                │
│                                                              │
│   @workwayco/cli                                            │
│   - workflow init/test/build/publish                         │
│   - oauth connect/list/disconnect                            │
│   - developer register/profile/earnings                      │
└─────────────────────────────────────────────────────────────┘
```

## Layer Boundaries

### Open Source (This Repository)

| Component | Purpose | License |
|-----------|---------|---------|
| `packages/cli` | Developer tooling | Apache 2.0 |
| `packages/sdk` | Integration & workflow patterns | Apache 2.0 |

### Proprietary (Not in This Repository)

| Component | Purpose | Access |
|-----------|---------|--------|
| Platform API | User management, billing, marketplace | SaaS only |
| Workflow Engine | Execution runtime, scheduling | SaaS only |
| Dashboard | Web interface | SaaS only |

## Data Flow

```
Developer                          WORKWAY Platform
────────                          ────────────────

  [workflow.ts]
       │
       ▼
  workway test ──────────────────► Mock execution (local)
       │
       ▼
  workway build ──────────────────► Bundle workflow
       │
       ▼
  workway publish ───────────────► Upload to Platform
                                          │
                                          ▼
                              ┌─────────────────────┐
                              │   Workflow Engine   │
                              │   (executes code)   │
                              └─────────────────────┘
                                          │
                                          ▼
                              ┌─────────────────────┐
                              │  Integration APIs   │
                              │  (Gmail, Notion,    │
                              │   Slack, etc.)      │
                              └─────────────────────┘
```

## Why This Split?

**Philosophy**: WORKWAY follows the "Less, but better" principle by providing:

1. **Open tools** for building workflows (SDK + CLI)
2. **Managed infrastructure** for running workflows (Platform)

This allows developers to:
- Build locally without infrastructure
- Test without external dependencies
- Deploy without operations burden

## Self-Hosting

Currently, WORKWAY is **not self-hostable**. The Workflow Engine is proprietary and runs only on WORKWAY infrastructure.

If you need self-hosted workflow automation, consider:
- [Temporal](https://temporal.io/) - Open source workflow orchestration
- [n8n](https://n8n.io/) - Open source workflow automation
- [Windmill](https://windmill.dev/) - Open source developer platform

## Package Dependencies

```
@workwayco/cli
    └── (no dependency on @workwayco/sdk)

@workwayco/sdk
    └── zod (validation)
```

The CLI and SDK are **independent packages**. The CLI does not import from the SDK - this is intentional to keep the CLI lightweight.

## Environment Configuration

### CLI Configuration

```
~/.workway/
├── config.json        # API endpoints, preferences
├── oauth/             # OAuth tokens (encrypted)
└── credentials.json   # Auth tokens (encrypted)
```

### Workflow Project Structure

```
my-workflow/
├── workflow.ts        # Main workflow code
├── workway.config.json # Workflow metadata
├── test-data.json     # Test fixtures
└── package.json       # Dependencies
```

## Design Patterns: Weniger, aber besser

> "Less, but better" - Dieter Rams

WORKWAY applies configuration-driven patterns to eliminate duplication while maintaining clarity.

### OAuth Token Refresh (workway-platform)

Instead of separate refresh handlers per provider:

```typescript
// REFRESH_CONFIGS: Adding a new provider = 8 lines
const REFRESH_CONFIGS: Record<string, RefreshConfig> = {
  google: {
    tokenUrl: 'https://oauth2.googleapis.com/token',
    authMethod: 'body',
    contentType: 'form',
    clientIdKey: 'GOOGLE_CLIENT_ID',
    clientSecretKey: 'GOOGLE_CLIENT_SECRET',
    keepOldRefreshToken: true,
  },
  // Add new providers here...
};

// PROVIDER_TO_CONFIG: Map service names to config
const PROVIDER_TO_CONFIG: Record<string, string> = {
  gmail: 'google',
  'google-sheets': 'google',
  slack: 'slack',
  // Add new mappings here...
};
```

**Error Classification**: OAuth errors are typed for actionable handling:
- `retryable: true` → exponential backoff
- `requiresReauth: true` → prompt user to reconnect
- `type: 'config_error'` → alert admin

### Workers AI Operations (SDK)

All AI operations use a shared executor:

```typescript
// Single helper handles all error patterns
private async executeAIOperation<T>(
  model: string,
  input: any,
  operationName: string,
  extractResult: (response: any) => AIOperationResult<T>
): Promise<ActionResult>

// Methods become declarative
async generateEmbeddings(options) {
  return this.executeAIOperation(
    options.model || AIModels.BGE_BASE,
    { text: options.text },
    'Embedding generation',
    (response) => ({
      data: response.data,
      metadata: { dimensions: response.data[0]?.length }
    })
  );
}
```

### Vectorize Embedding Pipeline (SDK)

AI-dependent operations share helpers:

```typescript
// Check AI availability once
private requireAI(operation: string): ActionResult | null

// Centralized embedding generation
private async getEmbeddings(text, model): Promise<{
  success: true; embeddings: number[][]
} | {
  success: false; error: ActionResult
}>
```

## Contributing

Contributions are welcome to the open source components (CLI and SDK). See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

For feature requests related to the proprietary platform, please use [GitHub Issues](https://github.com/workwayco/workway/issues).

---

*This architecture document reflects the honest state of WORKWAY as of December 2024. Following the Heideggerian principle of Aletheia, we believe developers deserve to understand what they're building with.*
