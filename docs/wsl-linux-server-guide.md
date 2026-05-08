# AI Relay Box WSL / Linux Server Deployment Guide

This guide explains how to deploy AI Relay Box on `WSL` or a plain `Linux server` and manage it from the browser.

## 1. Deployment Shape

The current WSL / Linux server flow includes:

1. `ai-relay-box-core`
2. bundled `ai-mini-gateway` runtime
3. browser-based management UI built from `apps/web`

The default endpoints after installation are:

1. OpenAI-compatible local endpoint: `http://127.0.0.1:3456/v1`
2. Web management UI: `http://127.0.0.1:3456`
3. local models gateway runtime: `http://127.0.0.1:3457/v1`

## 2. Prerequisites

The production installer downloads stable GitHub Release assets by default.

Required commands:

1. `curl`
2. `tar`

Recommended for checksum validation:

1. `sha256sum`
2. or `shasum`

## 3. One-Line Install

Latest release:

```bash
curl -fsSL https://raw.githubusercontent.com/xiaoyuandev/ai-relay-box/main/scripts/install.sh | bash
```

Pinned release:

```bash
curl -fsSL https://raw.githubusercontent.com/xiaoyuandev/ai-relay-box/main/scripts/install.sh | AI_RELAY_BOX_VERSION=vX.Y.Z bash
```

Development-only source install:

```bash
curl -fsSL https://raw.githubusercontent.com/xiaoyuandev/ai-relay-box/main/scripts/install-from-source.sh | bash
```

Notes:

1. `scripts/install.sh` is the production installer.
2. `scripts/install-from-source.sh` is only for development, local validation, or unreleased branches.

## 4. Useful Variables

The production installer supports:

```bash
AI_RELAY_BOX_VERSION=vX.Y.Z
AI_RELAY_BOX_HTTP_PORT=3456
AI_RELAY_BOX_LOCAL_GATEWAY_PORT=3457
AI_RELAY_BOX_INSTALL_ROOT="$HOME/.local/share/ai-relay-box"
AI_RELAY_BOX_DATA_DIR="$HOME/.local/share/ai-relay-box/data"
```

Example:

```bash
curl -fsSL https://raw.githubusercontent.com/xiaoyuandev/ai-relay-box/main/scripts/install.sh | AI_RELAY_BOX_HTTP_PORT=8080 bash
```

## 5. Service Management

The installer creates a `systemd --user` service when available:

```bash
systemctl --user status ai-relay-box
systemctl --user restart ai-relay-box
journalctl --user -u ai-relay-box -n 200 -f
```

It also installs a helper command:

```bash
ai-relay-box start
ai-relay-box stop
ai-relay-box restart
ai-relay-box status
ai-relay-box logs
ai-relay-box run
```

## 6. WSL Notes

From Windows, you can usually open:

```text
http://localhost:3456
```

If `systemd --user` is unavailable inside WSL, use:

```bash
ai-relay-box run
```

## 7. First-Time Setup

After startup:

1. open `http://127.0.0.1:3456`
2. go to `Providers`
3. add an upstream provider
4. point your tool to `http://127.0.0.1:3456/v1`
5. use any non-empty API key such as `dummy`

## 8. Rollback

To roll back to an older stable release, reinstall with a pinned tag:

```bash
curl -fsSL https://raw.githubusercontent.com/xiaoyuandev/ai-relay-box/main/scripts/install.sh | AI_RELAY_BOX_VERSION=vX.Y.Z bash
```

## 9. Troubleshooting

Health:

```bash
curl http://127.0.0.1:3456/health
```

Release metadata:

```bash
curl http://127.0.0.1:3456/api/release
```

Logs:

```bash
journalctl --user -u ai-relay-box -n 200 -f
```
