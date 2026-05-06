---
title: Deep Link 导入
description: 说明第三方网页如何唤起 Clash for AI，并传入 Provider 或 Models 导入配置。
slug: zh-cn/deep-link-import
---

## 这是什么

Clash for AI 支持桌面端 deep link 导入流程。

第三方网页可以通过如下链接唤起桌面应用：

```text
clash-for-ai://v1/import?resource=provider&payload=BASE64URL_JSON
```

桌面应用会：

1. 打开应用或把已有窗口拉到前台
2. 解析导入请求
3. 弹出导入确认弹窗
4. 只有在用户确认后才真正导入

当前最小支持范围只有：

1. `provider`
2. `model`

如果你想直接使用现成的生成器页面，可以打开：

```text
/deeplink.html
```

## URL 格式

请使用下面的结构：

```text
clash-for-ai://v1/import?resource=<provider|model>&payload=<base64url-json>
```

规则：

1. `resource` 只能是 `provider` 或 `model`
2. `payload` 必须是 base64url 编码后的 JSON 对象
3. 如果路由不支持、payload 非法或缺少必填字段，应用会拒绝导入

## Provider payload

支持字段：

```json
{
  "name": "OpenRouter",
  "baseUrl": "https://openrouter.ai/api/v1",
  "apiKey": "sk-or-example",
  "authMode": "bearer"
}
```

说明：

1. `name`、`baseUrl`、`apiKey` 为必填
2. `authMode` 为可选
3. 支持的 `authMode` 值：
   `bearer`
   `x-api-key`
   `both`
4. 如果不传 `authMode`，Clash for AI 默认使用 `bearer`

示例 deep link：

```text
clash-for-ai://v1/import?resource=provider&payload=eyJuYW1lIjoiT3BlblJvdXRlciIsImJhc2VVcmwiOiJodHRwczovL29wZW5yb3V0ZXIuYWkvYXBpL3YxIiwiYXBpS2V5Ijoic2stb3ItZXhhbXBsZSJ9
```

## Model payload

支持字段：

```json
{
  "name": "Relay Models",
  "baseUrl": "https://relay.example.com/v1",
  "apiKey": "sk-model-example",
  "providerType": "openai-compatible",
  "modelIds": ["gpt-4o-mini", "claude-3-7-sonnet"]
}
```

说明：

1. `name`、`baseUrl`、`apiKey` 以及至少一个模型 ID 为必填
2. `providerType` 为可选
3. 支持的 `providerType` 值：
   `openai-compatible`
   `anthropic-compatible`
4. 如果不传 `providerType`，Clash for AI 默认按 `openai-compatible` 处理
5. `modelIds` 中第一个模型会作为默认模型 ID

示例 deep link：

```text
clash-for-ai://v1/import?resource=model&payload=eyJuYW1lIjoiUmVsYXkgTW9kZWxzIiwiYmFzZVVybCI6Imh0dHBzOi8vcmVsYXkuZXhhbXBsZS5jb20vdjEiLCJhcGlLZXkiOiJzay1tb2RlbC1leGFtcGxlIiwicHJvdmlkZXJUeXBlIjoib3BlbmFpLWNvbXBhdGlibGUiLCJtb2RlbElkcyI6WyJncHQtNG8tbWluaSIsImNsYXVkZS0zLTctc29ubmV0Il19
```

## 如何生成 payload

payload 的规则是：

1. 先准备 JSON 对象
2. 按 UTF-8 编码
3. 再做 base64url 编码

base64url 的规则：

1. 把 `+` 替换成 `-`
2. 把 `/` 替换成 `_`
3. 去掉末尾的 `=`

JavaScript 示例：

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

## 用户体验流程

当用户点击 deep link 后：

1. 系统询问是否打开 Clash for AI
2. Clash for AI 被唤起
3. 应用展示导入确认弹窗
4. 用户选择确认或取消
5. 只有确认后才真正写入配置

## 安全建议

不要把这套流程当作静默导入。

建议：

1. 默认保留用户确认步骤
2. 不要公开传播包含真实 API Key 的链接
3. 尽量使用短期链接或用户主动生成的链接
4. 发送方也应对 `baseUrl` 和 payload 字段做基础校验

## 当前限制

当前最小实现还不支持：

1. `provider + models` 组合导入
2. 签名 payload
3. 通过 token 拉取远程配置
4. 自动覆盖或合并现有配置
