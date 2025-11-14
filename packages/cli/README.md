# @workway/cli

WORKWAY CLI - Build, test, and publish workflows and integrations

## Installation

```bash
npm install -g @workway/cli
```

## Quick Start

```bash
# Authenticate
workway login

# Check authentication
workway whoami

# Create a workflow
workway workflow init my-workflow

# Test locally
cd my-workflow
workway workflow test --mock

# Publish to marketplace
workway workflow publish
```

## Commands

### Authentication

- `workway login` - Authenticate with WORKWAY platform
- `workway logout` - Clear local authentication
- `workway whoami` - Display current authenticated user

### Workflow Development (Coming Soon)

- `workway workflow init [name]` - Create a new workflow project
- `workway workflow dev` - Start development server with hot reload
- `workway workflow test` - Test workflow execution
  - `--mock` - Use mocked integrations
  - `--live` - Use live OAuth connections
- `workway workflow build` - Build workflow for production
- `workway workflow publish` - Publish workflow to marketplace
  - `--draft` - Publish as draft

### OAuth Management (Coming Soon)

- `workway oauth connect [provider]` - Connect an OAuth account
- `workway oauth list` - List connected OAuth accounts
- `workway oauth disconnect [provider]` - Disconnect an OAuth account

### Developer Profile (Coming Soon)

- `workway developer register` - Register as a workflow developer
- `workway developer profile` - View/edit developer profile
- `workway developer earnings` - View earnings and payouts

## Configuration

Global config is stored in `~/.workway/config.json`:

```json
{
  "apiUrl": "https://marketplace-api.half-dozen.workers.dev",
  "credentials": {
    "token": "...",
    "userId": "...",
    "email": "..."
  },
  "oauth": {
    "callbackPort": 3456
  }
}
```

Project config can be defined in `workway.config.json`:

```json
{
  "dev": {
    "port": 3000,
    "hotReload": true,
    "mockMode": true
  },
  "test": {
    "testDataFile": "./test-data.json",
    "timeout": 30000
  }
}
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run dev

# Test
npm test

# Link locally for testing
npm link
```

## License

MIT © WORKWAY Team
