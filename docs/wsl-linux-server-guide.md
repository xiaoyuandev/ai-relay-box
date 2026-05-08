# Clash for AI WSL / Linux Server Deployment Guide

This guide explains how to deploy Clash for AI on `WSL` or a plain `Linux server` and manage it from the browser.

## 1. Deployment Shape

The current WSL / Linux server flow includes:

1. `clash-for-ai-core`
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
curl -fsSL https://raw.githubusercontent.com/xiaoyuandev/clash-for-ai/main/scripts/install.sh | bash
```

Pinned release:

```bash
curl -fsSL https://raw.githubusercontent.com/xiaoyuandev/clash-for-ai/main/scripts/install.sh | CLASH_FOR_AI_VERSION=v0.1.0 bash
```

Development-only source install:

```bash
curl -fsSL https://raw.githubusercontent.com/xiaoyuandev/clash-for-ai/main/scripts/install-from-source.sh | bash
```

Notes:

1. `scripts/install.sh` is the production installer.
2. `scripts/install-from-source.sh` is only for development, local validation, or unreleased branches.

## 4. Useful Variables

The production installer supports:

```bash
CLASH_FOR_AI_VERSION=v0.1.0
CLASH_FOR_AI_HTTP_PORT=3456
CLASH_FOR_AI_LOCAL_GATEWAY_PORT=3457
CLASH_FOR_AI_INSTALL_ROOT="$HOME/.local/share/clash-for-ai"
CLASH_FOR_AI_DATA_DIR="$HOME/.local/share/clash-for-ai/data"
```

Example:

```bash
curl -fsSL https://raw.githubusercontent.com/xiaoyuandev/clash-for-ai/main/scripts/install.sh | CLASH_FOR_AI_HTTP_PORT=8080 bash
```

## 5. Service Management

The installer creates a `systemd --user` service when available:

```bash
systemctl --user status clash-for-ai
systemctl --user restart clash-for-ai
journalctl --user -u clash-for-ai -n 200 -f
```

It also installs a helper command:

```bash
clash-for-ai start
clash-for-ai stop
clash-for-ai restart
clash-for-ai status
clash-for-ai logs
clash-for-ai run
```

## 6. WSL Notes

From Windows, you can usually open:

```text
http://localhost:3456
```

If `systemd --user` is unavailable inside WSL, use:

```bash
clash-for-ai run
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
curl -fsSL https://raw.githubusercontent.com/xiaoyuandev/clash-for-ai/main/scripts/install.sh | CLASH_FOR_AI_VERSION=v0.1.0 bash
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
journalctl --user -u clash-for-ai -n 200 -f
```
