# WORKWAY

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![CI](https://github.com/workwayco/workway/actions/workflows/ci.yml/badge.svg)](https://github.com/workwayco/workway/actions/workflows/ci.yml)

Build and monetize TypeScript workflows on the edge. The first marketplace for TypeScript workflow automation.

## 🚀 Quick Start

```bash
# Install the CLI globally
npm install -g @workwayco/cli

# Create a new workflow project
workway init my-workflow

# Start development server
cd my-workflow
npm run dev

# Deploy to the marketplace
workway deploy
```

## 🔧 Features

- **TypeScript-First**: Full type safety and autocomplete
- **50+ AI Models**: Via Cloudflare Workers AI at $0.01/1M tokens
- **Edge Deployment**: <50ms cold starts globally
- **Built-in OAuth**: Gmail, Slack, Notion, GitHub, and more
- **Local Development**: Test workflows locally before deploying
- **Monetization**: Keep 100% of upfront revenue

## 📦 Packages

This monorepo contains:

- [`@workwayco/sdk`](packages/sdk) - Core SDK for building workflows
- [`@workwayco/cli`](packages/cli) - Command-line interface
- [`@workwayco/integrations`](packages/integrations) - Official integrations (Gmail, Slack, Notion)

## 🏗️ Architecture

WORKWAY is two systems:

| Component | Repository | License |
|-----------|------------|---------|
| SDK, CLI, Integrations | This repo (open source) | Apache 2.0 |
| Workflow Engine, Platform API | [workway-platform](https://github.com/workwayco/workway-platform) (private) | Proprietary |

See [ARCHITECTURE.md](docs/ARCHITECTURE.md) for full details.

## 💰 Business Model

- **Developers**: Keep 100% of upfront fees you charge
- **Platform**: 5¢ per light workflow, 25¢ per heavy workflow execution
- **Free Trials**: 20 free runs per workflow for customers

## 📖 Documentation

- [Getting Started](docs/getting-started.md)
- [Building Workflows](docs/workflows.md)
- [API Reference](docs/api-reference.md)
- [Self Hosting](docs/self-hosting.md)

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md).

## 📄 License

Apache 2.0 - see [LICENSE](LICENSE) for details.

## 🔗 Links

- [Website](https://workway.co)
- [Documentation](https://docs.workway.co)
- [Discord Community](https://discord.gg/workway)
- [Twitter](https://twitter.com/workway)
