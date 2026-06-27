# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-01-28

### Added

- **Authentication**
  - OAuth browser authentication with PKCE flow
  - API key authentication for CI/CD pipelines (`ENVMANAGER_API_KEY`)
  - Secure credential storage in `~/.config/envmanager/`
  - Token refresh with automatic retry

- **Commands**
  - `login` - Authenticate via browser OAuth
  - `logout` - Clear stored credentials
  - `whoami` - Display current user and organizations
  - `pull` - Fetch variables to local `.env` file
  - `push` - Upload local `.env` to EnvManager
  - `diff` - Compare local vs remote variables
  - `list` - List projects, environments, and variables
  - `config` - Initialize and manage project configuration
  - `dev` - Real-time sync daemon with file watching
  - `validate` - Validate variables against schema
  - `init` - Initialize project from template
  - `template generate` - Generate template from environment
  - `template sync` - Sync template to match environment
  - `template validate` - Validate template syntax

- **Real-time Sync**
  - Supabase Realtime integration for live updates
  - Local file watching with debouncing
  - Conflict detection and resolution prompts
  - Graceful shutdown handling

- **Templates**
  - `.env.template` file support
  - Variable placeholders with `${VAR_NAME}` syntax
  - Default values with `${VAR_NAME:default}` syntax
  - Comments and documentation support

- **Schema Validation**
  - Zod-based schema validation
  - Integration with `@envmanager/validate` package
  - Type coercion for environment variables
  - Detailed error messages with line numbers

### Security

- Credentials stored with 0o600 file permissions
- API keys exchanged for short-lived JWTs
- No secrets logged or displayed in output
- PKCE flow for OAuth authentication
