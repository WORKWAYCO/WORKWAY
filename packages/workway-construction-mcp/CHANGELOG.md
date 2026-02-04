# Changelog

All notable changes to the WORKWAY Construction MCP server will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial MCP server implementation
- Workflow lifecycle tools (create, configure, deploy, test)
- Procore integration tools (connect, list projects, fetch RFIs/daily logs/submittals)
- Debugging tools (diagnose, get_unstuck, observe_execution)
- OAuth 2.0 integration with Procore
- D1 database schema for workflows and executions
- Durable Objects for workflow state management
- AI Interaction Atlas integration for observability

### Changed
- N/A (initial release)

### Deprecated
- N/A

### Removed
- N/A

### Fixed
- N/A

### Security
- OAuth token encryption
- Secure secret management
- Input validation with Zod schemas
- SQL injection prevention

---

## [0.1.0] - 2026-02-03

### Added
- Initial release
- Core workflow automation tools
- Procore API integration
- MCP protocol implementation
- Comprehensive documentation

---

## Version History

- **0.1.0** (2026-02-03) - Initial release

---

## Types of Changes

- **Added** - New features
- **Changed** - Changes in existing functionality
- **Deprecated** - Soon-to-be removed features
- **Removed** - Removed features
- **Fixed** - Bug fixes
- **Security** - Security improvements

---

## Migration Guides

### Upgrading from Previous Versions

When upgrading, check this section for breaking changes and migration steps.

---

## Release Notes Format

Each version should include:

1. **Version number** (following SemVer)
2. **Release date**
3. **Changes** organized by type
4. **Migration notes** (if applicable)
5. **Deprecation notices** (if applicable)

---

## Contributing

When adding entries to the changelog:

1. Add entries under `[Unreleased]` section
2. Use present tense ("Add feature" not "Added feature")
3. Group related changes
4. Reference issues/PRs when applicable
5. Move to version section on release
