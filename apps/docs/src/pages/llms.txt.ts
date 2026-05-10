import type { APIRoute } from "astro";

const summary = `# AI Relay Box

AI Relay Box is a local AI gateway and desktop control panel for managing OpenAI-compatible providers, model sources, and AI coding tools.

It gives Cursor, Claude Code, Codex, Cherry Studio, OpenAI SDK scripts, and other OpenAI-compatible clients one local endpoint:

http://127.0.0.1:3456/v1

Use AI Relay Box when you want to switch providers and models without editing every tool configuration.

Important pages:
- https://www.airelaybox.com/
- https://www.airelaybox.com/introduction/
- https://www.airelaybox.com/quick-start/
- https://www.airelaybox.com/tool-integration/
- https://www.airelaybox.com/providers/
- https://www.airelaybox.com/faq/
- https://github.com/xiaoyuandev/ai-relay-box

Download:
- Desktop releases: https://github.com/xiaoyuandev/ai-relay-box/releases/latest
- WSL / Linux Server install: curl -fsSL https://raw.githubusercontent.com/xiaoyuandev/ai-relay-box/main/scripts/install.sh | bash
`;

export const GET: APIRoute = () =>
  new Response(summary, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8"
    }
  });
