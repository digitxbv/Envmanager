# @envmanager-cli/cli

Official CLI for [EnvManager](https://envmanager.dev) - secure environment variable management for development teams.

## Installation

```bash
# npm
npm install -g @envmanager-cli/cli

# Homebrew (macOS/Linux)
brew install shintaii/tap/envmanager
```

## Quick Start

```bash
# Login to EnvManager
envmanager login

# Pull environment variables
envmanager pull

# Push local changes
envmanager push

# Compare local vs remote
envmanager diff
```

## Commands

| Command | Description |
|---------|-------------|
| `login` | Authenticate with EnvManager |
| `logout` | Clear stored credentials |
| `whoami` | Show current user info |
| `pull` | Download variables to .env file |
| `push` | Upload variables from .env file |
| `diff` | Compare local and remote variables |
| `list` | List projects and environments |
| `config` | Manage CLI configuration |
| `dev` | Real-time sync during development |
| `template` | Manage .env templates |
| `validate` | Validate against schema |
| `completion` | Generate shell completion script |
| `debug` | Collect diagnostic info for troubleshooting |

## Shell Completion

Enable tab completion for commands, options, and your actual project/environment names.

### Homebrew Users

If you installed via Homebrew and have [shell completion configured](https://docs.brew.sh/Shell-Completion), it works automatically.

### npm Users

Add one of these to your shell config:

**Bash** (`~/.bashrc` or `~/.bash_profile`):
```bash
eval "$(envmanager completion bash)"
```

**Zsh** (`~/.zshrc`):
```bash
eval "$(envmanager completion zsh)"
```

**Fish**:
```bash
envmanager completion fish > ~/.config/fish/completions/envmanager.fish
```

Then restart your shell or run `source ~/.bashrc` (or equivalent).

## Using Friendly IDs

Projects and environments have friendly IDs (like `#1`, `#2`) that are easier to use than UUIDs.

```bash
# List projects to see their IDs
envmanager list projects
#  #1   my-api (My Organization)
#  #2   my-webapp (My Organization)

# Use friendly ID instead of UUID
envmanager pull --project 1 --environment development

# Also works with names
envmanager pull --project my-api --environment production
```

### Default Environment

When `-e` / `--environment` is omitted, it defaults to `development`. You can override the default in `envmanager.json`:

```json
{
  "environment": "staging"
}
```

### Multiple Organizations

If you belong to multiple organizations, the CLI auto-detects the organization from your project when possible. Use `--org` to specify explicitly if needed:

```bash
envmanager pull --org "My Company" --project 1 --environment staging
```

Single-organization users don't need `--org` - it's auto-selected.

## CI/CD Usage

Set `ENVMANAGER_API_KEY` environment variable for non-interactive authentication:

```yaml
# GitHub Actions example
- name: Pull env vars
  env:
    ENVMANAGER_API_KEY: ${{ secrets.ENVMANAGER_API_KEY }}
  run: envmanager pull --org "My Company" --project 1 --env production
```

Note: When using API keys, `--org` must match the organization the API key was created for.

## Telemetry

The CLI collects **anonymous usage analytics** so we can tell whether features
actually work for people (e.g. whether a `pull` succeeds after install). We send
command names, success/failure, error categories, counts and durations only.

**We never send** your variable names, values, file contents, file paths, or
organization/project/environment names.

It is automatically disabled when you point the CLI at a self-hosted or local API
endpoint. To opt out:

```bash
envmanager config telemetry off      # persist the choice
envmanager config telemetry status   # check current state

# or via environment variables
export ENVMANAGER_TELEMETRY=0
export DO_NOT_TRACK=1                 # honored too
```

## Documentation

Full documentation available at [envmanager.dev/docs/cli](https://envmanager.dev/docs/cli)

## Support

- Documentation: https://envmanager.dev/docs
- Email: support@envmanager.dev

## License

Proprietary - see LICENSE file. This software requires an active EnvManager subscription.
