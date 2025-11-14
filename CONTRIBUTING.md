# Contributing to WORKWAY

Thank you for your interest in contributing to WORKWAY! We welcome contributions from the community and are excited to collaborate with you.

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). Please read it before contributing.

## How Can You Contribute?

### 🐛 Reporting Bugs

Before creating a bug report, please check existing issues to avoid duplicates. When you create a bug report, include:

- A clear and descriptive title
- Steps to reproduce the issue
- Expected behavior
- Actual behavior
- Your environment (OS, Node version, browser, etc.)
- Screenshots or error messages if applicable

### 💡 Suggesting Features

We love new ideas! When suggesting a feature:

- Check if it's already been suggested
- Provide a clear use case
- Explain how it benefits users
- Consider implementation complexity

### 🔧 Pull Requests

1. **Fork the repository** and create your branch from `main`
2. **Follow our coding standards** (see below)
3. **Write tests** for new functionality
4. **Update documentation** as needed
5. **Ensure all tests pass**
6. **Submit a pull request**

## Development Setup

### Prerequisites

- Node.js 18+ and npm 10+
- Cloudflare account (free tier works)
- Git

### Getting Started

```bash
# Fork and clone the repository
git clone https://github.com/YOUR_USERNAME/workway.git
cd workway

# Install dependencies
npm install

# Set up environment variables
cp apps/api/.dev.vars.example apps/api/.dev.vars
# Edit apps/api/.dev.vars with your credentials

# Run tests
npm test

# Start development server
npm run dev
```

### Project Structure

```
workway/
├── packages/
│   ├── sdk/              # Core SDK (open source)
│   ├── workflow-engine/   # Execution engine (open source)
│   ├── cli/              # CLI tools (open source)
│   └── integrations/     # Integration implementations (open source)
├── examples/             # Example workflows (open source)
├── apps/
│   ├── api/             # API server (partially open source)
│   └── web/             # Web UI (proprietary)
└── docs/                # Documentation (open source)
```

## Coding Standards

### TypeScript

We use TypeScript for type safety. Please:

- Use explicit types rather than `any`
- Export interfaces for public APIs
- Use JSDoc comments for public functions
- Prefer `interface` over `type` for object shapes

```typescript
// Good
export interface WorkflowConfig {
  id: string;
  name: string;
  timeout?: number;
}

// Bad
export type WorkflowConfig = any;
```

### Code Style

We use Prettier for formatting. Run `npm run format` before committing.

Key conventions:
- 2 spaces for indentation
- Single quotes for strings
- No semicolons
- Trailing commas in multi-line objects/arrays

### Naming Conventions

- **Files**: kebab-case (`workflow-executor.ts`)
- **Classes**: PascalCase (`WorkflowExecutor`)
- **Functions/Variables**: camelCase (`executeWorkflow`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRIES`)
- **Interfaces**: PascalCase with "I" prefix optional

### Error Handling

Use the SDK's error classes:

```typescript
import { IntegrationError, ErrorCode } from '@workway/sdk';

throw new IntegrationError(
  'Descriptive error message',
  ErrorCode.RATE_LIMIT_ERROR,
  { retryAfter: 60 }
);
```

### Testing

Write tests for all new functionality:

```typescript
import { describe, it, expect } from 'vitest';

describe('WorkflowExecutor', () => {
  it('should execute steps sequentially', async () => {
    // Test implementation
  });
});
```

Run tests with:
```bash
npm test                  # Run all tests
npm test -- --watch      # Watch mode
npm test -- --coverage   # With coverage
```

## Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Test additions or fixes
- `chore`: Maintenance tasks
- `perf`: Performance improvements

### Examples

```
feat(sdk): add support for webhook triggers

Added webhook trigger functionality to the SDK, allowing workflows
to be triggered by incoming HTTP requests.

Closes #123
```

```
fix(engine): handle rate limit errors correctly

The engine now properly retries requests when rate limited,
respecting the retry-after header.
```

## Creating Integrations

To add a new integration:

1. Create a new directory in `packages/integrations/src/`
2. Implement the integration interface
3. Add tests
4. Document the integration
5. Submit a PR

Example structure:
```
packages/integrations/src/my-service/
├── index.ts           # Main integration file
├── actions/          # Action implementations
├── types.ts          # TypeScript types
├── README.md         # Integration documentation
└── __tests__/        # Integration tests
```

## Documentation

- Update README files when changing functionality
- Add JSDoc comments to public APIs
- Include examples in documentation
- Keep documentation concise and clear

## What We Accept

### ✅ We Accept

- Bug fixes
- New integrations
- Documentation improvements
- Test additions
- Performance optimizations
- SDK enhancements
- CLI improvements
- Example workflows

### ❌ We Don't Accept

- Changes to pricing/billing logic (proprietary)
- Marketplace platform modifications (proprietary)
- Analytics/tracking changes (proprietary)
- Breaking changes without discussion
- Code without tests
- Poorly documented features

## Review Process

1. **Automated checks** run on all PRs (tests, linting, type checking)
2. **Code review** by maintainers
3. **Testing** in development environment
4. **Documentation review**
5. **Merge** when approved

Expected timeline:
- Small fixes: 1-3 days
- Features: 3-7 days
- New integrations: 5-10 days

## Contributor License Agreement

By submitting a pull request, you agree that:

1. Your contribution is original work
2. You have the right to submit it under the Apache 2.0 license
3. WORKWAY can use your contribution in both open source and commercial offerings
4. You understand your contribution becomes part of the project

## Getting Help

- **Discord**: [Join our community](https://discord.gg/workway)
- **Discussions**: [GitHub Discussions](https://github.com/workway/workway/discussions)
- **Issues**: [GitHub Issues](https://github.com/workway/workway/issues)
- **Email**: opensource@workway.com

## Recognition

Contributors are recognized in:

- [CONTRIBUTORS.md](CONTRIBUTORS.md) file
- Release notes
- Annual contributor report
- Special badges in Discord

## Release Process

We release on a regular schedule:

- **Patch releases**: As needed for bug fixes
- **Minor releases**: Monthly with new features
- **Major releases**: Annually with breaking changes

## Security

For security vulnerabilities, please DO NOT create a public issue. Instead:

1. Email security@workway.com
2. Include detailed information
3. Allow 90 days for a fix before public disclosure

## Questions?

Feel free to ask in:
- GitHub Discussions for general questions
- Discord for real-time help
- Issues for specific problems

Thank you for contributing to WORKWAY! 🎉