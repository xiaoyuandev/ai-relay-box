---
title: Deep Link Import
description: How third-party websites can open Clash for AI and pass provider or model source import data.
slug: deep-link-import
---

## What this is

Clash for AI supports a desktop deep link import flow.

Third-party websites can open the desktop app with a URL like:

```text
clash-for-ai://v1/import?resource=provider&payload=BASE64URL_JSON
```

The desktop app will:

1. open or bring the existing window to the front,
2. parse the import request,
3. show an import confirmation dialog,
4. import the data only after the user confirms.

The current minimum scope supports:

1. `provider`
2. `model`

If you want a ready-to-use generator page, open:

```text
/deeplink.html
```

## URL format

Use this structure:

```text
clash-for-ai://v1/import?resource=<provider|model>&payload=<base64url-json>
```

Rules:

1. `resource` must be `provider` or `model`
2. `payload` must be a base64url-encoded JSON object
3. the app will reject unsupported routes, invalid payloads, or missing required fields

## Provider payload

Supported fields:

```json
{
  "name": "OpenRouter",
  "baseUrl": "https://openrouter.ai/api/v1",
  "apiKey": "sk-or-example",
  "authMode": "bearer"
}
```

Notes:

1. `name`, `baseUrl`, and `apiKey` are required
2. `authMode` is optional
3. supported `authMode` values are:
   `bearer`
   `x-api-key`
   `both`
4. if `authMode` is omitted, Clash for AI defaults to `bearer`

Example deep link:

```text
clash-for-ai://v1/import?resource=provider&payload=eyJuYW1lIjoiT3BlblJvdXRlciIsImJhc2VVcmwiOiJodHRwczovL29wZW5yb3V0ZXIuYWkvYXBpL3YxIiwiYXBpS2V5Ijoic2stb3ItZXhhbXBsZSJ9
```

## Model payload

Supported fields:

```json
{
  "name": "Relay Models",
  "baseUrl": "https://relay.example.com/v1",
  "apiKey": "sk-model-example",
  "providerType": "openai-compatible",
  "modelIds": ["gpt-4o-mini", "claude-3-7-sonnet"]
}
```

Notes:

1. `name`, `baseUrl`, `apiKey`, and at least one model id are required
2. `providerType` is optional
3. supported `providerType` values are:
   `openai-compatible`
   `anthropic-compatible`
4. if `providerType` is omitted, Clash for AI defaults to `openai-compatible`
5. the first model in `modelIds` becomes the default model id

Example deep link:

```text
clash-for-ai://v1/import?resource=model&payload=eyJuYW1lIjoiUmVsYXkgTW9kZWxzIiwiYmFzZVVybCI6Imh0dHBzOi8vcmVsYXkuZXhhbXBsZS5jb20vdjEiLCJhcGlLZXkiOiJzay1tb2RlbC1leGFtcGxlIiwicHJvdmlkZXJUeXBlIjoib3BlbmFpLWNvbXBhdGlibGUiLCJtb2RlbElkcyI6WyJncHQtNG8tbWluaSIsImNsYXVkZS0zLTctc29ubmV0Il19
```

## How to build the payload

The payload is:

1. a JSON object
2. UTF-8 encoded
3. base64url encoded

Base64url means:

1. replace `+` with `-`
2. replace `/` with `_`
3. remove trailing `=`

Example in JavaScript:

```js
function toBase64Url(value) {
  return btoa(JSON.stringify(value))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

const payload = toBase64Url({
  name: "OpenRouter",
  baseUrl: "https://openrouter.ai/api/v1",
  apiKey: "sk-or-example"
});

const url = `clash-for-ai://v1/import?resource=provider&payload=${payload}`;
```

## User experience

When a user clicks the deep link:

1. the system asks whether to open Clash for AI,
2. Clash for AI opens,
3. the app shows an import confirmation dialog,
4. the user confirms or cancels,
5. the app imports the configuration only after confirmation.

## Security notes

Do not treat this flow as silent import.

Recommended practices:

1. always expect a user confirmation step
2. do not publicly expose real API keys in shared links
3. prefer short-lived or user-generated links when possible
4. validate `baseUrl` and payload fields on the sender side too

## Current limitations

This minimum implementation does not yet support:

1. `provider + models` combined import
2. signed payloads
3. remote config fetch by token
4. automatic overwrite or merge strategies
