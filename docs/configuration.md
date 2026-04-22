# PromptMetrics Configuration

## Environment Variables

All configuration is done via environment variables. There is no config file.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3000` | HTTP server port |
| `API_KEY_SALT` | **Yes** | — | Salt for hashing API keys (generate a random string) |
| `DRIVER` | No | `filesystem` | Storage driver: `filesystem` or `github` |
| `SQLITE_PATH` | No | `./data/promptmetrics.db` | Path to the SQLite database file |
| `GITHUB_REPO` | If `DRIVER=github` | — | Repository in `owner/repo` format |
| `GITHUB_TOKEN` | If `DRIVER=github` | — | GitHub PAT or GitHub App installation token |
| `GITHUB_SYNC_INTERVAL_MS` | No | `60000` | Interval between background `git fetch` calls (milliseconds) |
| `OTEL_ENABLED` | No | `false` | Enable OpenTelemetry tracing and metrics |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | If `OTEL_ENABLED=true` | — | OTLP collector URL (e.g., `http://localhost:4318/v1/traces`) |

## Driver Selection Guide

### Use Filesystem When...
- You are running locally or in a single container
- You want zero external dependencies
- You mount a volume for persistence
- You don't need team collaboration on prompts

### Use GitHub When...
- Multiple developers edit prompts
- You want pull request workflows for prompt changes
- You need audit history beyond the SQLite audit_logs table
- You want branches for A/B testing prompt variants

## GitHub Setup

### Option A: Personal Access Token (PAT)

Best for personal projects and small teams.

1. Go to **GitHub Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)**
2. Generate a new token with these scopes:
   - `repo` — full repository access
3. Copy the token and set it as `GITHUB_TOKEN`
4. Set `GITHUB_REPO` to your repo in `owner/repo` format

### Option B: GitHub App (Recommended for Production)

Best for organizations. The App acts on behalf of the installation, not a user.

1. Go to **GitHub Settings** → **Developer settings** → **GitHub Apps** → **New GitHub App**
2. Fill in the app name, homepage URL, and webhook URL (can be a placeholder if you don't use webhooks)
3. Set repository permissions:
   - **Contents**: Read & Write
   - **Metadata**: Read
4. Install the App on your repository
5. Generate an **installation access token** via the GitHub API
6. Use that token as `GITHUB_TOKEN`

## SQLite Tuning

PromptMetrics uses SQLite in **WAL mode** by default. This is the best general-purpose mode and requires no tuning for most workloads.

### Backup

SQLite databases are single files. Back them up however you back up files:

```bash
# While the server is running (WAL mode supports hot backups)
cp data/promptmetrics.db data/promptmetrics.db.backup
cp data/promptmetrics.db-wal data/promptmetrics.db-wal.backup
```

Or use the `.backup` command via the `sqlite3` CLI for a guaranteed consistent snapshot.

### Performance

For workloads heavier than a few writes per second:
- Ensure the database file lives on a local SSD (not a network share)
- If running in Docker, mount a volume for `./data` instead of using the container's overlay filesystem

## Docker Deployment

```bash
docker run -d \
  -p 3000:3000 \
  -e API_KEY_SALT=$(openssl rand -hex 32) \
  -e DRIVER=github \
  -e GITHUB_REPO=your-org/prompts \
  -e GITHUB_TOKEN=ghp_xxxx \
  -v promptmetrics-data:/app/data \
  promptmetrics
```

## NPM Deployment

```bash
npm install -g promptmetrics
API_KEY_SALT=$(openssl rand -hex 32) promptmetrics-server
```

## Generating an API Key

```bash
node dist/scripts/generate-api-key.js <name> <scopes>
# Example:
node dist/scripts/generate-api-key.js default read,write
# => pm_xxxxxxxx... (store this securely)
```

The command outputs the raw key **once**. Only the hash is stored in SQLite. If you lose the key, generate a new one.

## Webhooks (GitHub Driver)

If you configure a GitHub App webhook, you can trigger an immediate `git fetch` instead of waiting for the background sync interval. The webhook endpoint is not built into PromptMetrics — you would run a small sidecar or use a CI job to call your own refresh logic. The background sync job handles 99% of use cases without additional infrastructure.
